"""ack_handler: IoT rule ht_ack_rule -> this Lambda.

Rule SQL:  SELECT *, topic(2) AS worker_id, timestamp() AS rx_ts
           FROM 'heattrace/+/ack'

Button press on the hat: set ack_ts on the open alert, status = resting,
publish {"alert":0} to the buddy only.
"""

from __future__ import annotations

import logging
import time

from shared import alerts, contract

log = logging.getLogger()
log.setLevel(logging.INFO)


def handler(event, context=None):
    errors = contract.validate_ack(event)
    if errors and not event.get("worker_id"):
        log.warning("rejected ack %s: %s", event, errors)
        return {"ok": False, "errors": errors}

    wid = event.get("worker_id") or event["w"]
    rx_ts = int(event["rx_ts"]) // 1000 if event.get("rx_ts") else int(time.time())
    ts = int(event.get("ts") or 0) or rx_ts

    alert = alerts.ack_worker(wid, ts)
    return {"ok": True, "worker_id": wid, "acked": alert["alert_id"] if alert else None}
