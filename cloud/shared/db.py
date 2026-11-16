"""DynamoDB access: table names from env, float <-> Decimal conversion."""

from __future__ import annotations

import os
from decimal import Decimal
from functools import lru_cache

import boto3

TABLE_ENV = {
    "readings": ("TABLE_READINGS", "ht_readings"),
    "workers": ("TABLE_WORKERS", "ht_workers"),
    "zones": ("TABLE_ZONES", "ht_zones"),
    "alerts": ("TABLE_ALERTS", "ht_alerts"),
    "config": ("TABLE_CONFIG", "ht_config"),
}
ALERTS_GSI = "by_raised_ts"
ALERTS_GSI_PK = "ALL"
DEFAULT_REGION = "ap-southeast-2"


def region() -> str:
    """AWS_REGION (set by Lambda) or AWS_DEFAULT_REGION, else the project region."""
    return os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or DEFAULT_REGION


def table_name(kind: str) -> str:
    env, default = TABLE_ENV[kind]
    return os.environ.get(env, default)


@lru_cache(maxsize=None)
def _resource():
    return boto3.resource("dynamodb", region_name=region())


def table(kind: str):
    return _resource().Table(table_name(kind))


def reset_clients() -> None:
    """For tests: drop cached boto3 resources (e.g. inside a new moto context)."""
    _resource.cache_clear()


def to_dynamo(v):
    """Recursively convert floats to Decimal for boto3's resource API."""
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, dict):
        return {k: to_dynamo(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [to_dynamo(x) for x in v]
    return v


def from_dynamo(v):
    """Recursively convert Decimal back to int/float."""
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, dict):
        return {k: from_dynamo(x) for k, x in v.items()}
    if isinstance(v, list):
        return [from_dynamo(x) for x in v]
    return v
