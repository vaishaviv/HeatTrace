"""fetch_wind: EventBridge Scheduler rate(5 minutes) -> this Lambda.

Calls the data.gov.sg real-time wind-speed API, picks the configured station
(ht_config "site".station_id) or the station nearest the site's lat/lon,
writes {"ws", "ts", "stale"} to ht_config "wind" and publishes {"ws","ts"} to
heattrace/all/wind. On failure keep the last value and set stale=true.

The API reports knots; the hats and wbgt.py use m/s.
Env (optional): DATAGOV_API_KEY for a higher rate limit.
"""

from __future__ import annotations

import json
import logging
import math
import os
import time
import urllib.request
from datetime import datetime

from shared import config, contract, iot

log = logging.getLogger()
log.setLevel(logging.INFO)

API_URL = "https://api-open.data.gov.sg/v2/real-time/api/wind-speed"
KNOT_TO_MPS = 0.514444
DEFAULT_SITE = {"lat": 1.3413, "lon": 103.9638}  # SUTD; override in ht_config "site"


def fetch(url: str = API_URL, timeout: float = 8.0) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "heattrace-fetch-wind"})
    key = os.environ.get("DATAGOV_API_KEY")
    if key:
        req.add_header("x-api-key", key)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def _dist2(a_lat, a_lon, b_lat, b_lon) -> float:
    x = (b_lon - a_lon) * math.cos(math.radians((a_lat + b_lat) / 2))
    return x * x + (b_lat - a_lat) ** 2


def pick_reading(body: dict, site: dict) -> tuple[str, float, int]:
    """Return (station_id, wind m/s, unix ts) from an API response."""
    data = body["data"]
    readings = data["readings"][0]
    values = {d["stationId"]: float(d["value"]) for d in readings["data"]}
    if not values:
        raise ValueError("no station values in response")

    station = site.get("station_id")
    if station not in values:
        lat = float(site.get("lat", DEFAULT_SITE["lat"]))
        lon = float(site.get("lon", DEFAULT_SITE["lon"]))
        candidates = [
            s for s in data.get("stations", []) if s["id"] in values and "location" in s
        ]
        if not candidates:
            raise ValueError("no stations with values and locations")
        station = min(
            candidates,
            key=lambda s: _dist2(lat, lon, s["location"]["latitude"], s["location"]["longitude"]),
        )["id"]

    value = values[station]
    unit = (data.get("readingUnit") or "knots").lower()
    ws = value * KNOT_TO_MPS if "knot" in unit else value
    ts = int(datetime.fromisoformat(readings["timestamp"]).timestamp())
    return station, round(ws, 2), ts


def handler(event=None, context=None):
    site = config.get("site", max_age=0) or {}
    try:
        station, ws, ts = pick_reading(fetch(), site)
        wind = {"ws": ws, "ts": ts, "stale": False, "station_id": station}
    except Exception as e:  # network, HTTP, schema: keep the last value
        log.warning("wind fetch failed: %s", e)
        last = config.get("wind", max_age=0) or {}
        wind = {
            "ws": float(last.get("ws", config.DEFAULT_WIND_MPS)),
            "ts": int(last.get("ts", 0)),
            "stale": True,
            "station_id": last.get("station_id"),
        }
    wind["fetched_at"] = int(time.time())
    config.put("wind", {k: v for k, v in wind.items() if v is not None})
    iot.publish(contract.WIND_TOPIC, {"ws": wind["ws"], "ts": wind["ts"]})
    log.info("wind %s", wind)
    return wind
