"""TomTom adapters. The routing v1 endpoint supports the truck travel profile."""

from bisect import bisect_right
from datetime import UTC, datetime
from hashlib import sha256
from math import isclose, isfinite
from urllib.parse import quote

import httpx
from django.conf import settings
from django.core.cache import cache

from planning.domain.checkpoints import distance_m
from planning.domain.types import Coordinate, Place, Route, RoutePoint
from planning.providers.errors import ProviderError
from planning.providers.http import get_json, get_response


def api_key() -> str:
    if not settings.TOMTOM_API_KEY:
        raise ProviderError(
            "Routing is not configured yet. Add TOMTOM_API_KEY to the backend environment.",
            code="provider_configuration",
            status_code=503,
        )
    return settings.TOMTOM_API_KEY


class TomTomClient:
    def __init__(self, client: httpx.Client):
        self.client = client

    def geocode(self, query: str) -> list[Place]:
        key = "geocode:" + sha256(query.casefold().encode()).hexdigest()
        cached = cache.get(key)
        if cached is not None:
            return cached
        data = get_json(
            self.client,
            f"https://api.tomtom.com/search/2/geocode/{quote(query, safe='')}.json",
            {"key": api_key(), "limit": 5, "language": "en-US"},
            "TomTom geocoding",
        )
        try:
            places = [
                Place(
                    result["address"]["freeformAddress"],
                    Coordinate(float(result["position"]["lat"]), float(result["position"]["lon"])),
                )
                for result in data["results"]
            ]
        except (KeyError, TypeError, ValueError):
            raise ProviderError("TomTom returned an invalid location response.") from None
        cache.set(key, places, timeout=3600)
        return places

    def routes(self, origin: Place, destination: Place, departure_at: datetime) -> list[Route]:
        coordinates = (
            f"{origin.coordinate.latitude},{origin.coordinate.longitude}:"
            f"{destination.coordinate.latitude},{destination.coordinate.longitude}"
        )
        departure = departure_at.astimezone(UTC).isoformat(timespec="seconds")
        cache_key = "routes:" + sha256(f"{coordinates}:{departure}".encode()).hexdigest()
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        params = [
            ("key", api_key()),
            ("travelMode", "truck"),
            ("maxAlternatives", "2"),
            ("alternativeType", "anyRoute"),
            ("departAt", departure),
            ("routeType", "fastest"),
            ("extendedRouteRepresentation", "distance"),
            ("extendedRouteRepresentation", "travelTime"),
        ]
        # Cargo weight is used by the assessment's weather rules. It is not the
        # vehicle's gross weight, so it must not be passed as TomTom vehicleWeight.
        data = get_json(
            self.client,
            f"https://api.tomtom.com/routing/1/calculateRoute/{coordinates}/json",
            params,
            "TomTom routing",
        )
        try:
            routes = [parse_route(route) for route in data["routes"][:3]]
        except (KeyError, TypeError, ValueError, IndexError, ZeroDivisionError):
            raise ProviderError("TomTom returned incomplete route progress data.") from None
        if not routes:
            raise ProviderError(
                "No truck route was found between these locations.", status_code=422
            )
        cache.set(cache_key, routes, timeout=300)
        return routes

    def tile(self, zoom: int, x: int, y: int) -> bytes:
        response = get_response(
            self.client,
            f"https://api.tomtom.com/map/1/tile/basic/main/{zoom}/{x}/{y}.png",
            {"key": api_key(), "tileSize": 256, "language": "en-US"},
            "TomTom maps",
        )
        if not response.headers.get("content-type", "").startswith("image/"):
            raise ProviderError("The map provider returned an invalid tile.")
        return response.content


def parse_route(data: dict) -> Route:
    coordinates = [
        Coordinate(float(point["latitude"]), float(point["longitude"]))
        for leg in data["legs"]
        for point in leg["points"]
    ]
    progress = data["progress"]
    if len(coordinates) < 2 or len(progress) < 2:
        raise ValueError("Missing route geometry or progress")
    if progress[0]["pointIndex"] != 0 or progress[-1]["pointIndex"] != len(coordinates) - 1:
        raise ValueError("Route progress does not cover the complete geometry")
    indexes = [point["pointIndex"] for point in progress]
    length = float(data["summary"]["lengthInMeters"])
    duration = float(data["summary"]["travelTimeInSeconds"])
    distances = [float(point["distanceInMeters"]) for point in progress]
    durations = [float(point["travelTimeInSeconds"]) for point in progress]
    if (
        not all(type(index) is int and 0 <= index < len(coordinates) for index in indexes)
        or any(after <= before for before, after in zip(indexes, indexes[1:], strict=False))
        or not all(isfinite(value) and value >= 0 for value in distances + durations)
        or any(after < before for before, after in zip(distances, distances[1:], strict=False))
        or any(after < before for before, after in zip(durations, durations[1:], strict=False))
        or not isfinite(length)
        or not isfinite(duration)
        or length <= 0
        or duration <= 0
        or distances[0] != 0
        or durations[0] != 0
        or not isclose(distances[-1], length, abs_tol=1, rel_tol=1e-6)
        or not isclose(durations[-1], duration, abs_tol=1, rel_tol=1e-6)
    ):
        raise ValueError("Invalid cumulative route progress")
    geometric_distances = [0.0]
    for before, after in zip(coordinates, coordinates[1:], strict=False):
        geometric_distances.append(geometric_distances[-1] + distance_m(before, after))
    points = []
    for index, coordinate in enumerate(coordinates):
        upper = min(max(1, bisect_right(indexes, index)), len(progress) - 1)
        start, end = progress[upper - 1], progress[upper]
        start_m = geometric_distances[start["pointIndex"]]
        span_m = geometric_distances[end["pointIndex"]] - start_m
        # A stationary interval can still contain elapsed travel time. Preserve its
        # final anchor even when two consecutive coordinates have zero distance.
        ratio = (
            (geometric_distances[index] - start_m) / span_m
            if span_m
            else (index - start["pointIndex"]) / (end["pointIndex"] - start["pointIndex"])
        )
        points.append(
            RoutePoint(
                coordinate,
                distances[upper - 1] + ratio * (distances[upper] - distances[upper - 1]),
                durations[upper - 1] + ratio * (durations[upper] - durations[upper - 1]),
            )
        )
    return Route(tuple(points), length, duration)
