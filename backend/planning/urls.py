from django.urls import path

from planning.views import ForecastView, GeocodingView, HealthView, MapTileView, PlanView

app_name = "planning"

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("geocode/", GeocodingView.as_view(), name="geocode"),
    path("plans/", PlanView.as_view(), name="plans"),
    path("plans/<uuid:plan_id>/forecast/", ForecastView.as_view(), name="forecast"),
    path("map/tiles/<int:zoom>/<int:x>/<int:y>/", MapTileView.as_view(), name="map-tile"),
]
