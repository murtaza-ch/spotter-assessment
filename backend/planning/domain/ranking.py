"""Distance-weighted segment exposure and the brief's lexicographic ranking."""

from dataclasses import dataclass
from math import inf

from planning.domain.checkpoints import METERS_PER_MILE
from planning.domain.risk import segment_risk
from planning.domain.types import Checkpoint, RiskLevel


@dataclass(frozen=True, slots=True)
class RouteSummary:
    miles_by_risk: dict[RiskLevel, float]
    average_risk: float | None
    maximum_risk: RiskLevel
    eligible: bool


def summarize(checkpoints: list[Checkpoint], risks: list[RiskLevel]) -> RouteSummary:
    if len(checkpoints) != len(risks) or len(checkpoints) < 2:
        raise ValueError("Each route requires at least two checkpoints with matching risk values.")
    miles_by_risk = dict.fromkeys(RiskLevel, 0.0)
    for index in range(len(checkpoints) - 1):
        miles = (
            checkpoints[index + 1].distance_m - checkpoints[index].distance_m
        ) / METERS_PER_MILE
        miles_by_risk[segment_risk(risks[index], risks[index + 1])] += miles
    total_miles = sum(miles_by_risk.values())
    unknown = miles_by_risk[RiskLevel.UNKNOWN] > 0
    blocked = miles_by_risk[RiskLevel.NO_TRAVEL] > 0
    average = (
        sum(int(level) * miles for level, miles in miles_by_risk.items()) / total_miles
        if total_miles and not unknown
        else None
    )
    maximum = RiskLevel.NO_TRAVEL if blocked else RiskLevel.UNKNOWN if unknown else max(risks)
    return RouteSummary(miles_by_risk, average, maximum, not unknown and not blocked)


def ranking_key(summary: RouteSummary, duration_s: float) -> tuple[float, ...]:
    return (
        0 if summary.eligible else 1,
        summary.miles_by_risk[RiskLevel.SEVERE],
        summary.miles_by_risk[RiskLevel.HIGH],
        summary.average_risk if summary.average_risk is not None else inf,
        duration_s,
    )
