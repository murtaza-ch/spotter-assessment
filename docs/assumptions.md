# Assessment decisions

These decisions resolve ambiguities in the brief and describe the limits of the implementation.

## Risk thresholds

The backend compares unrounded values. Each checkpoint takes the highest wind, rain,
or snow risk after applying the load overrides.

| Risk      | Wind (mph)     | Rain (in/hour)     | Snow (in/hour)     |
| --------- | -------------- | ------------------ | ------------------ |
| Low       | below 25       | below 0.10         | below 0.50         |
| Moderate  | 25 to below 35 | 0.10 to below 0.25 | 0.50 to below 1.00 |
| High      | 35 to below 45 | 0.25 to below 0.50 | 1.00 to below 2.00 |
| Severe    | 45 to below 55 | 0.50 through 1.00  | 2.00 through 3.00  |
| No Travel | 55 or higher   | above 1.00         | above 3.00         |

Wind of at least 55 mph means No Travel for any load. Between 45 and below 55 mph,
a load **above** 30,000 lb means No Travel. Between 35 and below 45 mph, a load
**above** 40,000 lb means Severe. Exact load boundaries do not trigger the override.

Missing, negative, or nonfinite hazard values produce Unknown unless a known hazard
already establishes No Travel. Temperature is displayed but does not affect risk.

## Checkpoints and recommendation

The user chooses 10-, 25-, or 50-mile spacing. Samples include the origin, each full
interval, and the destination, including the final partial segment. Distance and ETA
are interpolated from TomTom's cumulative route progress. Route geometry is simplified
only for display, after calculations.

Each segment takes the worse risk of its two endpoints. Unknown at either endpoint
makes the segment Unknown unless the other endpoint is No Travel. This is conservative
sampling; it cannot detect a short hazardous event between checkpoints.

Any No Travel or Unknown segment makes a route ineligible. Eligible routes are compared
lexicographically by Severe miles, High miles, distance-weighted average risk, and total
travel time. Risk scores are Low=0, Moderate=1, High=2, Severe=3, No Travel=4.
Average risk is absent when any distance has unknown weather. When every route is
ineligible, all alternatives remain visible and no route receives a recommendation.

## Provider interpretation

- TomTom supplies geocoding, truck routes, and raster basemap tiles. The most relevant
  geocoding result is selected; more specific addresses improve ambiguous matches.
- The routing request asks for a primary route and two alternatives. If TomTom returns
  fewer distinct routes, the app shows the available routes with an explanation.
- Cargo load is used for the assessment's weather rules. It is not passed as gross
  vehicle weight. Vehicle dimensions, gross weight, hazardous cargo, driver hours,
  rest stops, and detours are outside the supplied inputs.
- Open-Meteo supplies hourly 10-meter wind, rain, showers, snowfall, and temperature.
  Rain plus showers gives total liquid rainfall. Rain and snow amounts are in inches
  for the preceding hour, interpreted as inches/hour for the assessment thresholds.
- Wind and temperature interpolate between hourly values. Precipitation uses the
  containing hourly accumulation rather than interpolating rainfall totals.
- Datetimes include a UTC offset. Calculations use UTC; the form and displayed times
  use the browser's local timezone. Departures are accepted within the next seven days;
  weather outside the provider's available horizon stays Unknown.

## Forecast map

The slider covers departure through departure +48 hours, including both endpoints.
It shows weather at a common time across the corridor. Route risk colors continue to
represent weather at each checkpoint's ETA, so moving the slider does not change the
original route recommendation.

The backend samples at most 120 locations along and up to 25 miles either side of
the routes. The browser draws a masked raster using four nearest model samples and
normalized inverse-distance weights. The interpolation grid is built once per plan;
each frame only updates the image. Uniform weather stays uniform regardless of sample
density. Missing samples appear gray. This is a smoothed model visualization, not radar
or a full-resolution weather surface. Slider movement and playback make no network calls.

## Storage, limits, and failure behavior

SQLite stores anonymous trip analyses and their optional forecast snapshots for 30 minutes.
There are no product accounts or saved-trip history. Plan UUIDs permit forecast retrieval
while the analysis is valid. Expired records are removed when a new plan is saved; deployments
can also run `purge_expired_plans` periodically.

Planning is throttled to six requests per minute per client and geocoding to thirty.
A trip may require at most 380 unique checkpoint weather locations; longer trips need
wider spacing. Weather calls batch 40 locations with at most three concurrent requests.
Partial weather failures preserve Unknown values; a total provider failure returns a
clear error and keeps the form available for retry. No production response uses fallback
or synthetic routes or forecasts.

Caches last one hour for geocoding, five minutes for routes, fifteen minutes for weather,
and thirty minutes for basemap tiles. The local-memory caches and DRF throttles are per
process. A larger deployment should use shared caching and an edge rate limit. SQLite
requires persistent disk and suits this single-instance assessment; horizontal scaling
would require a different storage arrangement.

Provider quotas and usage terms still apply. Keeping requests bounded and cached does
not guarantee that every deployment or traffic level fits a free plan.
