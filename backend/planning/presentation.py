"""Convert domain analysis into the documented API payload, simplifying display geometry."""

from planning.domain.analysis import RouteAnalysis
from planning.domain.checkpoints import METERS_PER_MILE
from planning.domain.geometry import simplify


def route_payload(analysis: RouteAnalysis, number: int) -> dict:
    route, summary = analysis.route, analysis.summary
    return {
        "id": f"route-{number}",
        "name": f"Route {number}",
        "distance_miles": route.distance_m / METERS_PER_MILE,
        "duration_seconds": round(route.duration_s),
        "arrival_at": analysis.checkpoints[-1].checkpoint.arrival_at.isoformat(),
        "geometry": simplify([point.coordinate for point in route.points]),
        "segments": [
            {
                "coordinates": simplify(list(segment.coordinates)),
                "risk": int(segment.risk),
                "distance_miles": segment.distance_m / METERS_PER_MILE,
            }
            for segment in analysis.segments
        ],
        "summary": {
            "miles_by_risk": {
                str(int(level)): miles for level, miles in summary.miles_by_risk.items()
            },
            "average_risk": summary.average_risk,
            "maximum_risk": int(summary.maximum_risk),
            "eligible": summary.eligible,
        },
        "checkpoints": [
            {
                "index": index,
                "coordinates": point.checkpoint.coordinate.as_geojson(),
                "distance_miles": point.checkpoint.distance_m / METERS_PER_MILE,
                "arrival_at": point.checkpoint.arrival_at.isoformat(),
                "risk": int(point.risk),
                "wind_mph": point.weather.wind_mph,
                "rain_in": point.weather.rain_in,
                "snow_in": point.weather.snow_in,
                "temperature_f": point.weather.temperature_f,
            }
            for index, point in enumerate(analysis.checkpoints)
        ],
    }
