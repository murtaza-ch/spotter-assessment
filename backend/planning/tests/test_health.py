from django.urls import reverse
from drf_spectacular.generators import SchemaGenerator
from rest_framework import status
from rest_framework.test import APIClient


def test_health_is_public_and_does_not_access_the_database() -> None:
    # pytest-django blocks database access unless the test explicitly enables it.
    response = APIClient().get(reverse("planning:health"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok", "service": "spotter-api"}


def test_health_does_not_accept_writes() -> None:
    response = APIClient().post(reverse("planning:health"), {}, format="json")

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


def test_openapi_describes_the_public_health_contract() -> None:
    schema = SchemaGenerator().get_schema(public=True)
    operation = schema["paths"]["/health/"]["get"]

    assert operation["operationId"] == "get_health"
    assert "security" not in operation
    assert "200" in operation["responses"]
