import pytest
from django.core.cache import caches


@pytest.fixture(autouse=True)
def clear_provider_caches():
    for alias in ("default", "weather", "tiles"):
        caches[alias].clear()
    yield
