#!/usr/bin/env python3
"""HeatTrace fake hats: publish contract-exact MQTT for N workers.

Bridge guide Step 1. One MQTT connection plays every worker (the IoT thing
`sim` has a policy on heattrace/*). WBGT is computed with the same
cloud/shared/wbgt.py the Lambdas use.

Examples
  python fake_hat.py --workers 8 --spike W03                       # local Mosquitto
  python fake_hat.py --broker aws --workers 8 --spike W03          # AWS IoT Core (sim cert)
  python fake_hat.py --broker aws --spike W03 --no-ack             # escalation test
  python fake_hat.py --offline W05 --for 120                       # offline buffer + flush
  python fake_hat.py --broker aws --exclude W01                    # real hat plays W01
  python fake_hat.py --broker aws --workers 100 --interval 10 --duration 1800   # load test

Every publish is logged as one line:  ts worker topic payload
"""

from __future__ import annotations

import argparse
import heapq
import json
import os
import random
import signal
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "cloud"))

from infra.seed_workers import WORKERS as SEEDED  # noqa: E402  (no AWS import at module level)
from shared import contract  # noqa: E402
from shared.wbgt import ALERT_CLEAR, ALERT_RAISE, ROLLING_N, rolling_avg, ta_for_target, wbgt  # noqa: E402

ZONES = ["Z1", "Z2", "Z3", "Z4"]
# Lux range per zone: Z1 open sun ... Z4 shaded.
ZONE_LUX = {"Z1": (70000, 90000), "Z2": (50000, 80000), "Z3": (20000, 50000), "Z4": (5000, 20000)}
SPIKE_AFTER_SEC = 60
SPIKE_WBGT = 33.0
OFFLINE_AFTER_SEC = 30
REST_SEC = 15 * 60
MAX_PAYLOAD = 256

print_lock = threading.Lock()


def log(worker: str, topic: str, payload: dict | str, out=None) -> None:
    body = payload if isinstance(payload, str) else json.dumps(payload, separators=(",", ":"))
    line = f"{int(time.time())} {worker} {topic} {body}"
    with print_lock:
        print(line, flush=True)
        if out:
            out.write(line + "\n")
            out.flush()


# ----------------------------------------------------------------- transport

class LocalBroker:
    """Plain MQTT to a local Mosquitto (no TLS)."""

    def __init__(self, host: str, port: int, client_id: str):
        import paho.mqtt.client as mqtt

        self._mqtt = mqtt
        self.c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
        self.on_message = lambda topic, payload: None
        self.c.on_message = lambda _c, _u, m: self.on_message(m.topic, m.payload)
        self.c.connect(host, port, keepalive=30)
        self.c.loop_start()

    def subscribe(self, topic: str) -> None:
        self.c.subscribe(topic, qos=1)

    def publish(self, topic: str, body: str) -> bool:
        info = self.c.publish(topic, body, qos=1, retain=False)
        return info.rc == self._mqtt.MQTT_ERR_SUCCESS

    def close(self) -> None:
        self.c.loop_stop()
        self.c.disconnect()


class AwsBroker:
    """MQTT over TLS to AWS IoT Core with the `sim` thing's certificate."""

    def __init__(self, endpoint: str, cert: str, key: str, ca: str, client_id: str):
        from awscrt import mqtt
        from awsiot import mqtt_connection_builder

        self._qos = mqtt.QoS.AT_LEAST_ONCE
        self.on_message = lambda topic, payload: None
        self.conn = mqtt_connection_builder.mtls_from_path(
            endpoint=endpoint,
            cert_filepath=cert,
            pri_key_filepath=key,
            ca_filepath=ca,
            client_id=client_id,
            clean_session=False,
            keep_alive_secs=30,
        )
        self.conn.connect().result(timeout=20)

    def subscribe(self, topic: str) -> None:
        fut, _ = self.conn.subscribe(
            topic=topic, qos=self._qos,
            callback=lambda topic, payload, **_kw: self.on_message(topic, payload),
        )
        fut.result(timeout=10)

    def publish(self, topic: str, body: str) -> bool:
        self.conn.publish(topic=topic, payload=body, qos=self._qos)
        return True

    def close(self) -> None:
        self.conn.disconnect().result(timeout=10)


# -------------------------------------------------------------------- worker

