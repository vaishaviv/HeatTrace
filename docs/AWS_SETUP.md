# AWS setup runbook (console)

For the **AWS account owner**. Everything is created by hand in the AWS console, region **Asia Pacific (Sydney) `ap-southeast-2`**. Do the steps in order. Each one ends with a **Check**. Tick the matching row in [`PROGRESS.md`](PROGRESS.md) as you go.

Files referenced here live in the repo:
- `cloud/infra/policies/*.json`: paste these into the policy editors. **Replace `ACCOUNT_ID`** with the 12-digit account id (top-right menu).
- `cloud/infra/policies/rules/*.sql`: IoT rule queries.
- `cloud/dist/*.zip`: Lambda code. Build them with `cloud/scripts/build_lambdas.sh`.

Names below are what the code expects. If you change one, also set the matching env var (see `cloud/.env.example`).

---

## 1. Guard rails (5 min)
1. **Billing → Budgets → Create budget**: a monthly cost budget of US$5 with an email alert at 80 %.
2. **SNS → Text messaging (SMS)** (newer accounts see this under **AWS End User Messaging SMS**):
   - Set the **account spend limit** to **US$1** per month.
   - The account starts in the **SMS sandbox**. Under **Sandbox destination phone numbers**, add each test phone in +65… format and verify it with the code it receives.
   - Note: Singapore expects SMS sender IDs to be registered (SGNIC). Unregistered messages may arrive labelled *Likely-SCAM* or be delayed. That is fine for a class demo, but screenshot the first SMS that arrives.

**Check:** the budget exists, the spend limit shows 1.00 and at least one number is *Verified*.

## 2. DynamoDB tables (10 min)
**DynamoDB → Tables → Create table** five times. For every table, choose **Customize settings → Capacity mode: On-demand** and leave everything else at its default.

| Table name | Partition key | Sort key |
|---|---|---|
| `ht_readings` | `worker_id` (String) | `ts` (Number) |
| `ht_workers` | `worker_id` (String) | — |
| `ht_zones` | `zone` (String) | `bucket` (Number) |
| `ht_alerts` | `alert_id` (String) | — |
| `ht_config` | `config_id` (String) | — |

Then:
1. `ht_alerts` → **Indexes → Create index**: partition key `gsi_pk` (String), sort key `raised_ts` (Number), index name **`by_raised_ts`**, projection **All**.
2. `ht_readings` → **Additional settings → Time to Live → Turn on**, attribute `expire_at`. Do the same for `ht_zones`.

CLI alternative: `cloud/infra/create_tables.sh` does all of the above.

**Check:** five tables are *Active*, `ht_alerts` shows index `by_raised_ts` as *Active*, and TTL is on for `ht_readings` and `ht_zones`.

## 3. IoT Core: endpoint, things, certificates, policies (20 min)
1. **IoT Core → Settings** (or **Connect → Domain configurations**): copy the **Device data endpoint** (`xxxx-ats.iot.ap-southeast-2.amazonaws.com`). Send it to the team. It goes in `cloud/.env` as `IOT_ENDPOINT`.
2. **Security → Policies → Create policy**, using the **JSON** editor:
   - `heattrace_hat_policy` ← `cloud/infra/policies/iot_hat_policy.json`
   - `heattrace_sim_policy` ← `cloud/infra/policies/iot_sim_policy.json`
   The hat policy uses `${iot:Connection.Thing.ThingName}`, so each hat can use only its own topics. The client ID must equal the thing name. The sim policy allows `heattrace/*` because one connection plays every worker.
3. **Manage → Thing types → Create**: `heattrace_hat`.
4. **Manage → Things → Create things → single thing** three times:

   | Thing name | Thing type | Policy to attach |
   |---|---|---|
   | `sim` | heattrace_hat | `heattrace_sim_policy` |
   | `W01` | heattrace_hat | `heattrace_hat_policy` |
   | `W02` | heattrace_hat | `heattrace_hat_policy` |

   For each one, choose **Auto-generate a new certificate**. On the download page, download the **device certificate**, **private key** and **Amazon Root CA 1**. The private key can only be downloaded once.
5. Share the files privately, never in git or chat. In each teammate's checkout they go in `cloud/certs/`, renamed like this (that folder is gitignored):
   ```
   cloud/certs/AmazonRootCA1.pem
   cloud/certs/sim.cert.pem        cloud/certs/sim.private.key
   cloud/certs/W01.cert.pem        cloud/certs/W01.private.key     (firmware)
   cloud/certs/W02.cert.pem        cloud/certs/W02.private.key
   ```

**Check:** a teammate runs `python simulator/fake_hat.py --broker aws --workers 2 --duration 60`. In **IoT Core → MQTT test client**, subscribe to `heattrace/#` and messages arrive. Then **publish** `{"alert":1,"reason":"self"}` to `heattrace/W01/cmd`. The simulator prints `RECV {"alert": 1, "reason": "self"}`. *(Guide Step 2 "Done when".)*

## 4. IAM role for the Lambdas (5 min)
**IAM → Roles → Create role** → trusted entity **AWS service → Lambda**.
1. Attach the managed policy **`AWSLambdaBasicExecutionRole`** (CloudWatch logs).
2. Name the role **`heattrace_lambda_role`** and create it.
3. Open the role → **Add permissions → Create inline policy → JSON** ← `cloud/infra/policies/lambda_policy.json`. Name it `heattrace_lambda_access`.

