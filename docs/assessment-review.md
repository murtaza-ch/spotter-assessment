# Assessment review

This review checks both pages of the Weather-Aware Truck Routing assessment against
the local implementation. The PDF's external submission deliverables are tracked separately
from application behavior.

## Requirement coverage

| Requirement                                        | Implementation and evidence                                                                                                   | Status                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Origin, destination, departure, load               | Validated React form and DRF request serializer, offset-aware datetimes                                                       | Implemented                                   |
| Three routing API options                          | TomTom truck profile with two requested alternatives; explicit warning if fewer exist                                         | Implemented, subject to provider availability |
| 10 / 25 / 50-mile samples at ETA                   | Cumulative route progress, origin and exact destination, partial final segment                                                | Implemented and boundary-tested               |
| Weather and load risk rules                        | Pure domain classification; exact wind, rain, snow, and strict load boundaries                                                | Implemented and tested                        |
| Recommendation order                               | Eligible routes sorted by Severe miles, High miles, distance-weighted average, duration                                       | Implemented; every tie-breaker tested         |
| Routes, checkpoints, risks, ETAs, summaries on map | Every alternative's checkpoints remain visible; selection opens route-specific weather; summary overlay includes arrival date | Implemented                                   |
| Corridor heatmap and 0-48 hour slider              | Bounded corridor model grid, locally interpolated raster, 49 cached frames, keyboard and playback controls                    | Implemented                                   |
| UI and failure behavior                            | Responsive layout, forecast retry, map error boundary, accessible checkpoint list                                             | Desktop/mobile browser tests                  |
| Readable, maintainable code                        | Typed domain analysis, transport formatting, provider adapters, separate map layers and GeoJSON construction                  | Reviewed and refactored                       |
| Documentation and walkthrough                      | Setup, architecture, decisions, test commands, timed walkthrough outline                                                      | Documentation ready; recording pending        |

## Findings fixed

1. Repeated destination coordinates could discard elapsed travel time. Provider parsing
   now preserves stationary time intervals, and destination sampling always uses the final
   progress point. A nearly exact sampling interval also snaps to the actual destination.
2. The map previously hid every unselected route's checkpoints. It now renders all of them,
   identifies their owning route, and selects the route and checkpoint together on click.
3. Route summaries were only in the sidebar. A map overlay now shows the selected route's
   risk, travel time, mileage, full arrival date, and Severe/High exposure. Route cards also
   expose average risk. Dated checkpoint labels make overnight trips unambiguous.
4. A map initialization or worker failure could remove the workspace. A map error boundary
   keeps the form and route results usable and offers a retry. WebGL failure is tested.
5. Closing a checkpoint popup left selection stale, preventing that same checkpoint from
   reopening. Closing now clears selection without interfering with a different selection.
6. Route provider validation now rejects nonfinite coordinates, unordered progress,
   nonmonotonic distances/times, and progress that disagrees with summary totals.
7. Route analysis previously mixed domain calculations with API payload construction.
   `domain/analysis.py` returns typed results; `presentation.py` formats and simplifies
   them. Map styling and GeoJSON construction are separate from the React lifecycle.
8. Forecast grid construction now keeps only the four nearest samples as it scans and
   rejects distant route segments by their bounds. It avoids a full sample sort per pixel;
   slider playback continues to reuse the cached grid without provider requests.

## Interpretation and limits

The PDF's rain and snow ranges overlap at their endpoints. The explicit, tested interval
policy is documented in [assessment decisions](assumptions.md). No Travel and unknown
segments prevent recommendation. Arrival-time route risk remains distinct from the
common-time corridor slider, and the UI explains that distinction.

TomTom may return fewer than three distinct truck routes. The application reports that
limitation instead of duplicating alternatives. The corridor layer interpolates a bounded
set of forecast samples. It is not radar. Long trips must stay within the documented
weather sample cap, and missing forecast coverage stays unknown.

## Verification

Run `npm run check` and `npm run test:e2e`. Coverage includes threshold and load boundaries,
all recommendation tie-breakers, all checkpoint intervals, repeated-coordinate arrival,
invalid provider data, blocked and unknown route responses, partial weather failures,
all-route map data, popup reopening, forecast retry, and WebGL failure.

Repeatable tests use synthetic transport fixtures. The local live smoke check uses TomTom
and Open-Meteo for Chicago to Detroit, including all three alternatives and forecast frames.

## Outstanding submission deliverables

| Deliverable        | Current state                                                                  | Remaining action                                                 |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| GitHub repository  | Private repository created at https://github.com/murtaza-ch/spotter-assessment | Push the reviewed code; GitHub Actions is disabled               |
| Hosted application | Runs locally; production settings and deployment commands documented           | Railway service setup in progress; deploy and smoke-test         |
| 5-10 minute Loom   | [Walkthrough outline](walkthrough.md) ready                                    | Record the application and explanation, then attach the Loom URL |

These deliverables are not complete merely because the application passes local tests.
