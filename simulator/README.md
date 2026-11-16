# Simulator: fake hats

Publishes contract-exact MQTT (`docs/CONTRACT.md`) for N workers, so the cloud and the load test run without real hats. WBGT comes from `cloud/shared/wbgt.py`, the same code the Lambdas use.

```bash
cd simulator && uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt

# local broker (sudo apt install mosquitto; mosquitto -v)
.venv/bin/python fake_hat.py --workers 8 --spike W03

# AWS IoT Core: needs cloud/.env (IOT_ENDPOINT) and cloud/certs/{sim.cert.pem,sim.private.key,AmazonRootCA1.pem}
.venv/bin/python fake_hat.py --broker aws --workers 8 --spike W03 --log run.log
```

| Flag | Effect |
|---|---|
| `--workers N` (8) | W01…WNN. W01–W08 use the seeded zones; others get a random Z1–Z4 |
| `--interval S` (10) | seconds between `data` messages; `status` every 60 s |
| `--spike W03` | from 60 s, solve for the air temp that gives WBGT 33 (repeatable) |
| `--no-ack` | never press the button, to test escalation |
| `--offline W05 --for 120` | from 30 s, buffer instead of publishing for 120 s, then flush oldest-first with original `ts`/`seq` |
| `--exclude W01` | a real hat is playing W01 |
| `--duration S` | stop after S seconds |
| `--broker local\|aws`, `--host`, `--port`, `--endpoint`, `--certs`, `--client-id sim` | connection |
| `--log FILE`, `--seed N` | append log lines to a file; deterministic randomness |

When `alert:1 reason:self` arrives on a worker's `cmd`, it acks after a random 5–30 s, unless `--no-ack` is set. Every publish and receive is one log line: `ts worker topic payload`.
