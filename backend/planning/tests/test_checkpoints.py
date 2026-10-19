from datetime import UTC, datetime, timedelta

import pytest

from planning.domain.analysis import analyze_route
from planning.domain.checkpoints import METERS_PER_MILE, corridor_grid, sample_checkpoints
from planning.domain.ranking import RouteSummary, ranking_key, summarize
from planning.domain.types import Coordinate, RiskLevel, Route, RoutePoint, Weather

DEPARTURE = datetime(2026, 10, 20, 10, tzinfo=UTC)


def make_route(miles: float = 60) -> Route:
    length = miles * METERS_PER_MILE
    return Route(
        (
            RoutePoint(Coordinate(40, -90), 0, 0),
            RoutePoint(Coordinate(40.2, -89.8), length / 2, 2700),
            RoutePoint(Coordinate(40.4, -89.6), length, 3600),
        ),
        length,
        3600,
    )


def test_sampling_preserves_partial_final_segment_and_provider_progress() -> None:
    checkpoints = sample_checkpoints(make_route(), 25, DEPARTURE)
    assert [point.distance_m / METERS_PER_MILE for point in checkpoints] == pytest.approx(
        [0, 25, 50, 60]
    )
    assert checkpoints[1].arrival_at == DEPARTURE + timedelta(seconds=2250)
    assert checkpoints[-1].arrival_at == DEPARTURE + timedelta(hours=1)


def test_exact_distance_does_not_duplicate_destination() -> None:
    checkpoints = sample_checkpoints(make_route(50), 25, DEPARTURE)
    assert len(checkpoints) == 3


@pytest.mark.parametrize("interval", [10, 25, 50])
def test_all_spacing_options_preserve_distance_and_destination(interval: int) -> None:
    route = make_route(63)
    points = sample_checkpoints(route, interval, DEPARTURE)
    assert points[1].distance_m == pytest.approx(interval * METERS_PER_MILE)
    assert points[-1].coordinate == route.points[-1].coordinate
    assert points[-1].arrival_at == DEPARTURE + timedelta(seconds=route.duration_s)


def test_stationary_final_interval_preserves_destination_arrival() -> None:
    route = make_route(50)
    last = route.points[-1]
    route = Route(
        route.points[:-1] + (RoutePoint(last.coordinate, last.distance_m, 3000), last),
        route.distance_m,
        route.duration_s,
    )
    points = sample_checkpoints(route, 25, DEPARTURE)
    assert points[-1].arrival_at == DEPARTURE + timedelta(seconds=3600)


def test_nearly_exact_interval_still_includes_the_actual_destination() -> None:
    route = make_route(50 + 0.005 / METERS_PER_MILE)
    points = sample_checkpoints(route, 25, DEPARTURE)
    assert len(points) == 3
    assert points[-1].distance_m == route.distance_m
    assert points[-1].coordinate == route.points[-1].coordinate


def test_analysis_keeps_full_segment_geometry_and_applies_load_rules() -> None:
    route = make_route()
    points = sample_checkpoints(route, 50, DEPARTURE)
    analysis = analyze_route(route, points, [Weather(40, 0, 0)] * len(points), 40001)
    assert route.points[1].coordinate in analysis.segments[0].coordinates
    assert all(segment.risk == RiskLevel.SEVERE for segment in analysis.segments)
    assert analysis.summary.miles_by_risk[RiskLevel.SEVERE] == pytest.approx(60)


def test_summary_weights_miles_and_uses_worse_segment_endpoint() -> None:
    checkpoints = sample_checkpoints(make_route(), 25, DEPARTURE)
    summary = summarize(
        checkpoints, [RiskLevel.LOW, RiskLevel.LOW, RiskLevel.HIGH, RiskLevel.SEVERE]
    )
    assert summary.miles_by_risk[RiskLevel.LOW] == pytest.approx(25)
    assert summary.miles_by_risk[RiskLevel.HIGH] == pytest.approx(25)
    assert summary.miles_by_risk[RiskLevel.SEVERE] == pytest.approx(10)
    assert summary.average_risk == pytest.approx(80 / 60)
    assert summary.eligible


@pytest.mark.parametrize("hazard", [RiskLevel.UNKNOWN, RiskLevel.NO_TRAVEL])
def test_unknown_and_no_travel_make_route_ineligible(hazard: RiskLevel) -> None:
    checkpoints = sample_checkpoints(make_route(), 50, DEPARTURE)
    summary = summarize(checkpoints, [RiskLevel.LOW, hazard, RiskLevel.LOW])
    assert not summary.eligible


def test_ranking_prioritizes_severe_miles_before_high_miles_and_duration() -> None:
    checkpoints = sample_checkpoints(make_route(50), 25, DEPARTURE)
    high = summarize(checkpoints, [RiskLevel.HIGH] * 3)
    severe = summarize(checkpoints, [RiskLevel.SEVERE, RiskLevel.LOW, RiskLevel.LOW])
    assert ranking_key(high, 10000) < ranking_key(severe, 100)
    assert ranking_key(high, 100) < ranking_key(high, 200)


@pytest.mark.parametrize(
    ("preferred", "rejected"),
    [
        ((0, 10, 2.0, 9000), (1, 0, 0.5, 100)),
        ((2, 1, 2.0, 9000), (2, 3, 0.5, 100)),
        ((2, 3, 0.5, 9000), (2, 3, 1.0, 100)),
        ((2, 3, 1.0, 100), (2, 3, 1.0, 9000)),
    ],
)
def test_every_recommendation_tie_breaker(preferred: tuple, rejected: tuple) -> None:
    def key(values: tuple) -> tuple[float, ...]:
        severe, high, average, duration = values
        miles = dict.fromkeys(RiskLevel, 0.0)
        miles.update({RiskLevel.SEVERE: severe, RiskLevel.HIGH: high})
        return ranking_key(RouteSummary(miles, average, RiskLevel.SEVERE, True), duration)

    assert key(preferred) < key(rejected)


def test_corridor_grid_is_bounded_and_extends_beyond_route_centerline() -> None:
    grid = corridor_grid([make_route()], max_points=120)
    assert 0 < len(grid) <= 120
    assert min(point.latitude for point in grid) < 40
