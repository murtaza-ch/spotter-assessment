from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import httpx
import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from planning.domain.types import Coordinate
from planning.models import TripPlan
from planning.providers.weather import OpenMeteoClient, coordinate_key


def trip_body() -> dict:
    return {
        "origin": "Chicago, IL",
        "destination": "Detroit, MI",
        "departure_at": (timezone.now() + timedelta(hours=2)).isoformat(),
        "load_weight_lb": 35000,
        "sample_interval_miles": 25,
    }


def upstream_response(request: httpx.Request) -> httpx.Response:
    if "/geocode/" in request.url.path:
        origin = "Chicago" in request.url.path
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "address": {"freeformAddress": "Chicago" if origin else "Detroit"},
                        "position": {
                            "lat": 41.8 if origin else 42.3,
                            "lon": -87.6 if origin else -83.0,
                        },
                    }
                ]
            },
        )
    if "/calculateRoute/" in request.url.path:
        routes = []
        for index in range(3):
            routes.append(
                {
                    "summary": {
                        "lengthInMeters": 100000 + index * 10000,
                        "travelTimeInSeconds": 3600 + index * 600,
                    },
                    "legs": [
                        {
                            "points": [
                                {"latitude": 41.8, "longitude": -87.6},
                                {"latitude": 42 + index * 0.1, "longitude": -85},
                                {"latitude": 42.3, "longitude": -83},
                            ]
                        }
                    ],
                    "progress": [
                        {"pointIndex": 0, "distanceInMeters": 0, "travelTimeInSeconds": 0},
                        {
                            "pointIndex": 2,
                            "distanceInMeters": 100000 + index * 10000,
                            "travelTimeInSeconds": 3600 + index * 600,
                        },
                    ],
                }
            )
        return httpx.Response(200, json={"routes": routes})
    start = datetime.fromisoformat(request.url.params["start_hour"]).replace(tzinfo=UTC)
    end = datetime.fromisoformat(request.url.params["end_hour"]).replace(tzinfo=UTC)
    hours = list(range(int(start.timestamp()), int(end.timestamp()) + 1, 3600))
    response = {
        "hourly_units": {
            "wind_speed_10m": "mp/h",
            "rain": "inch",
            "showers": "inch",
            "snowfall": "inch",
        },
        "hourly": {
            "time": hours,
            "wind_speed_10m": [20] * len(hours),
            "rain": [0] * len(hours),
            "showers": [0] * len(hours),
            "snowfall": [0] * len(hours),
            "temperature_2m": [60] * len(hours),
        },
    }
    return httpx.Response(200, json=[response for _ in request.url.params["latitude"].split(",")])


@pytest.mark.django_db
def test_complete_plan_and_49_hour_forecast_use_the_http_adapters(settings) -> None:
    settings.TOMTOM_API_KEY = "test-key"
    transport = httpx.MockTransport(upstream_response)
    with patch(
        "planning.services.make_client", side_effect=lambda: httpx.Client(transport=transport)
    ):
        client = APIClient()
        response = client.post(reverse("planning:plans"), trip_body(), format="json")
        assert response.status_code == 200, response.data
        plan = response.json()
        assert len(plan["routes"]) == 3
        assert plan["recommended_route_id"] == "route-1"
        assert sum(plan["routes"][0]["summary"]["miles_by_risk"].values()) == pytest.approx(
            plan["routes"][0]["distance_miles"]
        )
        assert TripPlan.objects.count() == 1
        forecast = client.get(reverse("planning:forecast", kwargs={"plan_id": plan["id"]}))
        assert forecast.status_code == 200
        assert len(forecast.json()["hours"]) == 49
        assert len(forecast.json()["risk_frames"]) == 49
        assert all(risk == 0 for frame in forecast.json()["risk_frames"] for risk in frame)
        # The saved forecast can be served without making further upstream requests.
        with patch(
            "planning.services.make_client", side_effect=AssertionError("Unexpected provider call")
        ):
            assert (
                client.get(reverse("planning:forecast", kwargs={"plan_id": plan["id"]})).status_code
                == 200
            )


@pytest.mark.parametrize(
    "change",
    [
        {"load_weight_lb": -1},
        {"sample_interval_miles": 15},
        {"destination": "Chicago, IL"},
        {"departure_at": "2026-10-20T08:00:00"},
        {"departure_at": "2020-01-01T00:00:00Z"},
    ],
)
def test_invalid_trip_is_rejected_before_provider_or_database_access(change: dict) -> None:
    response = APIClient().post(reverse("planning:plans"), {**trip_body(), **change}, format="json")
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_trip"


@pytest.mark.django_db
def test_expired_plan_has_a_clear_error() -> None:
    record = TripPlan.objects.create(expires_at=timezone.now() - timedelta(minutes=1), result={})
    response = APIClient().get(reverse("planning:forecast", kwargs={"plan_id": record.id}))
    assert response.status_code == 404
    assert response.json()["code"] == "plan_expired"


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("wind", "load", "expected_risk"), [(55, 0, 4), (50, 35000, 4), (None, 0, -1)]
)
def test_api_never_recommends_blocked_or_unknown_routes(
    settings, wind, load, expected_risk
) -> None:
    settings.TOMTOM_API_KEY = "test-key"

    def upstream(request: httpx.Request) -> httpx.Response:
        response = upstream_response(request)
        if request.url.host == "api.open-meteo.com":
            data = response.json()
            for forecast in data:
                forecast["hourly"]["wind_speed_10m"] = [wind] * len(forecast["hourly"]["time"])
            return httpx.Response(200, json=data)
        return response

    transport = httpx.MockTransport(upstream)
    with patch(
        "planning.services.make_client", side_effect=lambda: httpx.Client(transport=transport)
    ):
        response = APIClient().post(
            reverse("planning:plans"), {**trip_body(), "load_weight_lb": load}, format="json"
        )
    assert response.status_code == 200
    plan = response.json()
    assert plan["recommended_route_id"] is None
    assert all(not route["summary"]["eligible"] for route in plan["routes"])
    assert all(route["summary"]["maximum_risk"] == expected_risk for route in plan["routes"])


def test_one_failed_weather_batch_preserves_unknown_and_other_locations() -> None:
    def upstream(request: httpx.Request) -> httpx.Response:
        if len(request.url.params["latitude"].split(",")) == 1:
            return httpx.Response(429)
        return upstream_response(request)

    coordinates = [Coordinate(40 + index * 0.01, -90) for index in range(41)]
    start = datetime(2026, 10, 20, 10, tzinfo=UTC)
    with httpx.Client(transport=httpx.MockTransport(upstream)) as client:
        forecasts, warnings = OpenMeteoClient(client).forecasts(coordinates, start, start)
    assert len(forecasts) == 41
    assert (
        sum(forecasts[coordinate_key(point)].at(start).wind_mph == 20 for point in coordinates)
        == 40
    )
    assert forecasts[coordinate_key(coordinates[-1])].at(start).wind_mph is None
    assert warnings