@dataclass
class Worker:
    wid: str
    zone: str
    ta: float
    rh: float
    lux: float
    seq: int = 0
    spike: bool = False
    no_ack: bool = False
    led: str = "off"                 # off | red | amber (what the hat would show)
    rest_until: float = 0.0
    rolling: list[float] = field(default_factory=list)
    buffer: list[dict] = field(default_factory=list)

    def step(self, elapsed: float, ws: float) -> dict:
        """Advance one sample and return the data payload."""
        # Slow random drift inside the guide's ranges.
        self.ta = min(34.0, max(29.0, self.ta + random.uniform(-0.15, 0.15)))
        self.rh = min(85.0, max(60.0, self.rh + random.uniform(-0.5, 0.5)))
        lo, hi = ZONE_LUX.get(self.zone, (5000, 90000))
        self.lux = min(hi, max(lo, self.lux + random.uniform(-1500, 1500)))
        ta = self.ta
        if self.spike and elapsed >= SPIKE_AFTER_SEC:
            ta = ta_for_target(SPIKE_WBGT, self.rh, self.lux, ws)
        w = wbgt(ta, self.rh, self.lux, ws)
        self.rolling = (self.rolling + [w])[-ROLLING_N:]
        avg = rolling_avg(self.rolling)
        local_alert = 1 if avg >= ALERT_RAISE else 0
        if local_alert and self.led == "off":
            self.led = "red"
        elif self.led == "amber" and time.time() >= self.rest_until and avg < ALERT_CLEAR:
            self.led = "off"
        self.seq += 1
        return {
            "w": self.wid, "z": self.zone, "ta": round(ta, 1), "rh": round(self.rh),
            "lux": int(self.lux), "tg": None, "wbgt": w, "alert": local_alert,
            "ts": int(time.time()), "seq": self.seq,
        }


def make_workers(n: int, exclude: set[str]) -> list[Worker]:
    seeded = {w["worker_id"]: w["zone"] for w in SEEDED}
    out = []
    for i in range(1, n + 1):
        wid = f"W{i:02d}" if n < 100 else f"W{i:03d}"
        if wid in exclude:
            continue
        zone = seeded.get(wid) or random.choice(ZONES)
        lo, hi = ZONE_LUX[zone]
        out.append(Worker(wid, zone, ta=random.uniform(29.5, 32.5),
                          rh=random.uniform(60, 85), lux=random.uniform(lo, hi)))
    return out


# ---------------------------------------------------------------------- main

def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def parse_args(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--interval", type=float, default=10.0, help="seconds between data messages")
    ap.add_argument("--spike", action="append", default=[], metavar="WID",
                    help=f"push this worker's WBGT to {SPIKE_WBGT} after {SPIKE_AFTER_SEC} s (repeatable)")
    ap.add_argument("--no-ack", action="store_true", help="never ack alerts (tests escalation)")
    ap.add_argument("--offline", action="append", default=[], metavar="WID",
                    help=f"stop publishing for --for seconds after {OFFLINE_AFTER_SEC} s, then flush the buffer")
    ap.add_argument("--for", dest="offline_for", type=float, default=120.0)
    ap.add_argument("--exclude", action="append", default=[], metavar="WID",
                    help="don't simulate this worker (a real hat is playing it)")
    ap.add_argument("--duration", type=float, default=0, help="stop after N seconds (0 = run until Ctrl-C)")
    ap.add_argument("--broker", choices=["local", "aws"], default="local")
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=1883)
    ap.add_argument("--endpoint", default=None, help="IoT ATS endpoint (default: IOT_ENDPOINT in cloud/.env)")
    ap.add_argument("--certs", default=str(ROOT / "cloud" / "certs"), help="folder with sim certs")
    ap.add_argument("--client-id", default="sim", help="must equal the IoT thing name on AWS")
    ap.add_argument("--log", default=None, help="also append log lines to this file")
    ap.add_argument("--seed", type=int, default=None)
    return ap.parse_args(argv)


def connect(args):
    if args.broker == "local":
        return LocalBroker(args.host, args.port, args.client_id)
    load_env(ROOT / "cloud" / ".env")
    endpoint = args.endpoint or os.environ.get("IOT_ENDPOINT")
    if not endpoint:
        sys.exit("No IoT endpoint: set IOT_ENDPOINT in cloud/.env or pass --endpoint")
    certs = Path(args.certs)
    cert = certs / f"{args.client_id}.cert.pem"
    key = certs / f"{args.client_id}.private.key"
    ca = certs / "AmazonRootCA1.pem"
    missing = [str(p) for p in (cert, key, ca) if not p.exists()]
    if missing:
        sys.exit("Missing cert files (see docs/AWS_SETUP.md step 3):\n  " + "\n  ".join(missing))
    return AwsBroker(endpoint, str(cert), str(key), str(ca), args.client_id)


