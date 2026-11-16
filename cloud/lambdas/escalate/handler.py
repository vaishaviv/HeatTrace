"""escalate: EventBridge Scheduler rate(1 minute) -> this Lambda.

Find alerts raised > 10 min ago with no ack_ts and no escalated_ts, mark them
escalated, set the worker to escalated and SMS the site topic via SNS.
Env: SNS_TOPIC_ARN.
"""

from __future__ import annotations

import logging
import time

from shared import alerts

log = logging.getLogger()
log.setLevel(logging.INFO)


def handler(event=None, context=None):
    now = int(time.time())
    due = alerts.due_for_escalation(now)
    sent = [a["alert_id"] for a in due if alerts.escalate(a, now)]
    log.info("escalate: %d due, %d escalated %s", len(due), len(sent), sent)
    return {"due": len(due), "escalated": sent}
