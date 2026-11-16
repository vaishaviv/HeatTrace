"""Alert lifecycle: raise -> ack (resting) -> clear, plus escalate.

One implementation used by process_reading, ack_handler, escalate and (later)
the dashboard's read_api POST /alerts/{id}/ack, so a supervisor click behaves
exactly like a hat button press.

Worker status values: ok | alert | resting | escalated  (offline is derived by
the read API from last_seen, never stored).
"""

from __future__ import annotations

import logging
import os
import time
from functools import lru_cache

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from shared import contract, db, iot
from shared.wbgt import ALERT_CLEAR

log = logging.getLogger(__name__)

REST_SEC = 15 * 60       # resting from ack_ts until ack_ts + 15 min
ESCALATE_SEC = 10 * 60   # no ack for 10 min -> SMS


def _now() -> int:
    return int(time.time())


def _conditional_failed(e: ClientError) -> bool:
    return e.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException"


# --------------------------------------------------------------------- raise

def raise_alert(worker: dict, wbgt_avg: float, ts: int) -> str:
    """Create an ht_alerts row, mark the worker, notify worker and buddy."""
    wid = worker["worker_id"]
    alert_id = f"A-{wid}-{ts}"
    db.table("alerts").put_item(
        Item=db.to_dynamo(
            {
                "alert_id": alert_id,
                "gsi_pk": db.ALERTS_GSI_PK,
                "worker_id": wid,
                "zone": worker.get("zone"),
                "wbgt": float(wbgt_avg),
                "raised_ts": int(ts),
            }
        )
    )
    db.table("workers").update_item(
        Key={"worker_id": wid},
        UpdateExpression="SET #s = :alert, open_alert_id = :a",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":alert": "alert", ":a": alert_id},
    )
    iot.publish(contract.cmd_topic(wid), contract.cmd_alert_self())
    buddy = worker.get("buddy_id")
    if buddy:
        iot.publish(contract.cmd_topic(buddy), contract.cmd_alert_buddy(wid))
    log.info("raised %s for %s avg=%.2f", alert_id, wid, wbgt_avg)
    return alert_id


# ----------------------------------------------------------------------- ack

def ack_alert(alert_id: str, ts: int | None = None) -> dict | None:
    """Acknowledge an alert by id. Returns the updated alert, or None if it
    was unknown, already acknowledged or already cleared (idempotent)."""
    ts = int(ts or _now())
    try:
        res = db.table("alerts").update_item(
            Key={"alert_id": alert_id},
            UpdateExpression="SET ack_ts = :t",
            ConditionExpression=(
                "attribute_exists(alert_id) AND attribute_not_exists(ack_ts)"
                " AND attribute_not_exists(cleared_ts)"
            ),
            ExpressionAttributeValues={":t": ts},
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        if _conditional_failed(e):
            log.info("ack ignored for %s (unknown, acked or cleared)", alert_id)
            return None
        raise
    alert = db.from_dynamo(res["Attributes"])
    wid = alert["worker_id"]
    worker = get_worker(wid) or {}
    db.table("workers").update_item(
        Key={"worker_id": wid},
        UpdateExpression="SET #s = :r",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":r": "resting"},
    )
    # Buddy can stand down; the worker's LED stays red until the rest window ends.
    buddy = worker.get("buddy_id")
    if buddy:
        iot.publish(contract.cmd_topic(buddy), contract.cmd_clear())
    log.info("acked %s (%s) at %s", alert_id, wid, ts)
    return alert


def ack_worker(worker_id: str, ts: int | None = None) -> dict | None:
    """Hat button press: acknowledge the worker's open alert, if any."""
    worker = get_worker(worker_id)
    if not worker or not worker.get("open_alert_id"):
        log.info("ack from %s with no open alert", worker_id)
        return None
    return ack_alert(worker["open_alert_id"], ts)


# --------------------------------------------------------------------- clear

