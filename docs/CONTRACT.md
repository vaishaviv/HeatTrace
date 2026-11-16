# HeatTrace MQTT contract

Locked before firmware or Lambda code. Every track (hat firmware, simulator, Lambdas) builds against this.
Source: *HeatTrace Cloud ↔ IoT Bridge — Build Guide*, "MQTT contract". Code: `cloud/shared/contract.py`.

QoS 1 everywhere, retained flag **off**, payloads **under 256 bytes**.

| Topic | Direction | Payload | When |
|---|---|---|---|
| `heattrace/{worker_id}/data` | hat → cloud | `{"w":"W01","z":"Z3","ta":32.4,"rh":71,"lux":48000,"tg":38.1,"wbgt":31.6,"alert":0,"ts":1762270000,"seq":812}` | every 10 s (60 s once stable) |
| `heattrace/{worker_id}/ack` | hat → cloud | `{"w":"W01","ts":1762270120}` | button press |
| `heattrace/{worker_id}/cmd` | cloud → hat | `{"alert":1,"reason":"self"}` · `{"alert":1,"reason":"buddy","from":"W02"}` · `{"alert":0}` | alert raise / clear |
| `heattrace/all/wind` | cloud → hats | `{"ws":2.1,"ts":1762270000}` | every 5 min |
| `heattrace/{worker_id}/status` | hat → cloud | `{"w":"W01","batt":3.9,"rssi":-61,"buffered":0}` | every 60 s |

## Field rules
- `ta` air °C, `rh` %, `lux` light, `tg` globe °C (**null** until the globe sensor exists), `wbgt` is the hat's local estimate using its last-known wind.
- `seq` is a per-boot counter. If it goes **backwards by more than 1**, the cloud flags `gap=true` on the reading (reboot or offline flush).
- `ts` is Unix seconds from NTP, or **0** if NTP has not synced. The cloud then uses the IoT rule's receive time.
- `alert` is 0/1, the hat's local alert state.
- `ws` is wind in **m/s**. data.gov.sg reports knots, and `fetch_wind` converts them.
- Required by the cloud: `w` and `ta`. Anything missing either is rejected and logged.
- The cloud trusts the **topic's** worker id (the IoT policy enforces it), not the `w` field.

## WBGT (`cloud/shared/wbgt.py`; the firmware ports the same formula to C)
```
T_nwb = Stull(ta, rh) + k_nwb
T_g   = tg  if present  else  ta + 0.0079 * lux * k_sun / (1 + k_wind * ws)
WBGT  = 0.7*T_nwb + 0.2*T_g + 0.1*ta
```
Constants are stored in `ht_config` item `wbgt` (defaults k_nwb=0, k_sun=0.02, k_wind=0.5) and fitted in Step 7.

## Alert state machine (cloud side, `cloud/shared/alerts.py`)
Evaluated on the **6-sample rolling average** of the cloud-recomputed WBGT.
If the previous reading is more than **5 min** older than the new one (hat off or out of range), the average restarts from the new reading instead of mixing in stale samples.

| From | Trigger | To | Messages |
|---|---|---|---|
| ok | rolling avg ≥ 32.0 | **alert** (ht_alerts row, `raised_ts`) | `{"alert":1,"reason":"self"}` → worker; `{"alert":1,"reason":"buddy","from":W}` → buddy |
| alert / escalated | ack (hat button, or dashboard "Mark resting") | **resting** (`ack_ts`) | `{"alert":0}` → **buddy only** (worker LED stays red until rest ends) |
| alert | 10 min with no ack | **escalated** (`escalated_ts`) | SNS SMS to `heattrace_site_alerts` |
| resting | now ≥ ack_ts + 15 min **and** rolling avg < 31.5 | **ok** (`cleared_ts`) | `{"alert":0}` → worker and buddy |

`offline` (no reading for 120 s) is **never stored**. A reader such as the dashboard API derives it from `last_seen`.

## DynamoDB (written by the cloud, read by the dashboard)
| Table | PK | SK | Notes |
|---|---|---|---|
| `ht_readings` | `worker_id` S | `ts` N | every reading; `wbgt_hat`, `wbgt_cloud`, `ws`, `gap`, `rx_ts`; TTL `expire_at` = ts + 30 d |
| `ht_workers` | `worker_id` S | — | `name`, `zone`, `buddy_id` (seeded) + live `wbgt`, `t_air`, `rh`, `lux`, `last_seen`, `status`, `rolling`, `wbgt_avg`, `open_alert_id`, `last_seq` |
| `ht_zones` | `zone` S | `bucket` N | 5-min bucket start; atomic `sum_wbgt`, `n` (avg = sum/n); TTL `expire_at` = bucket + 2 d |
| `ht_alerts` | `alert_id` S | — | `worker_id`, `zone`, `wbgt`, `raised_ts`, `ack_ts`, `escalated_ts`, `cleared_ts`, `gsi_pk`="ALL"; GSI **`by_raised_ts`** (`gsi_pk`, `raised_ts`) |
| `ht_config` | `config_id` S | — | items `wbgt`, `wind` {ws, ts, stale, station_id}, `site` {name, lat, lon, station_id} |
