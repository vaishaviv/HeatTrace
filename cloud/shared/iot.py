"""Publish to IoT Core from Lambda.

IOT_ENDPOINT must be the account's ATS data endpoint
(xxxx-ats.iot.ap-southeast-2.amazonaws.com); boto3's default endpoint is the
legacy Verisign one and is rejected.
"""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache

import boto3

from shared import db

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _client():
    endpoint = os.environ.get("IOT_ENDPOINT", "").strip()
    if not endpoint:
        raise RuntimeError("IOT_ENDPOINT env var is not set")
    if not endpoint.startswith("https://"):
        endpoint = "https://" + endpoint
    return boto3.client("iot-data", endpoint_url=endpoint, region_name=db.region())


def publish(topic: str, payload: dict, qos: int = 1) -> None:
    body = json.dumps(payload, separators=(",", ":"))
    log.info("publish %s %s", topic, body)
    _client().publish(topic=topic, qos=qos, payload=body.encode())
