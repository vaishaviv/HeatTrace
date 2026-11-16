# Cloud workflow

How the cloud team works in this repo. Scope: *Cloud ↔ IoT Bridge* guide Steps 1–4.
`dashboard/` and `firmware/` belong to their own owners. Don't edit them from a cloud branch.

## Repo map (cloud side)
```
docs/            CONTRACT.md (source of truth) · AWS_SETUP.md (console runbook) · PROGRESS.md (status) · this file
cloud/shared/    wbgt, contract, config, alerts (state machine), db, iot: imported by every Lambda and the simulator
cloud/lambdas/   process_reading · ack_handler · fetch_wind · escalate  (each: handler.py → handler.handler)
cloud/infra/     policies/*.json, rules/*.sql, create_tables.sh, seed_workers.py, seed_config.py
cloud/scripts/   build_lambdas.sh → cloud/dist/*.zip
cloud/tests/     pytest + moto (no AWS needed)
simulator/       fake_hat.py
```

## Roles
| Role | Does |
|---|---|
| **Cloud dev** | code in `cloud/` + `simulator/`, tests, zips, updates PROGRESS.md |
| **AWS account owner** | runs `docs/AWS_SETUP.md` in the console, uploads zips, shares the endpoint and certs privately |
| **Anyone with CLI creds** | runs the seed scripts and the `--broker aws` simulator |

## One-time local setup
```bash
# Python 3.12 to match the Lambda runtime (uv is installed in ~/.local/bin)
cd cloud     && uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements-dev.txt
cd ../simulator && uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt
cp ../cloud/.env.example ../cloud/.env      # fill IOT_ENDPOINT once the owner shares it
sudo apt install mosquitto                   # local broker (Docker isn't available in this WSL)
```

## Daily loop
1. `git switch main && git pull && git switch -c cloud/<short-topic>` (or `sim/<topic>`).
2. Change code. **Contract changes go to `docs/CONTRACT.md` and `cloud/shared/contract.py` first.** Tell firmware and dashboard owners before merging.
3. `cd cloud && .venv/bin/python -m pytest -q`: must be green.
4. Try it locally: `mosquitto -v &` then `simulator/.venv/bin/python simulator/fake_hat.py --workers 8 --spike W03`.
5. Update `docs/PROGRESS.md` (status, date, notes) **in the same PR**.
6. Push, open a PR into `main`, get one review, squash-merge.
7. If a Lambda changed: `cloud/scripts/build_lambdas.sh <name>` → the owner uploads `cloud/dist/<name>.zip` (Lambda → Code → Upload from .zip). With CLI creds you can do it yourself: `aws lambda update-function-code --function-name <name> --zip-file fileb://cloud/dist/<name>.zip`.

Never commit `cloud/.env`, `cloud/certs/`, `*.pem`, `*.key` or `cloud/dist/` (all gitignored). Calibration constants are a **table edit** (`python -m infra.seed_config --k-sun …`), not a redeploy.

## Order of work (maps to PROGRESS.md)
| # | What | Who | Blocks |
|---|---|---|---|
| 1 | Contract + `shared/wbgt.py` + tests | cloud dev | ✅ done |
| 2 | Simulator vs local Mosquitto, 10-min run | cloud dev | needs mosquitto |
| 3 | Lambdas + moto tests | cloud dev | ✅ done |
| 4 | AWS_SETUP §1–3 (guard rails, tables, IoT) | owner | — |
| 5 | Simulator `--broker aws`, cmd round-trip (Step 2 done) | cloud dev | 4 |
| 6 | AWS_SETUP §4–9 (role, SNS, Lambdas, rules, schedules, seed) | owner + cloud dev | 4 |
| 7 | Spike demo (Step 3 done) | all | 6 |
| 8 | `--no-ack` SMS demo (Step 4 done) | all | 6 |
| 9 | Hand-off to the dashboard team: tables are live, `shared/alerts.ack_alert()` is ready for their read_api | cloud dev | 7 |
| 10 | Real hat W01 (firmware Step 5) joins with `--exclude W01` | hardware + cloud | 7 |

## Useful commands
```bash
# tests
cd cloud && .venv/bin/python -m pytest -q
# simulator (local / AWS)
simulator/.venv/bin/python simulator/fake_hat.py --workers 8 --spike W03
simulator/.venv/bin/python simulator/fake_hat.py --broker aws --workers 8 --spike W03 --log run.log
simulator/.venv/bin/python simulator/fake_hat.py --broker aws --spike W03 --no-ack          # escalation
simulator/.venv/bin/python simulator/fake_hat.py --offline W05 --for 120                     # buffer + flush
# reset demo state between runs (keeps names/buddies)
cd cloud && .venv/bin/python -m infra.seed_workers --reset
# logs (with CLI creds)
aws logs tail /aws/lambda/process_reading --follow --region ap-southeast-2
```

## What live IoT data replaces (simulator → real hats)
Most of the repo is permanent. Live hats replace only the **data source**, because a hat publishes the same MQTT contract as the simulator.

| File / resource | Today (no hats) | With live hats | Changes? |
|---|---|---|---|
| `simulator/fake_hat.py` | sole source of data/ack/status for W01–W08 | real W01 publishes itself; the sim keeps playing **W02 (buddy)** and the 100-worker load test | **partly replaced**, still needed |
| `cloud/certs/sim*` + `heattrace_sim_policy` | sim impersonates all workers | real hat uses its own `W01` cert + `heattrace_hat_policy` | sim cert kept for W02 / load test |
| `cloud/shared/*`, all 4 `lambdas/*` | process sim traffic | process hat traffic, same payloads | **no change** |
| policies, IoT rules, schedules, SNS | — | — | **no change** |
| DynamoDB `ht_readings`, `ht_zones`, `ht_alerts` rows | sim-generated | hat-generated (TTL ages out sim rows; or wipe before the field test) | **replaced by live data** |
| `ht_workers` rows | `seed_workers.py` | name/zone/buddy stay seeded (the hat doesn't send names); latest-reading fields are overwritten live | **seed stays**, live fields replaced |
| `ht_config#wind` | `seed_config.py` default 1.0 m/s | `fetch_wind` overwrites it every 5 min from data.gov.sg once deployed (before any hat) | **replaced by live API** |
| `ht_config#wbgt` constants | defaults | fitted values from Step 7 calibration | **replaced later** (table edit) |
| `cloud/tests/*` | moto | moto: they test logic, not live data | no change |
| `dashboard/mock/*.json` | dashboard default | dashboard team switches to the live API | not ours, untouched |

No code file is deleted when the hats go live. Going live for one hat is an **operational** switch: run the simulator with `--exclude W01`, flash the hat with the `W01` cert, and it appears in the same tables.
