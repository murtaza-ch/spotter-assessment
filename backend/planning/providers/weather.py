"""Hourly Open-Meteo forecasts, fetched in bounded batches and cached by location/time."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from math import ceil, floor, isfinite

import httpx
from django.core.cache import caches

from planning.domain.types import Coordinate, Weather
from planning.providers.errors import ProviderError
from planning.providers.http import get_json

UNKNOWN_WEATHER = Weather(None, None, None)


def coordinate_key(coordinate: Coordinate) -> str:
    return f"{coordinate.latitude:.4f},{coordinate.longitude:.4f}"


@dataclass(frozen=True)
class Forecast:
    hours: dict[int, Weather]

    def at(self, at: datetime) -> Weather:
        timestamp = at.timestamp()
        lower_hour, upper_hour = floor(timestamp / 3600) * 3600, ceil(timestamp / 3600) * 3600
        before = self.hours.get(lower_hour, UNKNOWN_WEATHER)
        after = self.hours.get(upper_hour, UNKNOWN_WEATHER)
        ratio = (timestamp - lower_hour) / 3600

        def interpolate(start: float | None, end: float | None) -> float | None:
            return None if start is None or end is None else start + (end - start) * ratio

        # Precipitation is the amount during the preceding hour, not an instantaneous
        # measurement. Between hour boundaries use the containing forecast interval.
        return Weather(
            interpolate(before.wind_mph, after.wind_mph),
            after.rain_in,
            after.snow_in,
            interpolate(before.temperature_f, after.temperature_f),
        )


def optional_number(value: object) -> float | None:
    if value is None:
        return None
    number = float(value)
    return number if isfinite(number) else None


class OpenMeteoClient:
    def __init__(self, client: httpx.Client):
        self.client = client

    def forecasts(
        self, coordinates: list[Coordinate], start: datetime, end: datetime
    ) -> tuple[dict[str, Forecast], list[str]]:
        unique = {coordinate_key(point): point for point in coordinates}
        start_hour = datetime.fromtimestamp(floor(start.timestamp() / 3600) * 3600, UTC)
        end_hour = datetime.fromtimestamp(ceil(end.timestamp() / 3600) * 3600, UTC)
        prefix = f"{start_hour.isoformat()}:{end_hour.isoformat()}"
        weather_cache = caches["weather"]

        def cache_key(key: str) -> str:
            return "forecast:" + sha256(f"{prefix}:{key}".encode()).hexdigest()

        forecasts = {}
        missing = []
        for key, coordinate in unique.items():
            cached = weather_cache.get(cache_key(key))
            if cached is None:
                missing.append(coordinate)
            else:
                forecasts[key] = cached
        batches = [missing[index : index + 40] for index in range(0, len(missing), 40)]
        errors = []
        with ThreadPoolExecutor(max_workers=3) as executor:
            tasks = {
                executor.submit(self._batch, batch, start_hour, end_hour): batch
                for batch in batches
            }
            for future in as_completed(tasks):
                try:
                    values = future.result()
                except ProviderError as error:
                    errors.append(error)
                    continue
                forecasts.update(values)
                for key, value in values.items():
                    weather_cache.set(cache_key(key), value, timeout=900)
        if errors and not forecasts:
            raise errors[0]
        for key in unique:
            forecasts.setdefault(key, Forecast({}))
        warnings = (
            [
                "Some weather samples are unavailable. "
                "Routes with unknown segments are not recommended."
            ]
            if errors
            else []
        )
        return forecasts, warnings

    def _batch(
        self, coordinates: list[Coordinate], start: datetime, end: datetime
    ) -> dict[str, Forecast]:
        data = get_json(
            self.client,
            "https://api.open-meteo.com/v1/forecast",
            {
                "latitude": ",".join(str(point.latitude) for point in coordinates),
                "longitude": ",".join(str(point.longitude) for point in coordinates),
                "hourly": "wind_speed_10m,rain,showers,snowfall,temperature_2m",
                "wind_speed_unit": "mph",
                "precipitation_unit": "inch",
                "temperature_unit": "fahrenheit",
                "timezone": "UTC",
                "timeformat": "unixtime",
                "start_hour": start.strftime("%Y-%m-%dT%H:%M"),
                "end_hour": end.strftime("%Y-%m-%dT%H:%M"),
            },
            "Open-Meteo",
        )
        responses = data if isinstance(data, list) else [data]
        if len(responses) != len(coordinates):
            raise ProviderError("Open-Meteo returned an incomplete location batch.")
        try:
            return {
                coordinate_key(coordinate): parse_forecast(response)
                for coordinate, response in zip(coordinates, responses, strict=True)
            }
        except (KeyError, IndexError, TypeError, ValueError):
            raise ProviderError("Open-Meteo returned an invalid forecast response.") from None


def parse_forecast(response: dict) -> Forecast:
    hourly, units = response["hourly"], response["hourly_units"]
    if units.get("wind_speed_10m") != "mp/h" or units.get("rain") != "inch":
        raise ValueError("Unexpected forecast units")
    if units.get("snowfall") != "inch" or units.get("showers") != "inch":
        raise ValueError("Unexpected precipitation units")
    hours = {}
    for index, timestamp in enumerate(hourly["time"]):
        rain, showers = (
            optional_number(hourly["rain"][index]),
            optional_number(hourly["showers"][index]),
        )
        hours[int(timestamp)] = Weather(
            optional_number(hourly["wind_speed_10m"][index]),
            rain + showers if rain is not None and showers is not None else None,
            optional_number(hourly["snowfall"][index]),
            optional_number(hourly["temperature_2m"][index]),
        )
    return Forecast(hours)
