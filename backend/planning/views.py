from uuid import UUID

from django.core.cache import caches
from django.http import HttpRequest, HttpResponse
from django.views import View
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from planning.domain.types import TripRequest
from planning.providers.errors import ProviderError
from planning.providers.http import make_client
from planning.providers.tomtom import TomTomClient
from planning.serializers import (
    ErrorResponseSerializer,
    ForecastResponseSerializer,
    GeocodingResponseSerializer,
    HealthResponseSerializer,
    PlanResponseSerializer,
    TripRequestSerializer,
)
from planning.services import create_plan, forecast_for_plan


class HealthView(APIView):
    """Report API liveness without requiring the database or upstream providers."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        operation_id="get_health",
        responses=HealthResponseSerializer,
        tags=["System"],
        auth=[],
    )
    def get(self, request: Request) -> Response:
        return Response({"status": "ok", "service": "spotter-api"})


class PublicPlanningView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "planning"

    def handle_exception(self, exc: Exception) -> Response:
        if isinstance(exc, ProviderError):
            return Response({"detail": exc.message, "code": exc.code}, status=exc.status_code)
        if isinstance(exc, ValidationError):
            return Response(
                {
                    "detail": "Please check your trip details.",
                    "code": "invalid_trip",
                    "fields": exc.detail,
                },
                status=400,
            )
        return super().handle_exception(exc)


class PlanView(PublicPlanningView):
    @extend_schema(
        operation_id="create_plan",
        request=TripRequestSerializer,
        responses={
            200: PlanResponseSerializer,
            400: ErrorResponseSerializer,
            422: ErrorResponseSerializer,
            502: ErrorResponseSerializer,
            503: ErrorResponseSerializer,
        },
        tags=["Planning"],
        auth=[],
    )
    def post(self, request: Request) -> Response:
        serializer = TripRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = create_plan(TripRequest(**serializer.validated_data))
        return Response(PlanResponseSerializer(result).data)


class ForecastView(PublicPlanningView):
    @extend_schema(
        operation_id="get_plan_forecast",
        responses={
            200: ForecastResponseSerializer,
            404: ErrorResponseSerializer,
            502: ErrorResponseSerializer,
            503: ErrorResponseSerializer,
        },
        tags=["Planning"],
        auth=[],
    )
    def get(self, request: Request, plan_id: UUID) -> Response:
        return Response(ForecastResponseSerializer(forecast_for_plan(plan_id)).data)


class GeocodingView(PublicPlanningView):
    throttle_scope = "geocoding"

    @extend_schema(
        operation_id="geocode",
        parameters=[OpenApiParameter("q", OpenApiTypes.STR, required=True)],
        responses={
            200: GeocodingResponseSerializer,
            400: ErrorResponseSerializer,
            502: ErrorResponseSerializer,
            503: ErrorResponseSerializer,
        },
        tags=["Locations"],
        auth=[],
    )
    def get(self, request: Request) -> Response:
        query = request.query_params.get("q", "").strip()
        if not 2 <= len(query) <= 200:
            raise ValidationError({"q": "Enter between 2 and 200 characters."})
        with make_client() as client:
            places = TomTomClient(client).geocode(query)
        return Response(
            {
                "results": [
                    {"label": place.label, "coordinates": place.coordinate.as_geojson()}
                    for place in places
                ]
            }
        )


class MapTileView(View):
    """Serve bounded TomTom raster paths without exposing the provider key to browsers."""

    def get(self, request: HttpRequest, zoom: int, x: int, y: int) -> HttpResponse:
        if not (0 <= zoom <= 18 and 0 <= x < 2**zoom and 0 <= y < 2**zoom):
            return HttpResponse(status=404)
        tile_cache = caches["tiles"]
        cache_key = f"tile:{zoom}:{x}:{y}"
        tile = tile_cache.get(cache_key)
        if tile is None:
            try:
                with make_client() as client:
                    tile = TomTomClient(client).tile(zoom, x, y)
            except ProviderError:
                return HttpResponse(status=503)
            tile_cache.set(cache_key, tile, timeout=1800)
        response = HttpResponse(tile, content_type="image/png")
        response["Cache-Control"] = "public, max-age=1800"
        return response
