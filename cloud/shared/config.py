"""ht_config reader with defaults and a short cache.

Items (partition key `config_id`):
  wbgt  {k_nwb, k_sun, k_wind}             calibration constants
  wind  {ws, ts, stale}                    written by fetch_wind every 5 min
  site  {name, station_id, lat, lon}       data.gov.sg station near the site
"""

from __future__ import annotations

import time

from shared import db
from shared.wbgt import Constants

CACHE_SEC = 60
DEFAULT_WIND_MPS = 1.0

_cache: dict[str, tuple[float, dict | None]] = {}


def get(key: str, max_age: float = CACHE_SEC) -> dict | None:
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < max_age:
        return hit[1]
    item = db.table("config").get_item(Key={"config_id": key}).get("Item")
    item = db.from_dynamo(item) if item else None
    _cache[key] = (now, item)
    return item


def put(key: str, fields: dict) -> None:
    db.table("config").put_item(Item=db.to_dynamo({"config_id": key, **fields}))
    _cache.pop(key, None)


def clear_cache() -> None:
    _cache.clear()


def wbgt_constants() -> Constants:
    return Constants.from_dict(get("wbgt"))


def wind_mps() -> float:
    item = get("wind")
    if item and item.get("ws") is not None:
        return float(item["ws"])
    return DEFAULT_WIND_MPS
