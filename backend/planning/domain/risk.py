"""Assessment thresholds. Hourly precipitation amounts are interpreted as in/hour."""

from math import isfinite

from planning.domain.types import RiskLevel, Weather


def classify_weather(weather: Weather, load_weight_lb: int) -> RiskLevel:
    values = (weather.wind_mph, weather.rain_in, weather.snow_in)
    valid = [value is not None and isfinite(value) and value >= 0 for value in values]
    wind, rain, snow = values
    levels: list[RiskLevel] = []

    if valid[0] and wind is not None:
        if wind >= 55 or (wind >= 45 and load_weight_lb > 30_000):
            return RiskLevel.NO_TRAVEL
        if wind >= 45 or (wind >= 35 and load_weight_lb > 40_000):
            levels.append(RiskLevel.SEVERE)
        elif wind >= 35:
            levels.append(RiskLevel.HIGH)
        elif wind >= 25:
            levels.append(RiskLevel.MODERATE)
        else:
            levels.append(RiskLevel.LOW)

    for value, usable, thresholds in (
        (rain, valid[1], (0.10, 0.25, 0.50, 1.00)),
        (snow, valid[2], (0.50, 1.00, 2.00, 3.00)),
    ):
        if not usable or value is None:
            continue
        if value > thresholds[3]:
            return RiskLevel.NO_TRAVEL
        if value >= thresholds[2]:
            levels.append(RiskLevel.SEVERE)
        elif value >= thresholds[1]:
            levels.append(RiskLevel.HIGH)
        elif value >= thresholds[0]:
            levels.append(RiskLevel.MODERATE)
        else:
            levels.append(RiskLevel.LOW)

    return max(levels) if all(valid) else RiskLevel.UNKNOWN


def segment_risk(start: RiskLevel, end: RiskLevel) -> RiskLevel:
    """Use the worse endpoint; unknown data cannot establish that a segment is safe."""
    if RiskLevel.NO_TRAVEL in (start, end):
        return RiskLevel.NO_TRAVEL
    if RiskLevel.UNKNOWN in (start, end):
        return RiskLevel.UNKNOWN
    return max(start, end)
