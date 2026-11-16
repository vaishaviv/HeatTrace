"""Seed ht_config: WBGT constants, site/station, initial wind.

    cd cloud && python -m infra.seed_config
    python -m infra.seed_config --station S06        # pin a data.gov.sg station
    python -m infra.seed_config --k-sun 0.018 --k-wind 0.6 --k-nwb -0.3   # after calibration

Without --station, fetch_wind uses the station nearest the site lat/lon.
Existing "wind" is only written if missing (fetch_wind owns it).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared.wbgt import Constants  # noqa: E402


def main() -> None:
    d = Constants()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--k-nwb", type=float, default=d.k_nwb)
    ap.add_argument("--k-sun", type=float, default=d.k_sun)
    ap.add_argument("--k-wind", type=float, default=d.k_wind)
    ap.add_argument("--site-name", default="Demo site")
    ap.add_argument("--lat", type=float, default=1.3413)   # SUTD
    ap.add_argument("--lon", type=float, default=103.9638)
    ap.add_argument("--station", default=None, help="data.gov.sg station id, e.g. S06")
    args = ap.parse_args()

    from shared import config

    config.put("wbgt", {"k_nwb": args.k_nwb, "k_sun": args.k_sun, "k_wind": args.k_wind})
    site = {"name": args.site_name, "lat": args.lat, "lon": args.lon}
    if args.station:
        site["station_id"] = args.station
    config.put("site", site)
    if not config.get("wind", max_age=0):
        config.put("wind", {"ws": config.DEFAULT_WIND_MPS, "ts": 0, "stale": True})

    for key in ("wbgt", "site", "wind"):
        print(key, config.get(key, max_age=0))


if __name__ == "__main__":
    main()