def run(args) -> None:
    if args.seed is not None:
        random.seed(args.seed)
    workers = make_workers(args.workers, set(args.exclude))
    by_id = {w.wid: w for w in workers}
    for wid in args.spike:
        if wid in by_id:
            by_id[wid].spike = True
    for w in workers:
        w.no_ack = args.no_ack

    out = open(args.log, "a") if args.log else None
    broker = connect(args)
    ws = [1.0]                       # last-known wind (m/s), updated by heattrace/all/wind
    pending: list[tuple[float, str]] = []  # (due_time, worker_id) for scheduled acks
    lock = threading.Lock()

    def publish(wid: str, topic: str, payload: dict) -> bool:
        body = json.dumps(payload, separators=(",", ":"))
        if len(body) > MAX_PAYLOAD:
            log(wid, topic, f"WARN payload {len(body)} bytes > {MAX_PAYLOAD}", out)
        ok = broker.publish(topic, body)
        log(wid, topic, body, out)
        return ok

    def on_message(topic: str, raw: bytes) -> None:
        try:
            msg = json.loads(raw)
        except ValueError:
            log("-", topic, f"RECV non-JSON {raw!r}", out)
            return
        if topic == contract.WIND_TOPIC:
            if isinstance(msg.get("ws"), (int, float)):
                ws[0] = float(msg["ws"])
            log("-", topic, f"RECV {json.dumps(msg)}", out)
            return
        parts = topic.split("/")
        wid = parts[1] if len(parts) == 3 else "?"
        log(wid, topic, f"RECV {json.dumps(msg)}", out)
        w = by_id.get(wid)
        if not w:
            return
        if msg.get("alert") == 1:
            w.led = "red"
            if msg.get("reason") == "self" and not w.no_ack:
                delay = random.uniform(5, 30)
                with lock:
                    heapq.heappush(pending, (time.time() + delay, wid))
                log(wid, topic, f"will ack in {delay:.0f} s", out)
        elif msg.get("alert") == 0 and w.led == "red" and time.time() >= w.rest_until:
            w.led = "off"

    broker.on_message = on_message
    # One subscription per simulated worker keeps the sim policy honest.
    for w in workers:
        broker.subscribe(contract.cmd_topic(w.wid))
    broker.subscribe(contract.WIND_TOPIC)

    log("-", "sim", f"started {len(workers)} workers on {args.broker}; spike={args.spike} "
        f"offline={args.offline} no_ack={args.no_ack} interval={args.interval}", out)

    stop = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    signal.signal(signal.SIGTERM, lambda *_: stop.set())

    start = time.time()
    next_data = start
    next_status = start
    offline = set(args.offline)
    try:
        while not stop.is_set():
            now = time.time()
            elapsed = now - start
            if args.duration and elapsed >= args.duration:
                break

            # Scheduled acks (button presses).
            with lock:
                due = []
                while pending and pending[0][0] <= now:
                    due.append(heapq.heappop(pending)[1])
            for wid in due:
                w = by_id[wid]
                w.led = "amber"
                w.rest_until = now + REST_SEC
                publish(wid, contract.ack_topic(wid), {"w": wid, "ts": int(now)})

            if now >= next_data:
                next_data += args.interval
                for w in workers:
                    payload = w.step(elapsed, ws[0])
                    is_off = (w.wid in offline
                              and OFFLINE_AFTER_SEC <= elapsed < OFFLINE_AFTER_SEC + args.offline_for)
                    if is_off:
                        w.buffer = (w.buffer + [payload])[-60:]  # firmware keeps the last 60
                        log(w.wid, "buffer", f"offline, buffered {len(w.buffer)}", out)
                        continue
                    if w.buffer:
                        log(w.wid, "buffer", f"reconnected, flushing {len(w.buffer)}", out)
                        for old in w.buffer:
                            publish(w.wid, contract.data_topic(w.wid), old)
                        w.buffer = []
                    publish(w.wid, contract.data_topic(w.wid), payload)

            if now >= next_status:
                next_status += 60
                for w in workers:
                    if w.wid in offline and OFFLINE_AFTER_SEC <= elapsed < OFFLINE_AFTER_SEC + args.offline_for:
                        continue
                    publish(w.wid, contract.status_topic(w.wid), {
                        "w": w.wid, "batt": round(random.uniform(3.7, 4.1), 2),
                        "rssi": random.randint(-75, -50), "buffered": len(w.buffer),
                    })

            stop.wait(0.2)
    finally:
        log("-", "sim", f"stopping after {time.time() - start:.0f} s", out)
        broker.close()
        if out:
            out.close()


if __name__ == "__main__":
    run(parse_args())
