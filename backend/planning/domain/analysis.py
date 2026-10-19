"""Analyze complete route geometry before any transport-specific simplification."""

from bisect import bisect_left, bisect_right
from dataclasses import dataclass

from planning.domain.ranking import RouteSummary, summarize
from planning.domain.risk import classify_weather, segment_risk
from planning.domain.types import Checkpoint, Coordinate, RiskLevel, Route, Weather


@dataclass(frozen=True, slots=True)
class AnalyzedCheckpoint:
    checkpoint: Checkpoint
    weather: Weather
    risk: RiskLevel


@dataclass(frozen=True, slots=True)
class AnalyzedSegment:
    coordinates: tuple[Coordinate, ...]
    distance_m: float
    risk: RiskLevel


@dataclass(frozen=True, slots=True)
class RouteAnalysis:
    route: Route
    checkpoints: tuple[AnalyzedCheckpoint, ...]
    segments: tuple[AnalyzedSegment, ...]
    summary: RouteSummary


def analyze_route(
    route: Route,
    checkpoints: list[Checkpoint],
    weather: list[Weather],
    load_weight_lb: int,
) -> RouteAnalysis:
    if len(checkpoints) != len(weather):
        raise ValueError("Every checkpoint requires a weather value, including Unknown.")
    risks = [classify_weather(value, load_weight_lb) for value in weather]
    distances = [point.distance_m for point in route.points]
    segments = []
    for index, (start, finish) in enumerate(zip(checkpoints, checkpoints[1:], strict=False)):
        first = bisect_right(distances, start.distance_m)
        last = bisect_left(distances, finish.distance_m)
        segments.append(
            AnalyzedSegment(
                (start.coordinate,)
                + tuple(point.coordinate for point in route.points[first:last])
                + (finish.coordinate,),
                finish.distance_m - start.distance_m,
                segment_risk(risks[index], risks[index + 1]),
            )
        )
    return RouteAnalysis(
        route,
        tuple(
            AnalyzedCheckpoint(checkpoint, value, risk)
            for checkpoint, value, risk in zip(checkpoints, weather, risks, strict=True)
        ),
        tuple(segments),
        summarize(checkpoints, risks),
    )
