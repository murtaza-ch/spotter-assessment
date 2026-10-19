"""Distance sampling with ETAs interpolated from routing-provider progress data."""

from bisect import bisect_right
from datetime import datetime, timedelta
from math import asin, atan2, cos, degrees, radians, sin, sqrt

from planning.domain.types import Checkpoint, Coordinate, Route, RoutePoint

METERS_PER_MILE = 1609.344
EARTH_RADIUS_M = 6_371_008.8


def distance_m(start: Coordinate, end: Coordinate) -> float:
    latitude_delta = radians(end.latitude - start.latitude)
    longitude_delta = radians(end.longitude - start.longitude)
    a = (
        sin(latitude_delta / 2) ** 2
        + cos(radians(start.latitude)) * cos(radians(end.latitude)) * sin(longitude_delta / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * asin(min(1, sqrt(a)))


def point_at_distance(route: Route, target_m: float) -> RoutePoint:
    if target_m <= 0:
        return route.points[0]
    if target_m >= route.distance_m:
        return route.points[-1]
    index = min(
        bisect_right(route.points, target_m, key=lambda point: point.distance_m),
        len(route.points) - 1,
    )
    before, after = route.points[index - 1], route.points[index]
    span = after.distance_m - before.distance_m
    ratio = min(1.0, max(0.0, (target_m - before.distance_m) / span)) if span else 0
    # Handle a short crossing of the antimeridian without interpolating around the globe.
    longitude_delta = (after.coordinate.longitude - before.coordinate.longitude + 180) % 360 - 180
    return RoutePoint(
        Coordinate(
            before.coordinate.latitude
            + (after.coordinate.latitude - before.coordinate.latitude) * ratio,
            (before.coordinate.longitude + longitude_delta * ratio + 180) % 360 - 180,
        ),
        target_m,
        before.duration_s + (after.duration_s - before.duration_s) * ratio,
    )


def sample_checkpoints(
    route: Route, interval_miles: int, departure_at: datetime
) -> list[Checkpoint]:
    if interval_miles not in (10, 25, 50):
        raise ValueError("Checkpoint interval must be 10, 25, or 50 miles.")
    if departure_at.tzinfo is None:
        raise ValueError("Departure must include a timezone.")
    step_m = interval_miles * METERS_PER_MILE
    targets = [index * step_m for index in range(int(route.distance_m // step_m) + 1)]
    if route.distance_m - targets[-1] > 0.01:
        targets.append(route.distance_m)
    else:
        targets[-1] = route.distance_m
    return [
        Checkpoint(point.coordinate, target, departure_at + timedelta(seconds=point.duration_s))
        for target in targets
        for point in [point_at_distance(route, target)]
    ]


def offset_coordinate(point: Coordinate, bearing: float, offset_m: float) -> Coordinate:
    angular_distance = offset_m / EARTH_RADIUS_M
    latitude, longitude, angle = radians(point.latitude), radians(point.longitude), radians(bearing)
    result_latitude = asin(
        sin(latitude) * cos(angular_distance) + cos(latitude) * sin(angular_distance) * cos(angle)
    )
    result_longitude = longitude + atan2(
        sin(angle) * sin(angular_distance) * cos(latitude),
        cos(angular_distance) - sin(latitude) * sin(result_latitude),
    )
    return Coordinate(degrees(result_latitude), (degrees(result_longitude) + 180) % 360 - 180)


def corridor_grid(routes: list[Route], max_points: int = 120) -> list[Coordinate]:
    """Bounded model samples along and 25 miles to either side of all alternatives."""
    samples: dict[tuple[float, float], Coordinate] = {}
    stations_per_route = max(2, max_points // (3 * len(routes)))
    for route in routes:
        for index in range(stations_per_route):
            target = route.distance_m * index / (stations_per_route - 1)
            current = point_at_distance(route, target).coordinate
            nearby = point_at_distance(route, min(target + 1000, route.distance_m)).coordinate
            if nearby == current:
                nearby = point_at_distance(route, max(0, target - 1000)).coordinate
            heading = degrees(
                atan2(
                    (nearby.longitude - current.longitude) * cos(radians(current.latitude)),
                    nearby.latitude - current.latitude,
                )
            )
            for offset in (-25, 0, 25):
                point = offset_coordinate(current, heading + 90, offset * METERS_PER_MILE)
                key = (round(point.latitude, 3), round(point.longitude, 3))
                samples[key] = point
    return list(samples.values())[:max_points]
