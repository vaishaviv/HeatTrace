"""Seed ht_workers with the 8 demo workers and buddy pairs.

Names/zones/buddies match dashboard/mock/workers.json so the dashboard looks
the same on mock and live data. Live fields (wbgt, t_air, last_seen, ...) are
filled in by process_reading; this only sets identity.

    cd cloud && python -m infra.seed_workers            # uses your AWS CLI creds
    python -m infra.seed_workers --reset                # also reset status/alerts pointers
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

WORKERS = [
    {"worker_id": "W01", "name": "Lim Wei Ren", "zone": "Z3", "buddy_id": "W02"},
    {"worker_id": "W02", "name": "Tan Kah Meng", "zone": "Z3", "buddy_id": "W01"},
    {"worker_id": "W03", "name": "Muhammad Faizal", "zone": "Z2", "buddy_id": "W04"},
    {"worker_id": "W04", "name": "Rajesh Kumar", "zone": "Z2", "buddy_id": "W03"},
    {"worker_id": "W05", "name": "Chen Jun Hao", "zone": "Z1", "buddy_id": "W06"},
    {"worker_id": "W06", "name": "Nur Aisyah", "zone": "Z1", "buddy_id": "W05"},
    {"worker_id": "W07", "name": "Ong Boon Teck", "zone": "Z4", "buddy_id": "W08"},
    {"worker_id": "W08", "name": "Ahmad Syafiq", "zone": "Z4", "buddy_id": "W07"},
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--reset", action="store_true", help="set status=ok and drop open_alert_id/rolling")
    args = ap.parse_args()

    from shared import db

    tbl = db.table("workers")
    for w in WORKERS:
        if args.reset:
            tbl.update_item(
                Key={"worker_id": w["worker_id"]},
                UpdateExpression="SET #n=:n, #z=:z, buddy_id=:b, #s=:ok REMOVE open_alert_id, rolling",
                ExpressionAttributeNames={"#n": "name", "#z": "zone", "#s": "status"},
                ExpressionAttributeValues={":n": w["name"], ":z": w["zone"], ":b": w["buddy_id"], ":ok": "ok"},
            )
        else:
            # Identity only; keep any live fields already written.
            tbl.update_item(
                Key={"worker_id": w["worker_id"]},
                UpdateExpression="SET #n=:n, #z=:z, buddy_id=:b, #s=if_not_exists(#s, :ok)",
                ExpressionAttributeNames={"#n": "name", "#z": "zone", "#s": "status"},
                ExpressionAttributeValues={":n": w["name"], ":z": w["zone"], ":b": w["buddy_id"], ":ok": "ok"},
            )
        print(f"seeded {w['worker_id']} {w['name']} {w['zone']} buddy={w['buddy_id']}")
    print(f"done: {len(WORKERS)} workers in {db.table_name('workers')}")


if __name__ == "__main__":
    main()
