"""Test fixtures: moto DynamoDB/SNS tables matching docs/AWS_SETUP.md, and a
recorder in place of IoT publish."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

CLOUD = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CLOUD))

os.environ.setdefault("AWS_DEFAULT_REGION", "ap-southeast-2")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ["IOT_ENDPOINT"] = "example-ats.iot.ap-southeast-2.amazonaws.com"

from shared import config, db, iot  # noqa: E402

# Same definitions as cloud/infra/tables.json (the console runbook's source).
TABLES = [
    {"TableName": "ht_readings", "KeySchema": [("worker_id", "S", "HASH"), ("ts", "N", "RANGE")]},
    {"TableName": "ht_workers", "KeySchema": [("worker_id", "S", "HASH")]},
    {"TableName": "ht_zones", "KeySchema": [("zone", "S", "HASH"), ("bucket", "N", "RANGE")]},
    {
        "TableName": "ht_alerts",
        "KeySchema": [("alert_id", "S", "HASH")],
        "GSI": ("by_raised_ts", [("gsi_pk", "S", "HASH"), ("raised_ts", "N", "RANGE")]),
    },
    {"TableName": "ht_config", "KeySchema": [("config_id", "S", "HASH")]},
]


def _create(client, spec):
    attrs = {}
    keys = []
    for name, typ, kind in spec["KeySchema"]:
        attrs[name] = typ
        keys.append({"AttributeName": name, "KeyType": kind})
    kwargs = {
        "TableName": spec["TableName"],
        "KeySchema": keys,
        "BillingMode": "PAY_PER_REQUEST",
    }
    if "GSI" in spec:
        gname, gkeys = spec["GSI"]
        for name, typ, _ in gkeys:
            attrs[name] = typ
        kwargs["GlobalSecondaryIndexes"] = [
            {
                "IndexName": gname,
                "KeySchema": [{"AttributeName": n, "KeyType": k} for n, _, k in gkeys],
                "Projection": {"ProjectionType": "ALL"},
            }
        ]
    kwargs["AttributeDefinitions"] = [
        {"AttributeName": n, "AttributeType": t} for n, t in attrs.items()
    ]
    client.create_table(**kwargs)


@pytest.fixture
def aws(monkeypatch):
    with mock_aws():
        db.reset_clients()
        config.clear_cache()
        ddb = boto3.client("dynamodb")
        for spec in TABLES:
            _create(ddb, spec)
        topic = boto3.client("sns").create_topic(Name="heattrace_site_alerts")["TopicArn"]
        monkeypatch.setenv("SNS_TOPIC_ARN", topic)

        published: list[tuple[str, dict]] = []
        monkeypatch.setattr(iot, "publish", lambda t, p, qos=1: published.append((t, p)))

        from shared import alerts

        alerts._sns.cache_clear()
        yield {"published": published, "topic": topic}
        db.reset_clients()
        config.clear_cache()


@pytest.fixture
def seed(aws):
    from infra.seed_workers import WORKERS

    tbl = db.table("workers")
    for w in WORKERS:
        tbl.put_item(Item=db.to_dynamo({**w, "status": "ok"}))
    return aws


def load_handler(name: str):
    """Import cloud/lambdas/<name>/handler.py as a uniquely named module."""
    path = CLOUD / "lambdas" / name / "handler.py"
    spec = importlib.util.spec_from_file_location(f"handler_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod
