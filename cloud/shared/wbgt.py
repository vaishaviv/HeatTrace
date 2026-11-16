"""WBGT estimate shared by the simulator, the Lambdas and (ported to C) the hat.

One implementation, several callers. Pure Python, no AWS imports, so the
simulator can import it without boto3.

    T_nwb = Stull(ta, rh) + k_nwb
    T_g   = tg if measured, else ta + 0.0079 * lux * k_sun / (1 + k_wind * ws)
    WBGT  = 0.7 * T_nwb + 0.2 * T_g + 0.1 * ta

Constants live in ht_config item "wbgt" so calibration is a table edit.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# Thresholds from the bridge guide (°C, applied to the 6-sample rolling average).
ALERT_RAISE = 32.0
ALERT_CLEAR = 31.5
ROLLING_N = 6


@dataclass(frozen=True)
class Constants:
    k_nwb: float = 0.0   # natural wet-bulb calibration offset, °C
    k_sun: float = 0.02  # solar gain per scaled lux (fitted in Step 7)
    k_wind: float = 0.5  # wind cooling of the globe (fitted in Step 7)

    @classmethod
    def from_dict(cls, d: dict | None) -> "Constants":
        d = d or {}
        default = cls()
        return cls(
            k_nwb=float(d.get("k_nwb", default.k_nwb)),
            k_sun=float(d.get("k_sun", default.k_sun)),
            k_wind=float(d.get("k_wind", default.k_wind)),
        )


def stull_wet_bulb(ta: float, rh: float) -> float:
    """Wet-bulb temperature (°C) from air temp (°C) and RH (%), Stull 2011."""
    return (
        ta * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(ta + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * rh ** 1.5 * math.atan(0.023101 * rh)
        - 4.686035
    )


def globe_temp(ta: float, lux: float, ws: float, c: Constants) -> float:
    """Estimated globe temperature when no globe sensor exists."""
    return ta + 0.0079 * lux * c.k_sun / (1.0 + c.k_wind * max(ws, 0.0))


def wbgt(
    ta: float,
    rh: float,
    lux: float = 0.0,
    ws: float = 1.0,
    tg: float | None = None,
    c: Constants | None = None,
) -> float:
    """Outdoor WBGT estimate in °C, rounded to 0.1."""
    c = c or Constants()
    t_nwb = stull_wet_bulb(ta, rh) + c.k_nwb
    t_g = tg if tg is not None else globe_temp(ta, lux or 0.0, ws, c)
    return round(0.7 * t_nwb + 0.2 * t_g + 0.1 * ta, 1)


def rolling_avg(samples: list[float]) -> float:
    if not samples:
        return 0.0
    return round(sum(samples) / len(samples), 2)


def ta_for_target(
    target: float, rh: float, lux: float, ws: float = 1.0, c: Constants | None = None
) -> float:
    """Air temp that gives `target` WBGT at fixed rh/lux/ws (bisection).

    Used by the simulator's --spike so the cloud, which recomputes WBGT from
    ta/rh/lux, sees the same spike the hat reports.
    """
    lo, hi = 0.0, 60.0
    for _ in range(50):
        mid = (lo + hi) / 2
        if wbgt(mid, rh, lux, ws, None, c) < target:
            lo = mid
        else:
            hi = mid
    return round(hi, 1)