**Check:** the role shows 2 permission policies.

## 5. SNS topic (3 min)
**SNS → Topics → Create topic** → **Standard**, name **`heattrace_site_alerts`**. Copy the **ARN**.
**Create subscription** → protocol **SMS**, endpoint = the supervisor's verified number from step 1.

**Check:** use **Publish message** on the topic with a test body, and the phone receives it. This costs a few cents, so do it once.

## 6. Lambda functions (15 min)
Build the zips first: `cloud/scripts/build_lambdas.sh` → `cloud/dist/*.zip`.

**Lambda → Create function → Author from scratch**, four times:
- Runtime **Python 3.12**, architecture **arm64** (cheaper) or x86_64
- **Change default execution role → Use an existing role → `heattrace_lambda_role`**
- After creating: **Code → Upload from → .zip file** → the matching zip. Check that **Runtime settings → Handler** is `handler.handler`.
- **Configuration → General configuration**: memory 256 MB, timeout as below.
- **Configuration → Environment variables** as below.

| Function | Zip | Timeout | Environment variables |
|---|---|---|---|
| `process_reading` | process_reading.zip | 10 s | `IOT_ENDPOINT` |
| `ack_handler` | ack_handler.zip | 10 s | `IOT_ENDPOINT` |
| `fetch_wind` | fetch_wind.zip | 20 s | `IOT_ENDPOINT` (optional `DATAGOV_API_KEY`) |
| `escalate` | escalate.zip | 30 s | `IOT_ENDPOINT`, `SNS_TOPIC_ARN` |

`IOT_ENDPOINT` = the endpoint from step 3 (with or without `https://`).

**Check:** `fetch_wind` → **Test** with `{}` returns `{"ws": …, "stale": false, …}`, and `ht_config` now has a `wind` item.

## 7. IoT rules → Lambdas (10 min)
**IoT Core → Message routing → Rules → Create rule**, twice. Use SQL version **2016-03-23**.

| Rule name | SQL | Action |
|---|---|---|
| `ht_data_rule` | `SELECT *, topic(2) AS worker_id, timestamp() AS rx_ts FROM 'heattrace/+/data'` | Lambda → `process_reading` |
| `ht_ack_rule` | `SELECT *, topic(2) AS worker_id, timestamp() AS rx_ts FROM 'heattrace/+/ack'` | Lambda → `ack_handler` |

For **both** rules, add an **Error action → CloudWatch logs**. Create the log group `/heattrace/iot-rule-errors` and let the console **create a new role** for it. Dropped messages then show up there. The console adds the Lambda invoke permission automatically.

**Check:** with the simulator running, **Lambda → process_reading → Monitor → View CloudWatch logs** shows `reading W01 z=Z3 … action=None` lines.

## 8. Schedules (5 min)
**EventBridge → Scheduler → Schedules → Create schedule**, twice:

| Name | Pattern | Target |
|---|---|---|
| `heattrace_fetch_wind` | Recurring → rate-based → **5 minutes**, flexible window **Off** | Lambda invoke → `fetch_wind`, payload `{}` |
| `heattrace_escalate` | Recurring → rate-based → **1 minute**, flexible window **Off** | Lambda invoke → `escalate`, payload `{}` |

Let the console create the execution role.

**Check:** after 5 min, the MQTT test client subscribed to `heattrace/all/wind` shows `{"ws":…,"ts":…}`.

## 9. Seed data (2 min, needs CLI credentials)
Run this from a machine with AWS CLI credentials for the account:
```bash
cd cloud
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements-dev.txt
AWS_REGION=ap-southeast-2 .venv/bin/python -m infra.seed_workers     # 8 workers + buddy pairs
AWS_REGION=ap-southeast-2 .venv/bin/python -m infra.seed_config      # WBGT constants, site, initial wind
```
**Check:** `ht_workers` has W01–W08 with names and `buddy_id`.

## 10. End-to-end acceptance (guide Steps 3–4 "Done when")
1. `python simulator/fake_hat.py --broker aws --workers 8 --spike W03`
   → the spike starts 60 s in, and the 6-sample rolling average crosses 32.0 within 1–5 samples, so an `ht_alerts` row `A-W03-…` appears about 70–110 s after start. The simulator prints `RECV {"alert": 1, "reason": "self"}` on W03 and the `buddy` message on W04. Its auto-ack 5–30 s later moves `ht_workers.W03.status` to `resting`.
2. `python simulator/fake_hat.py --broker aws --workers 8 --spike W03 --no-ack`, then wait about 11 min
   → the SMS arrives, and the `ht_alerts` row has `escalated_ts`. Screenshot both for the report.

---

### Costs
At class scale (≤ 8 hats, 10 s interval) everything stays within the free tier except SMS, which costs a few cents per message (capped by step 1). On-demand DynamoDB with 30-day TTL holds roughly 70 k items per worker-month.

### Teardown
Delete in reverse order: schedules → rules → Lambdas → SNS topic → role → things/certs (deactivate cert, detach, delete) → policies → tables.
