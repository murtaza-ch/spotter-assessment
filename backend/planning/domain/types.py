"""Provider-independent values. Distances and durations use SI units internally."""

from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum
from math import isfinite


class RiskLevel(IntEnum):
    UNKNOWN = -1
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4


RISK_LABELS = {
    RiskLevel.UNKNOWN: "Unknown",
    RiskLevel.LOW: "Low",
    RiskLevel.MODERATE: "Moderate",
    RiskLevel.HIGH: "High",
    RiskLevel.SEVERE: "Severe",
    RiskLevel.NO_TRAVEL: "No Travel",
}


@dataclass(frozen=True, slots=True)
class Coordinate:
    latitude: float
    longitude: float

    def __post_init__(self) -> None:
        if not (
            isfinite(self.latitude)
            and isfinite(self.longitude)
            and -90 <= self.latitude <= 90
            and -180 <= self.longitude <= 180
        ):
            raise ValueError("Coordinates must be finite latitude/longitude values.")

    def as_geojson(self) -> list[float]:
        return [self.longitude, self.latitude]


@dataclass(frozen=True, slots=True)
class Place:
    label: str
    coordinate: Coordinate


@dataclass(frozen=True, slots=True)
class RoutePoint:
    coordinate: Coordinate
    distance_m: float
    duration_s: float


@dataclass(frozen=True, slots=True)
class Route:
    points: tuple[RoutePoint, ...]
    distance_m: float
    duration_s: float


@dataclass(frozen=True, slots=True)
class Checkpoint:
    coordinate: Coordinate
    distance_m: float
    arrival_at: datetime


@dataclass(frozen=True, slots=True)
class Weather:
    wind_mph: float | None
    rain_in: float | None
    snow_in: float | None
    temperature_f: float | None = None


@dataclass(frozen=True, slots=True)
class TripRequest:
    origin: str
    destination: str
    departure_at: datetime
    load_weight_lb: int
    sample_interval_miles: int