def maybe_clear(worker: dict, wbgt_avg: float, now: int) -> bool:
    """Clear the open alert if the rest window is over and it has cooled."""
    alert_id = worker.get("open_alert_id")
    if not alert_id or wbgt_avg >= ALERT_CLEAR:
        return False
    alert = get_alert(alert_id)
    if not alert or not alert.get("ack_ts"):
        return False  # never acknowledged: stays open (and escalates)
    if now < int(alert["ack_ts"]) + REST_SEC:
        return False
    try:
        db.table("alerts").update_item(
            Key={"alert_id": alert_id},
            UpdateExpression="SET cleared_ts = :t",
            ConditionExpression="attribute_not_exists(cleared_ts)",
            ExpressionAttributeValues={":t": int(now)},
        )
    except ClientError as e:
        if _conditional_failed(e):
            return False
        raise
    wid = worker["worker_id"]
    db.table("workers").update_item(
        Key={"worker_id": wid},
        UpdateExpression="SET #s = :ok REMOVE open_alert_id",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":ok": "ok"},
    )
    iot.publish(contract.cmd_topic(wid), contract.cmd_clear())
    if worker.get("buddy_id"):
        iot.publish(contract.cmd_topic(worker["buddy_id"]), contract.cmd_clear())
    log.info("cleared %s for %s avg=%.2f", alert_id, wid, wbgt_avg)
    return True


# ------------------------------------------------------------------ escalate

@lru_cache(maxsize=1)
def _sns():
    return boto3.client("sns", region_name=db.region())


def sms_text(worker: dict, alert: dict) -> str:
    """One SMS segment (<=160 chars), guide wording."""
    wid = alert["worker_id"]
    name = worker.get("name") or ""
    who = f"{wid} {name}".strip()
    text = (
        f"HeatTrace: {who} in {alert.get('zone') or worker.get('zone') or '?'}, "
        f"WBGT {float(alert.get('wbgt', 0)):.1f}, no rest acknowledged for 10 min. "
        "Check on worker now."
    )
    return text[:160]


def due_for_escalation(now: int) -> list[dict]:
    """Open alerts raised more than 10 min ago with no ack and no escalation."""
    tbl = db.table("alerts")
    kwargs = dict(
        IndexName=db.ALERTS_GSI,
        KeyConditionExpression=Key("gsi_pk").eq(db.ALERTS_GSI_PK)
        & Key("raised_ts").lt(now - ESCALATE_SEC),
        FilterExpression=Attr("ack_ts").not_exists()
        & Attr("escalated_ts").not_exists()
        & Attr("cleared_ts").not_exists(),
    )
    out: list[dict] = []
    while True:
        res = tbl.query(**kwargs)
        out.extend(db.from_dynamo(i) for i in res.get("Items", []))
        if "LastEvaluatedKey" not in res:
            return out
        kwargs["ExclusiveStartKey"] = res["LastEvaluatedKey"]


def escalate(alert: dict, now: int, topic_arn: str | None = None) -> bool:
    """Mark one alert escalated (once) and send the SMS."""
    topic_arn = topic_arn or os.environ.get("SNS_TOPIC_ARN", "")
    try:
        db.table("alerts").update_item(
            Key={"alert_id": alert["alert_id"]},
            UpdateExpression="SET escalated_ts = :t",
            ConditionExpression="attribute_not_exists(escalated_ts)"
            " AND attribute_not_exists(ack_ts)",
            ExpressionAttributeValues={":t": int(now)},
        )
    except ClientError as e:
        if _conditional_failed(e):
            return False  # acked or escalated in the meantime
        raise
    wid = alert["worker_id"]
    db.table("workers").update_item(
        Key={"worker_id": wid},
        UpdateExpression="SET #s = :e",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":e": "escalated"},
    )
    worker = get_worker(wid) or {}
    text = sms_text(worker, alert)
    if topic_arn:
        _sns().publish(TopicArn=topic_arn, Message=text)
    else:
        log.warning("SNS_TOPIC_ARN not set; SMS not sent: %s", text)
    log.info("escalated %s: %s", alert["alert_id"], text)
    return True


# ------------------------------------------------------------------- lookups

def get_worker(worker_id: str) -> dict | None:
    item = db.table("workers").get_item(Key={"worker_id": worker_id}).get("Item")
    return db.from_dynamo(item) if item else None


def get_alert(alert_id: str) -> dict | None:
    item = db.table("alerts").get_item(Key={"alert_id": alert_id}).get("Item")
    return db.from_dynamo(item) if item else None
