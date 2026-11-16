"""MQTT contract (see docs/CONTRACT.md). Topic names and payload validation."""

from __future__ import annotations

PREFIX = "heattrace"
WIND_TOPIC = f"{PREFIX}/all/wind"


def data_topic(worker_id: str) -> str:
    return f"{PREFIX}/{worker_id}/data"


def ack_topic(worker_id: str) -> str:
    return f"{PREFIX}/{worker_id}/ack"


def cmd_topic(worker_id: str) -> str:
    return f"{PREFIX}/{worker_id}/cmd"


def status_topic(worker_id: str) -> str:
    return f"{PREFIX}/{worker_id}/status"


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def validate_data(p: dict) -> list[str]:
    """Return a list of problems; empty means the data payload is usable.

    Hard requirements (guide Step 3): `w` and `ta`. Other fields are checked
    for type only when present, since tg is null until the globe sensor exists
    and ts may be 0 before NTP sync.
    """
    errors: list[str] = []
    if not isinstance(p, dict):
        return ["payload is not a JSON object"]
    if not isinstance(p.get("w"), str) or not p.get("w"):
        errors.append("missing w")
    if not _num(p.get("ta")):
        errors.append("missing ta")
    for key in ("rh", "lux", "wbgt", "ts", "seq"):
        if key in p and p[key] is not None and not _num(p[key]):
            errors.append(f"{key} not numeric")
    if p.get("tg") is not None and not _num(p["tg"]):
        errors.append("tg not numeric")
    if "alert" in p and p["alert"] not in (0, 1):
        errors.append("alert not 0/1")
    return errors


def validate_ack(p: dict) -> list[str]:
    if not isinstance(p, dict):
        return ["payload is not a JSON object"]
    if not isinstance(p.get("w"), str) or not p.get("w"):
        return ["missing w"]
    return []


def cmd_alert_self() -> dict:
    return {"alert": 1, "reason": "self"}


def cmd_alert_buddy(from_worker: str) -> dict:
    return {"alert": 1, "reason": "buddy", "from": from_worker}


def cmd_clear() -> dict:
    return {"alert": 0}
