import math

from shared import contract
from shared.wbgt import Constants, rolling_avg, stull_wet_bulb, ta_for_target, wbgt


def test_stull_reference_point():
    # Stull (2011) worked example: 20 °C, 50 % RH -> ~13.7 °C wet bulb.
    assert math.isclose(stull_wet_bulb(20, 50), 13.7, abs_tol=0.1)


def test_wbgt_uses_globe_when_present():
    no_tg = wbgt(32.4, 71, lux=48000, ws=1.0)
    with_tg = wbgt(32.4, 71, lux=48000, ws=1.0, tg=45.0)
    assert with_tg > no_tg


def test_more_wind_cools_estimated_globe():
    assert wbgt(32, 70, lux=80000, ws=4.0) < wbgt(32, 70, lux=80000, ws=0.5)


def test_constants_from_partial_dict_keep_defaults():
    c = Constants.from_dict({"k_nwb": -0.5})
    assert c.k_nwb == -0.5 and c.k_sun == Constants().k_sun


def test_k_nwb_shifts_wbgt_by_0_7x():
    base = wbgt(30, 70, 0, 1, None, Constants(k_nwb=0))
    shifted = wbgt(30, 70, 0, 1, None, Constants(k_nwb=1))
    assert math.isclose(shifted - base, 0.7, abs_tol=0.11)


def test_ta_for_target_inverts_wbgt():
    ta = ta_for_target(33.0, rh=70, lux=60000)
    assert math.isclose(wbgt(ta, 70, 60000), 33.0, abs_tol=0.15)


def test_rolling_avg():
    assert rolling_avg([]) == 0.0
    assert rolling_avg([31, 33]) == 32.0


def test_contract_example_is_valid():
    p = {"w": "W01", "z": "Z3", "ta": 32.4, "rh": 71, "lux": 48000, "tg": 38.1,
         "wbgt": 31.6, "alert": 0, "ts": 1762270000, "seq": 812}
    assert contract.validate_data(p) == []


def test_contract_rejects_missing_w_or_ta():
    assert "missing w" in contract.validate_data({"ta": 30})
    assert "missing ta" in contract.validate_data({"w": "W01"})
    assert contract.validate_data({"w": "W01", "ta": "hot"}) == ["missing ta"]


def test_contract_tg_null_and_ts_zero_are_ok():
    assert contract.validate_data({"w": "W01", "ta": 30, "tg": None, "ts": 0}) == []


def test_topics():
    assert contract.cmd_topic("W03") == "heattrace/W03/cmd"
    assert contract.WIND_TOPIC == "heattrace/all/wind"
