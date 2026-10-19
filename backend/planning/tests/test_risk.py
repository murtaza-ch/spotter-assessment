import math

import pytest

from planning.domain.risk import classify_weather, segment_risk
from planning.domain.types import RiskLevel, Weather


@pytest.mark.parametrize(
    ("wind", "load", "expected"),
    [
        (0, 0, 0),
        (24.999, 50000, 0),
        (25, 50000, 1),
        (34.999, 50000, 1),
        (35, 40000, 2),
        (35, 40001, 3),
        (44.999, 30000, 2),
        (45, 30000, 3),
        (45, 30001, 4),
        (54.999, 10000, 3),
        (55, 0, 4),
    ],
)
def test_wind_boundaries_and_load_overrides(wind: float, load: int, expected: int) -> None:
    assert classify_weather(Weather(wind, 0, 0), load) == expected


@pytest.mark.parametrize(
    ("rain", "expected"),
    [(0.099, 0), (0.1, 1), (0.249, 1), (0.25, 2), (0.499, 2), (0.5, 3), (1, 3), (1.001, 4)],
)
def test_rain_boundaries(rain: float, expected: int) -> None:
    assert classify_weather(Weather(0, rain, 0), 0) == expected


@pytest.mark.parametrize(
    ("snow", "expected"),
    [(0.499, 0), (0.5, 1), (0.999, 1), (1, 2), (1.999, 2), (2, 3), (3, 3), (3.001, 4)],
)
def test_snow_boundaries(snow: float, expected: int) -> None:
    assert classify_weather(Weather(0, 0, snow), 0) == expected


@pytest.mark.parametrize("invalid", [None, -1, math.nan, math.inf])
def test_incomplete_or_invalid_weather_is_unknown(invalid: float | None) -> None:
    assert classify_weather(Weather(invalid, 0, 0), 0) == RiskLevel.UNKNOWN


def test_known_no_travel_hazard_is_preserved_when_other_data_is_missing() -> None:
    assert classify_weather(Weather(55, None, None), 0) == RiskLevel.NO_TRAVEL
    assert classify_weather(Weather(None, 2, None), 0) == RiskLevel.NO_TRAVEL


def test_segment_uses_worse_endpoint_without_treating_unknown_as_low() -> None:
    assert segment_risk(RiskLevel.LOW, RiskLevel.HIGH) == RiskLevel.HIGH
    assert segment_risk(RiskLevel.UNKNOWN, RiskLevel.LOW) == RiskLevel.UNKNOWN
    assert segment_risk(RiskLevel.UNKNOWN, RiskLevel.NO_TRAVEL) == RiskLevel.NO_TRAVEL
