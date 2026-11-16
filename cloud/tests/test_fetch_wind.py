from datetime import datetime, timezone

import pytest
from conftest import load_handler

from shared import config

fw = load_handler("fetch_wind")

SAMPLE = {
    "code": 0,
    "data": {
        "stations": [
            {"id": "S06", "name": "Paya Lebar", "location": {"latitude": 1.3524, "longitude": 103.9007}},
            {"id": "S108", "name": "Marina Barrage", "location": {"latitude": 1.2799, "longitude": 103.8703}},
        ],
        "readings": [
            {"timestamp": "2026-11-15T21:29:00+08:00",
             "data": [{"stationId": "S06", "value": 4.0}, {"stationId": "S108", "value": 2.0}]}
        ],
        "readingType": "Wind Speed AVG(S)10M M1M",
        "readingUnit": "knots",
    },
}


def test_pick_nearest_station_and_convert_knots():
    station, ws, ts = fw.pick_reading(SAMPLE, {"lat": 1.3413, "lon": 103.9638})
    assert station == "S06"
    assert ws == pytest.approx(4.0 * 0.514444, abs=0.01)
    assert ts == int(datetime(2026, 11, 15, 13, 29, tzinfo=timezone.utc).timestamp())


def test_pinned_station_wins():
    station, ws, _ = fw.pick_reading(SAMPLE, {"station_id": "S108"})
    assert station == "S108" and ws == pytest.approx(1.03, abs=0.01)


def test_handler_writes_config_and_publishes(aws, monkeypatch):
    monkeypatch.setattr(fw, "fetch", lambda: SAMPLE)
    out = fw.handler()
    assert out["stale"] is False
    stored = config.get("wind", max_age=0)
    assert stored["ws"] == out["ws"] and stored["station_id"] == "S06"
    assert aws["published"][-1] == ("heattrace/all/wind", {"ws": out["ws"], "ts": out["ts"]})
    # process_reading picks up the new wind
    config.clear_cache()
    assert config.wind_mps() == out["ws"]


def test_failure_keeps_last_value_and_marks_stale(aws, monkeypatch):
    config.put("wind", {"ws": 2.5, "ts": 111, "stale": False})

    def boom():
        raise OSError("network down")

    monkeypatch.setattr(fw, "fetch", boom)
    out = fw.handler()
    assert out["stale"] is True and out["ws"] == 2.5 and out["ts"] == 111
    assert aws["published"][-1] == ("heattrace/all/wind", {"ws": 2.5, "ts": 111})


def test_failure_with_no_history_uses_default(aws, monkeypatch):
    monkeypatch.setattr(fw, "fetch", lambda: {"data": {}})
    out = fw.handler()
    assert out["stale"] is True and out["ws"] == config.DEFAULT_WIND_MPS
