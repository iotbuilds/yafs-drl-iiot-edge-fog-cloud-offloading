"""Seven-sensor threshold classification for predictive maintenance events."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Tuple

@dataclass(frozen=True)
class SensorThreshold:
    unit: str
    normal: Tuple[float, float]
    warning_low: Tuple[float, float] | None = None
    warning_high: Tuple[float, float] | None = None
    critical_low: Tuple[float, float] | None = None
    critical_high: Tuple[float, float] | None = None

THRESHOLDS: Dict[str, SensorThreshold] = {
    "vibration": SensorThreshold("mm/s RMS", (0.0, 4.5), warning_high=(4.5, 7.1), critical_high=(7.1, float("inf"))),
    "temperature": SensorThreshold("°C", (0.0, 70.0), warning_high=(70.0, 85.0), critical_high=(85.0, float("inf"))),
    "pressure": SensorThreshold("bar", (3.0, 8.0), warning_low=(2.0, 3.0), warning_high=(8.0, 10.0), critical_low=(-float("inf"), 2.0), critical_high=(10.0, float("inf"))),
    "current": SensorThreshold("A", (0.0, 15.0), warning_high=(15.0, 20.0), critical_high=(20.0, float("inf"))),
    "acoustic": SensorThreshold("dB", (0.0, 70.0), warning_high=(70.0, 85.0), critical_high=(85.0, float("inf"))),
    "flow_rate": SensorThreshold("L/min", (30.0, 100.0), warning_low=(20.0, 30.0), warning_high=(100.0, 120.0), critical_low=(-float("inf"), 20.0), critical_high=(120.0, float("inf"))),
    "humidity": SensorThreshold("%RH", (20.0, 65.0), warning_low=(-float("inf"), 20.0), warning_high=(65.0, 80.0), critical_high=(80.0, float("inf"))),
}

def _inside(interval, value: float) -> bool:
    if interval is None:
        return False
    lo, hi = interval
    return lo < value <= hi if lo != -float("inf") else value <= hi

def classify(sensor_type: str, value: float) -> str:
    t = THRESHOLDS[sensor_type]
    lo, hi = t.normal
    if lo <= value <= hi:
        return "normal"
    if _inside(t.critical_low, value) or _inside(t.critical_high, value):
        return "critical"
    if _inside(t.warning_low, value) or _inside(t.warning_high, value):
        return "warning"
    return "critical"

def unit(sensor_type: str) -> str:
    return THRESHOLDS[sensor_type].unit
