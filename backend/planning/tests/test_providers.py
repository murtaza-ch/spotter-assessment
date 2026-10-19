from datetime import UTC, datetime

import httpx
import pytest

from planning.domain.types import Weather
from planning.providers.errors import ProviderError
from planning.providers.http import get_json
from planning.providers.tomtom import parse_route
from planning.providers.weather import Forecast, parse_forecast


def test_tomtom_interpolates_missing_progress_using_geometry_not_point_count() -> None:
    route = parse_route(
        {
            "summary": {"lengthInMeters": 900, "travelTimeInSeconds": 1800},
            "legs": [
                {
                    "points": [
                        {"latitude": 0, "longitude": 0},
                        {"latitude": 0.001, "longitude": 0},
                        {"latitude": 0.003, "longitude": 0},
                    ]
                }
            ],
            "progress": [
                {"pointIndex": 0, "distanceInMeters": 0, "travelTimeInSeconds": 0},
                {"pointIndex": 2, "distanceInMeters": 900, "travelTimeInSeconds": 1800},
            ],
        }
    )
    assert route.points[1].distance_m == pytest.approx(300)
    assert route.points[1].duration_s == pytest.approx(600)


def test_weather_interpolates_wind_but_uses_containing_precipitation_hour() -> None:
    start = datetime(2026, 10, 20, 10, tzinfo=UTC)
    first = int(start.timestamp())
    forecast = Forecast({first: Weather(10, 0, 0), first + 3600: Weather(30, 0.5, 1)})
    at_half_hour = forecast.at(start.replace(minute=30))
    assert at_half_hour.wind_mph == 20
    assert at_half_hour.rain_in == 0.5
    assert at_half_hour.snow_in == 1
    assert forecast.at(start).rain_in == 0


def test_weather_adds_convective_showers_to_rain() -> None:
    forecast = parse_forecast(
        {
            "hourly_units": {
                "wind_speed_10m": "mp/h",
                "rain": "inch",
                "showers": "inch",
                "snowfall": "inch",
            },
            "hourly": {
                "time": [0],
                "wind_speed_10m": [20],
                "rain": [0.1],
                "showers": [0.2],
                "snowfall": [1],
                "temperature_2m": [60],
            },
        }
    )
    assert forecast.hours[0].rain_in == pytest.approx(0.3)
    assert forecast.hours[0].snow_in == 1


def test_missing_hour_stays_unknown() -> None:
    assert Forecast({}).at(datetime.now(UTC)) == Weather(None, None, None)


def stationary_route_response() -> dict:
    return {
        "summary": {"lengthInMeters": 900, "travelTimeInSeconds": 1800},
        "legs": [
            {
                "points": [
                    {"latitude": 40, "longitude": -90},
                    {"latitude": 40.01, "longitude": -90},
                    {"latitude": 40.01, "longitude": -90},
                ]
            }
        ],
        "progress": [
            {"pointIndex": 0, "distanceInMeters": 0, "travelTimeInSeconds": 0},
            {"pointIndex": 1, "distanceInMeters": 900, "travelTimeInSeconds": 1500},
            {"pointIndex": 2, "distanceInMeters": 900, "travelTimeInSeconds": 1800},
        ],
    }


def test_tomtom_preserves_elapsed_time_at_repeated_final_coordinate() -> None:
    route = parse_route(stationary_route_response())
    assert route.points[-1].duration_s == 1800
    assert route.points[-2].duration_s == 1500


@pytest.mark.parametrize("invalid", ["nonfinite", "unordered", "summary_mismatch", "coordinate"])
def test_tomtom_rejects_invalid_progress_before_analysis(invalid: str) -> None:
    data = stationary_route_response()
    if invalid == "nonfinite":
        data["progress"][1]["distanceInMeters"] = float("nan")
    elif invalid == "unordered":
        data["progress"][1]["pointIndex"] = 2
    elif invalid == "summary_mismatch":
        data["summary"]["travelTimeInSeconds"] = 9000
    else:
        data["legs"][0]["points"][0]["latitude"] = float("inf")
    with pytest.raises(ValueError):
        parse_route(data)


@pytest.mark.parametrize("status", [401, 403, 429, 500])
def test_upstream_errors_never_expose_credentials(status: int) -> None:
    transport = httpx.MockTransport(
        lambda request: httpx.Response(status, json={"key": "private-test-key"})
    )
    with httpx.Client(transport=transport) as client, pytest.raises(ProviderError) as error:
        get_json(client, "https://example.com/route", {"key": "private-test-key"}, "Routing")
    assert "private-test-key" not in str(error.value)
