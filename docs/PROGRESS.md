# Cloud ↔ IoT Bridge: progress

Tracks the *HeatTrace Cloud ↔ IoT Bridge — Build Guide* Steps 1–4 (cloud). Firmware (Steps 5–7) and the dashboard are tracked by their owners.
**Status values:** `todo` → `code done` (in repo, tests pass) → `deployed` (in AWS) → `verified` (the guide's "Done when" was observed).
Update this file in the same PR as the work. AWS rows move only when the account owner or a teammate confirms them in the console.

Last updated: **2026-11-16** · AWS setup complete except SNS/SMS (blocked: no permission) · branch `feat/cloud-setup` · `cd cloud && .venv/bin/python -m pytest` → **30 passed**

## Step 1: Simulator (week 8)
| Item | Owner | Status | Date | Notes |
|---|---|---|---|---|
| `simulator/fake_hat.py`, contract-exact data/ack/status | cloud | code done | 2026-11-15 | one connection plays all workers; payload size checked < 256 B |
| Flags `--workers --interval --spike --no-ack --offline --for` | cloud | code done | 2026-11-15 | also `--exclude` (real hat), `--duration`, `--broker local\|aws`, `--log`, `--seed` |
| WBGT from shared `cloud/shared/wbgt.py` | cloud | code done | 2026-11-15 | spike solves for ta so the cloud's recompute also sees 33 |
| Subscribe to own `cmd`, auto-ack 5–30 s | cloud | code done | 2026-11-15 | in-process e2e run: spike → self + buddy cmd → ack → buddy `alert:0` → resting |
| One log line per publish `ts worker topic payload` | cloud | code done | 2026-11-15 | `--log file` or pipe stdout |
| 10-min run against local Mosquitto | cloud | todo | | needs `sudo apt install mosquitto` (no Docker in WSL) |

**Done when:** `python fake_hat.py --workers 8 --spike W03` runs for 10 min against Mosquitto with no exceptions and the spike is visible in the log.

## Step 2: AWS IoT Core
| Item | Owner | Status | Date | Notes |
|---|---|---|---|---|
| Device endpoint into `cloud/.env` | AWS owner | deployed | 2026-11-16 | `au6sg8oty1j0l-ats.iot.ap-southeast-2.amazonaws.com` (in local `cloud/.env`) |
| Thing type `heattrace_hat`; things W01, W02, sim; certs | AWS owner | verified | 2026-11-16 | sim/W01/W02 ACTIVE; W01+W02 on `heattrace_hat_policy`; certs `cloud/certs/{sim,W01,W02}.*` (gitignored, key↔cert checked). W01 cert tested: connect + publish reached process_reading. |
| `heattrace_hat_policy` (per-thing topics) | AWS owner | deployed | 2026-11-16 | JSON ready: `cloud/infra/policies/iot_hat_policy.json` |
| `heattrace_sim_policy` (heattrace/*) | AWS owner | deployed | 2026-11-16 | JSON ready: `iot_sim_policy.json` |
| Simulator connects with sim cert; `cmd` round-trip | cloud | verified | 2026-11-16 | `--broker aws --workers 2`: data/status seen in MQTT test client; console publish to `heattrace/W01/cmd` → `RECV {"alert": 1, "reason": "self"}` → ack scheduled |
| Firmware connect snippet + hardware runbook | cloud | code done | 2026-11-16 | `docs/HARDWARE_SETUP.md` (Step 5.1–5.7 for W01); `cloud/scripts/make_secrets_h.py W01` writes gitignored `firmware/hat/secrets.h` |

**Done when:** the test client shows simulator traffic and a manual cmd message round-trips back to the simulator.

## Step 3: DynamoDB + process_reading + ack_handler
| Item | Owner | Status | Date | Notes |
|---|---|---|---|---|
| Tables ht_readings / workers / zones / alerts (+GSI) / config | AWS owner | deployed | 2026-11-16 | ap-southeast-2, on-demand. ht_config key `config_id`, GSI `by_raised_ts` (gsi_pk S / raised_ts N, All); code matched to console. TTL `expire_at` on ht_readings + ht_zones. Stray `ht_test` unused. |
| Seed 8 workers + config | cloud | deployed | 2026-11-16 | ht_workers W01–W08 with buddies; ht_config `wbgt`, `site`, `wind` (wind stale until fetch_wind runs) |
| `ht_data_rule` → process_reading (+ CloudWatch error action) | AWS owner | deployed | 2026-11-16 | SQL 2016-03-23 matches repo; error log `/heattrace/iot-rule-errors` (1 month); IoT invoke permission present |
| process_reading: validate, ts fallback, seq gap, cloud WBGT, readings (TTL 30 d), worker rolling avg, zone bucket, raise/clear | cloud | code done | 2026-11-15 | tests: `tests/test_lifecycle.py` |
| `ht_ack_rule` → ack_handler | AWS owner | deployed | 2026-11-16 | same error action; invoke permission present |
| ack_handler: ack_ts, resting, buddy `alert:0` | cloud | code done | 2026-11-15 | shared `alerts.ack_alert()` is ready for dashboard POST /alerts/{id}/ack |
| Lambda IAM role | AWS owner | partly | 2026-11-16 | Reuse teammate's existing **`ht-lambda-role`** (BasicExecution + inline `ht-access`: DynamoDB on `ht_*` + index, `iot:Publish heattrace/*`). Missing only **`sns:Publish`** for escalate. Also used by dashboard's `ht_read_api`. |
| Lambdas deployed (zips) | AWS owner | deployed | 2026-11-16 | all four live: py3.12 arm64, `handler.handler`, role `ht-lambda-role`, `IOT_ENDPOINT`; timeouts 10/10/20/30 s. `escalate` has no `SNS_TOPIC_ARN` (SNS blocked). |
| Spike → alert row + both cmds; auto-ack → resting | all | verified | 2026-11-16 | `--workers 8 --spike W03`: raised `A-W03-1794773456` at +100 s (avg 32.00), cmd self→W03 + buddy→W04 published within 0.2 s; ack at +18 s → W03 `resting`, W04 `alert:0`. CloudWatch shows every hop, 0 errors. |

**Done when:** simulator spike → alert row → both cmd messages → ack → resting, with every hop visible in CloudWatch.

## Step 4: Wind fetch + SNS escalation
| Item | Owner | Status | Date | Notes |
|---|---|---|---|---|
| fetch_wind: data.gov.sg → ht_config#wind → `heattrace/all/wind`; stale on failure | cloud | code done | 2026-11-15 | API checked live 2026-11-15: unit **knots**, converted to m/s; nearest station to site, or pinned `--station` |
| EventBridge schedule rate(5 min) | AWS owner | verified | 2026-11-16 | `heattrace_fetch_wind` enabled; runs publish `heattrace/all/wind` (station S199, ~1.6–1.8 m/s, stale=false) |
| escalate: GSI query, escalated_ts, status, SMS ≤160 chars | cloud | code done | 2026-11-15 | conditional update → one SMS per alert |
| EventBridge schedule rate(1 min) | AWS owner | verified | 2026-11-16 | `heattrace_escalate` enabled; runs every minute (`0 due`) |
| SNS topic `heattrace_site_alerts`, SMS sandbox numbers, US$1 cap | AWS owner | **blocked** | 2026-11-16 | user has no SNS permission. `escalate` runs without `SNS_TOPIC_ARN` (marks escalated, logs SMS text). To enable later: create topic, add `sns:Publish` to `ht-lambda-role`, set `SNS_TOPIC_ARN` on escalate. |
| `--spike W03 --no-ack` → SMS after 10 min, escalated_ts | all | todo | | screenshot for report |

**Done when:** simulator `--spike W03 --no-ack`, wait 10 min, SMS arrives and ht_alerts row has `escalated_ts`.

## Blocked / decisions
| # | Item | Status |
|---|---|---|
| 1 | **Wi-Fi direct vs BLE + gateway** (guide's open decision). The code assumes Wi-Fi direct. BLE would change only the firmware; the cloud stays the same. | open, team |
| 2 | Guide Step 3 says the alert arrives "within 20 s" of the spike. With a 6-sample rolling average at 10 s, the spike takes 1–5 samples (10–50 s) to cross 32.0. Hop latency after crossing is < 2 s. Decide whether to report latency from the crossing, or to shorten the window. | open |
| 3 | Design changes vs the guide: ht_alerts GSI is `by_raised_ts` (gsi_pk="ALL", raised_ts), because a raised_ts-only key can't range-query. ht_zones has sort key `bucket`. The hat policy allows publishing only on own data/ack/status, not `/*`, so a hat can't spoof its own `cmd`. | done; see CONTRACT.md |
| 4 | Default `k_sun=0.02`, `k_wind=0.5` are guesses, so Z1 (full sun) workers can cross 32 without `--spike`. That's realistic, but for clean demos use `--seed` or edit `ht_config#wbgt`. Fit properly in Step 7. | open, Step 7 |
| 5 | Singapore SMS sender-ID registration: unregistered SMS may be tagged *Likely-SCAM*. | accept for demo |

## Changelog
- **2026-11-16**: Added `docs/HARDWARE_SETUP.md` and `cloud/scripts/make_secrets_h.py`; `firmware/**/secrets.h` gitignored. Real hat = W01, simulator plays W02 (`--exclude W01`).
- **2026-11-16**: fetch_wind + escalate deployed and scheduled; W01/W02 things + certs created and tested. Fixed: rolling avg mixed in hours-old samples after a hat was off; now restarts if previous reading > 5 min old (2 new tests, 30 pass). process_reading.zip (9619 B) re-uploaded and confirmed live.
- **2026-11-16**: Step 3 verified end-to-end on AWS: process_reading + ack_handler deployed, ht_data_rule/ht_ack_rule live, spike→alert→cmd→ack→resting observed in CloudWatch.
- **2026-11-16**: IoT Core Step 2 verified: policies + thing type + `sim` thing/cert created; simulator ↔ AWS round-trip works.
- **2026-11-16**: Read-only audit of ap-southeast-2: IoT Core empty (no things/policies/certs/rules/thing types); no SNS topics; no schedules; one Lambda `ht_read_api` (dashboard) on role `ht-lambda-role`. Endpoint written to local `cloud/.env`.
- **2026-11-16**: Seeded ht_workers (8) and ht_config (wbgt/site/wind) in ap-southeast-2. DynamoDB step complete.
- **2026-11-16**: boto3 clients now take the region from `AWS_REGION`/`AWS_DEFAULT_REGION` (default ap-southeast-2) via `db.region()`; `boto3[crt]` added to dev requirements for `aws login` credentials. Zips rebuilt; 28 tests pass.
- **2026-11-16**: ht_alerts GSI renamed in code/tests/docs from `by_raised` to `by_raised_ts` to match the console; zips rebuilt; 28 tests pass.
- **2026-11-16**: Region set to **ap-southeast-2 (Sydney)** to match the teammate's console setup: `.env.example`, `shared/iot.py`, tests, `create_tables.sh`, AWS_SETUP, WORKFLOW (policy JSONs were already -2). Lambda zips rebuilt; 28 tests pass.
- **2026-11-16**: DynamoDB tables created in console. ht_config partition key changed from `key` to `config_id` in code, tests, create_tables.sh, AWS_SETUP and CONTRACT to match the console; Lambda zips rebuilt; 28 tests pass.
- **2026-11-15**: Repo scaffold: `cloud/shared`, the 4 Lambdas, policies, seed scripts, build script, tests (28 passing), simulator, docs. Simulator verified in-process against the real Lambda handlers on moto. Nothing deployed to AWS yet.
