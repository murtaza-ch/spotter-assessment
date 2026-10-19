from datetime import timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from planning.domain.types import RISK_LABELS


class HealthResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ok"])
    service = serializers.CharField()


class CoordinateField(serializers.ListField):
    def __init__(self, **kwargs):
        super().__init__(child=serializers.FloatField(), min_length=2, max_length=2, **kwargs)


class ZonedDateTimeField(serializers.DateTimeField):
    def to_internal_value(self, value):
        try:
            parsed = parse_datetime(value) if isinstance(value, str) else None
        except ValueError:
            parsed = None
        if parsed is None or timezone.is_naive(parsed):
            raise serializers.ValidationError("Use an ISO date/time with a timezone offset.")
        return super().to_internal_value(value)


class TripRequestSerializer(serializers.Serializer):
    origin = serializers.CharField(max_length=200)
    destination = serializers.CharField(max_length=200)
    departure_at = ZonedDateTimeField()
    load_weight_lb = serializers.IntegerField(min_value=0, max_value=200_000)
    sample_interval_miles = serializers.ChoiceField(choices=[10, 25, 50], default=25)

    def validate_departure_at(self, value):
        now = timezone.now()
        if value < now - timedelta(minutes=5):
            raise serializers.ValidationError("Choose a future departure time.")
        if value > now + timedelta(days=7):
            raise serializers.ValidationError("Choose a departure within the next 7 days.")
        return value

    def validate(self, attrs):
        if attrs["origin"].casefold() == attrs["destination"].casefold():
            raise serializers.ValidationError({"destination": "Choose a different destination."})
        return attrs


class ErrorResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    code = serializers.CharField(required=False)
    fields = serializers.JSONField(required=False)


class PlaceSerializer(serializers.Serializer):
    label = serializers.CharField()
    coordinates = CoordinateField()


class GeocodingResponseSerializer(serializers.Serializer):
    results = PlaceSerializer(many=True)


class CheckpointSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    coordinates = CoordinateField()
    distance_miles = serializers.FloatField()
    arrival_at = serializers.DateTimeField()
    risk = serializers.ChoiceField(choices=list(RISK_LABELS.items()))
    wind_mph = serializers.FloatField(allow_null=True)
    rain_in = serializers.FloatField(allow_null=True)
    snow_in = serializers.FloatField(allow_null=True)
    temperature_f = serializers.FloatField(allow_null=True)


class RouteSummarySerializer(serializers.Serializer):
    miles_by_risk = serializers.DictField(child=serializers.FloatField())
    average_risk = serializers.FloatField(allow_null=True)
    maximum_risk = serializers.ChoiceField(choices=list(RISK_LABELS.items()))
    eligible = serializers.BooleanField()


class SegmentSerializer(serializers.Serializer):
    coordinates = serializers.ListField(child=CoordinateField())
    risk = serializers.ChoiceField(choices=list(RISK_LABELS.items()))
    distance_miles = serializers.FloatField()


class RouteSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    distance_miles = serializers.FloatField()
    duration_seconds = serializers.IntegerField()
    arrival_at = serializers.DateTimeField()
    geometry = serializers.ListField(child=CoordinateField())
    checkpoints = CheckpointSerializer(many=True)
    segments = SegmentSerializer(many=True)
    summary = RouteSummarySerializer()


class PlanResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    origin = PlaceSerializer()
    destination = PlaceSerializer()
    departure_at = serializers.DateTimeField()
    load_weight_lb = serializers.IntegerField()
    sample_interval_miles = serializers.IntegerField()
    routes = RouteSerializer(many=True)
    recommended_route_id = serializers.CharField(allow_null=True)
    recommendation_reason = serializers.CharField()
    warnings = serializers.ListField(child=serializers.CharField())


class ForecastResponseSerializer(serializers.Serializer):
    coordinates = serializers.ListField(child=CoordinateField())
    hours = serializers.ListField(child=serializers.DateTimeField())
    risk_frames = serializers.ListField(
        child=serializers.ListField(
            child=serializers.ChoiceField(choices=list(RISK_LABELS.items()))
        )
    )
    corridor_half_width_miles = serializers.IntegerField()
    warnings = serializers.ListField(child=serializers.CharField())
