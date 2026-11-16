#!/usr/bin/env bash
# CLI equivalent of docs/AWS_SETUP.md step 2 (the console path is the default).
# Creates the five on-demand DynamoDB tables + TTLs. Safe to rerun: existing tables are skipped.
#
#   AWS_REGION=ap-southeast-2 cloud/infra/create_tables.sh
set -euo pipefail
export AWS_REGION="${AWS_REGION:-ap-southeast-2}"

exists() { aws dynamodb describe-table --table-name "$1" >/dev/null 2>&1; }

create() {
  local name="$1"; shift
  if exists "$name"; then echo "skip $name (exists)"; return; fi
  aws dynamodb create-table --table-name "$name" --billing-mode PAY_PER_REQUEST "$@" >/dev/null
  aws dynamodb wait table-exists --table-name "$name"
  echo "created $name"
}

ttl() {
  aws dynamodb update-time-to-live --table-name "$1" \
    --time-to-live-specification "Enabled=true,AttributeName=expire_at" >/dev/null 2>&1 \
    && echo "ttl on $1.expire_at" || echo "ttl on $1 already set"
}

create ht_readings \
  --attribute-definitions AttributeName=worker_id,AttributeType=S AttributeName=ts,AttributeType=N \
  --key-schema AttributeName=worker_id,KeyType=HASH AttributeName=ts,KeyType=RANGE
ttl ht_readings

create ht_workers \
  --attribute-definitions AttributeName=worker_id,AttributeType=S \
  --key-schema AttributeName=worker_id,KeyType=HASH

create ht_zones \
  --attribute-definitions AttributeName=zone,AttributeType=S AttributeName=bucket,AttributeType=N \
  --key-schema AttributeName=zone,KeyType=HASH AttributeName=bucket,KeyType=RANGE
ttl ht_zones

create ht_alerts \
  --attribute-definitions AttributeName=alert_id,AttributeType=S \
    AttributeName=gsi_pk,AttributeType=S AttributeName=raised_ts,AttributeType=N \
  --key-schema AttributeName=alert_id,KeyType=HASH \
  --global-secondary-indexes '[{"IndexName":"by_raised_ts","KeySchema":[{"AttributeName":"gsi_pk","KeyType":"HASH"},{"AttributeName":"raised_ts","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'

create ht_config \
  --attribute-definitions AttributeName=config_id,AttributeType=S \
  --key-schema AttributeName=config_id,KeyType=HASH

echo "done"
