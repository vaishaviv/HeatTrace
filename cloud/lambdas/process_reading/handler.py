"""process_reading: IoT rule ht_data_rule -> this Lambda.

Rule SQL:  SELECT *, topic(2) AS worker_id, timestamp() AS rx_ts
           FROM 'heattrace/+/data'
(timestamp() is milliseconds.)

Order (bridge guide Step 3.2):
  validate -> ts fallback -> seq gap -> cloud WBGT -> ht_readings ->
  ht_workers (latest + 6-sample rolling) -> ht_zones 5-min bucket ->
  raise / clear alert.
"""

from __future__ import annotations

import logging
import time

from shared import alerts, config, contract, db
from shared.wbgt import ALERT_RAISE, ROLLING_N, rolling_avg, wbgt

log = logging.getLogger()
log.setLevel(logging.INFO)

READING_TTL_SEC = 30 * 24 * 3600
ZONE_BUCKET_SEC = 300
ZONE_TTL_SEC = 2 * 24 * 3600
ROLLING_STALE_SEC = 300  # older previous samples are dropped from the rolling avg


def _f(v):
    return None if v is None else float(v)


def handler(event, context=None):
    errors = contract.validate_data(event)
    if errors:
        log.warning("rejected payload %s: %s", event, errors)
        return {"ok": False, "errors": errors}

    # The topic's worker id is authenticated by the IoT policy; prefer it.
    wid = event.get("worker_id") or event["w"]
    if event.get("w") != wid:
        log.warning("payload w=%s on topic for %s; using topic", event.get("w"), wid)

    now = int(time.time())
    rx_ts = int(event["rx_ts"]) // 1000 if event.get("rx_ts") else now
    ts = int(event.get("ts") or 0) or rx_ts  # ts == 0 -> NTP not synced yet

    worker = alerts.get_worker(wid) or {
        "worker_id": wid,
        "name": wid,
        "zone": event.get("z"),
        "buddy_id": None,
        "status": "ok",
    }
    zone = event.get("z") or worker.get("zone") or "Z?"

    seq = event.get("seq")
    last_seq = worker.get("last_seq")
    gap = seq is not None and last_seq is not None and seq < last_seq - 1

    ta = float(event["ta"])
    rh = _f(event.get("rh")) or 0.0
    lux = _f(event.get("lux")) or 0.0
    tg = _f(event.get("tg"))
    ws = config.wind_mps()
    wbgt_cloud = wbgt(ta, rh, lux, ws, tg, config.wbgt_constants())

    reading = {
        "worker_id": wid,
        "ts": ts,
        "zone": zone,
        "ta": ta,
        "rh": rh,
        "lux": lux,
        "tg": tg,
        "wbgt_hat": _f(event.get("wbgt")),
        "wbgt_cloud": wbgt_cloud,
        "ws": ws,
        "hat_alert": event.get("alert"),
        "seq": seq,
        "gap": gap,
        "rx_ts": rx_ts,
        "expire_at": ts + READING_TTL_SEC,
    }
    db.table("readings").put_item(
        Item=db.to_dynamo({k: v for k, v in reading.items() if v is not None})
    )

    # Zone fold: atomic add into the current 5-min bucket.
    bucket = ts - ts % ZONE_BUCKET_SEC
    db.table("zones").update_item(
        Key={"zone": zone, "bucket": bucket},
        UpdateExpression="ADD sum_wbgt :w, n :one SET expire_at = :e",
        ExpressionAttributeValues=db.to_dynamo(
            {":w": wbgt_cloud, ":one": 1, ":e": bucket + ZONE_TTL_SEC}
        ),
    )

    # Buffered (older) readings are stored but don't move the live state.
    is_latest = ts >= int(worker.get("last_seen") or 0)
    if not is_latest:
        if seq is not None:
            _set_last_seq(wid, seq)
        log.info("stored late reading %s ts=%s seq=%s gap=%s", wid, ts, seq, gap)
        return {"ok": True, "worker_id": wid, "ts": ts, "late": True, "gap": gap}

    # After a long silence (hat off, out of range) the old samples describe a
    # different moment, so the 1-minute average starts again from this reading.
    prev = list(worker.get("rolling") or [])
    if ts - int(worker.get("last_seen") or 0) > ROLLING_STALE_SEC:
        prev = []
    rolling = (prev + [wbgt_cloud])[-ROLLING_N:]
    avg = rolling_avg(rolling)
    fields = {
        ":zone": zone,
        ":wbgt": wbgt_cloud,
        ":wbgt_hat": _f(event.get("wbgt")),
        ":t_air": ta,
        ":rh": rh,
        ":lux": lux,
        ":ls": ts,
        ":rolling": rolling,
        ":avg": avg,
        ":wid": wid,
        ":ok": "ok",
    }
    expr = (
        "SET #zone = :zone, wbgt = :wbgt, wbgt_hat = :wbgt_hat, t_air = :t_air,"
        " rh = :rh, lux = :lux, last_seen = :ls, rolling = :rolling, wbgt_avg = :avg,"
        " #name = if_not_exists(#name, :wid), #status = if_not_exists(#status, :ok)"
    )
    if tg is not None:
        expr += ", tg = :tg"
        fields[":tg"] = tg
    if seq is not None:
        expr += ", last_seq = :seq"
        fields[":seq"] = seq
    db.table("workers").update_item(
        Key={"worker_id": wid},
        UpdateExpression=expr,
        ExpressionAttributeNames={"#zone": "zone", "#name": "name", "#status": "status"},
        ExpressionAttributeValues=db.to_dynamo(fields),
    )
    worker.update({"zone": zone, "wbgt_avg": avg})

    action = None
    status = worker.get("status") or "ok"
    if avg >= ALERT_RAISE and status == "ok" and not worker.get("open_alert_id"):
        alerts.raise_alert(worker, avg, ts)
        action = "raised"
    elif worker.get("open_alert_id") and alerts.maybe_clear(worker, avg, ts):
        action = "cleared"

    log.info(
        "reading %s z=%s ts=%s wbgt_cloud=%.1f avg=%.2f status=%s action=%s gap=%s",
        wid, zone, ts, wbgt_cloud, avg, status, action, gap,
    )
    return {"ok": True, "worker_id": wid, "ts": ts, "avg": avg, "action": action, "gap": gap}


def _set_last_seq(wid: str, seq: int) -> None:
    db.table("workers").update_item(
        Key={"worker_id": wid},
        UpdateExpression="SET last_seq = :s",
        ExpressionAttributeValues={":s": seq},
    )
