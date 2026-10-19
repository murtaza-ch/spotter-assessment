"""Coordinate providers and pure planning calculations outside database transactions."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import UUID

from django.utils import timezone

from planning.domain.analysis import analyze_route
from planning.domain.checkpoints import (
    corridor_grid,
    distance_m,
    sample_checkpoints,
)
from planning.domain.ranking import ranking_key
from planning.domain.risk import classify_weather
from planning.domain.types import Coordinate, Route, RoutePoint, TripRequest
from planning.models import TripPlan
from planning.presentation import route_payload
from planning.providers.errors import ProviderError
from planning.providers.http import make_client
from planning.providers.tomtom import TomTomClient
from planning.providers.weather import OpenMeteoClient, coordinate_key

PLAN_LIFETIME = timedelta(minutes=30)
MAX_WEATHER_LOCATIONS = 380


def create_plan(trip: TripRequest) -> dict:
    with make_client() as client:
        routing = TomTomClient(client)
        with ThreadPoolExecutor(max_workers=2) as executor:
            origin_task = executor.submit(routing.geocode, trip.origin)
            destination_task = executor.submit(routing.geocode, trip.destination)
            origins, destinations = origin_task.result(), destination_task.result()
        if not origins or not destinations:
            raise ProviderError(
                "An address could not be found. Add a city, state, or country and try again.",
                code="location_not_found",
                status_code=422,
            )
        origin, destination = origins[0], destinations[0]
        if distance_m(origin.coordinate, destination.coordinate) < 100:
            raise ProviderError(
                "Origin and destination resolve to the same place. Choose different locations.",
                status_code=422,
            )
        routes = routing.routes(origin, destination, trip.departure_at)
        samples = [
            sample_checkpoints(route, trip.sample_interval_miles, trip.departure_at)
            for route in routes
        ]
        locations = [checkpoint.coordinate for checkpoints in samples for checkpoint in checkpoints]
        if len({coordinate_key(point) for point in locations}) > MAX_WEATHER_LOCATIONS:
            raise ProviderError(
                "This trip needs too many weather samples. "
                "Choose a 25- or 50-mile interval, or a shorter trip.",
                code="trip_too_large",
                status_code=422,
            )
        end = max(checkpoints[-1].arrival_at for checkpoints in samples) + timedelta(hours=1)
        forecasts, warnings = OpenMeteoClient(client).forecasts(locations, trip.departure_at, end)

    analyses = []
    for index, (route, checkpoints) in enumerate(zip(routes, samples, strict=True)):
        weather = [
            forecasts[coordinate_key(point.coordinate)].at(point.arrival_at)
            for point in checkpoints
        ]
        analysis = analyze_route(route, checkpoints, weather, trip.load_weight_lb)
        analyses.append(
            (ranking_key(analysis.summary, route.duration_s), route_payload(analysis, index + 1))
        )
    analyses.sort(key=lambda analysis: analysis[0])
    route_results = [result for _, result in analyses]
    recommended = next((route for route in route_results if route["summary"]["eligible"]), None)
    if len(routes) < 3:
        warnings.append(
            f"TomTom found {len(routes)} distinct truck routes for this trip; "
            "three are not always available."
        )
    if any(any(point["risk"] == -1 for point in route["checkpoints"]) for route in route_results):
        warnings.append(
            "Some checkpoint forecasts are incomplete. Unknown segments make a route ineligible."
        )
    result = {
        "origin": {"label": origin.label, "coordinates": origin.coordinate.as_geojson()},
        "destination": {
            "label": destination.label,
            "coordinates": destination.coordinate.as_geojson(),
        },
        "departure_at": trip.departure_at.isoformat(),
        "load_weight_lb": trip.load_weight_lb,
        "sample_interval_miles": trip.sample_interval_miles,
        "routes": route_results,
        "recommended_route_id": recommended["id"] if recommended else None,
        "recommendation_reason": (
            "Best eligible route by Severe miles, High miles, "
            "distance-weighted risk, then travel time."
            if recommended
            else "No route can be recommended: each has a No Travel segment or incomplete weather."
        ),
        "warnings": list(dict.fromkeys(warnings)),
    }
    TripPlan.objects.filter(expires_at__lt=timezone.now()).delete()
    record = TripPlan.objects.create(expires_at=timezone.now() + PLAN_LIFETIME, result=result)
    return {"id": str(record.id), **result}


def forecast_for_plan(plan_id: UUID) -> dict:
    record = TripPlan.objects.filter(id=plan_id, expires_at__gt=timezone.now()).first()
    if record is None:
        raise ProviderError(
            "This trip analysis has expired. Plan the trip again.",
            code="plan_expired",
            status_code=404,
        )
    if record.forecast is not None:
        return record.forecast
    result = record.result
    # Display geometry is enough to place a bounded, independent corridor grid.
    routes = []
    for route in result["routes"]:
        coordinates = [Coordinate(point[1], point[0]) for point in route["geometry"]]
        accumulated = [0.0]
        for start, end in zip(coordinates, coordinates[1:], strict=False):
            accumulated.append(accumulated[-1] + distance_m(start, end))
        total = accumulated[-1]
        routes.append(
            Route(
                tuple(
                    RoutePoint(point, value, 0)
                    for point, value in zip(coordinates, accumulated, strict=True)
                ),
                total,
                0,
            )
        )
    locations = corridor_grid(routes)
    departure = datetime.fromisoformat(result["departure_at"]).astimezone(UTC)
    hours = [departure + timedelta(hours=hour) for hour in range(49)]
    with make_client() as client:
        forecasts, warnings = OpenMeteoClient(client).forecasts(locations, hours[0], hours[-1])
    forecast = {
        "coordinates": [point.as_geojson() for point in locations],
        "hours": [hour.isoformat() for hour in hours],
        "risk_frames": [
            [
                int(
                    classify_weather(
                        forecasts[coordinate_key(point)].at(hour), result["load_weight_lb"]
                    )
                )
                for point in locations
            ]
            for hour in hours
        ],
        "corridor_half_width_miles": 25,
        "warnings": warnings,
    }
    record.forecast = forecast
    record.save(update_fields=["forecast"])
    return forecast
