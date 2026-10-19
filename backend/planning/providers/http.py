"""Bounded, reusable HTTP connections and sanitized provider errors."""

import time
from typing import Any

import httpx

from planning.providers.errors import ProviderError


def make_client() -> httpx.Client:
    return httpx.Client(
        timeout=httpx.Timeout(25, connect=5, pool=5),
        limits=httpx.Limits(max_connections=6, max_keepalive_connections=6),
        follow_redirects=False,
    )


def get_response(client: httpx.Client, url: str, params: Any, provider: str) -> httpx.Response:
    for attempt in range(2):
        try:
            response = client.get(url, params=params)
        except httpx.RequestError:
            if attempt == 0:
                continue
            raise ProviderError(f"{provider} could not be reached. Please try again.") from None
        if response.status_code in (401, 403):
            raise ProviderError(
                f"{provider} access was denied. Check the configured API key and product access.",
                code="provider_configuration",
                status_code=503,
            )
        if response.status_code == 429:
            raise ProviderError(
                f"{provider}'s request limit was reached. Please try again later.",
                code="provider_rate_limit",
                status_code=503,
            )
        if response.status_code >= 500 and attempt == 0:
            time.sleep(0.25)
            continue
        if not response.is_success:
            raise ProviderError(f"{provider} could not complete this request.")
        return response
    raise ProviderError(f"{provider} is temporarily unavailable.")


def get_json(client: httpx.Client, url: str, params: Any, provider: str) -> Any:
    response = get_response(client, url, params, provider)
    try:
        return response.json()
    except ValueError:
        raise ProviderError(f"{provider} returned an invalid response.") from None
