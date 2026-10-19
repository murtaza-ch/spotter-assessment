# Architecture

The monorepo contains two independently runnable applications with a generated OpenAPI
contract. Django owns route analysis and provider credentials. React renders the results
and manages map interaction.

## Request flow

```text
React form -> POST /api/v1/plans/
  -> DRF serializer: validate inputs and timezone
  -> planning.services.create_plan
     -> TomTom: geocode both addresses, request three truck route options
     -> domain: place checkpoints using cumulative distance and travel time
     -> Open-Meteo: batch forecasts around checkpoint arrival times
     -> domain: classify risk, summarize exposure, rank eligible routes
     -> SQLite: save a 30-minute analysis
  -> response: routes, segments, checkpoints, summaries, recommendation

React -> GET /api/v1/plans/{id}/forecast/
  -> SQLite snapshot, or build and fetch a bounded corridor forecast
  -> 49 hourly risk frames
  -> MapLibre: interpolate and animate frames locally
```

Network requests happen outside database transactions. Provider adapters translate
external JSON into typed domain values. Pure calculations have no Django, database,
or HTTP dependencies. Views handle HTTP and errors; serializers define validation and
response shapes; services coordinate the use case.
`domain/analysis.py` produces typed checkpoint, segment, and summary results.
`presentation.py` converts those values into API payloads and simplifies display geometry.

## Frontend

`features/trip-planner/` owns the form, results, checkpoints, forecast controls, API
functions, hooks, and map. TanStack Query manages server state. Form values, route
selection, map visibility, and playback remain local React state.

MapLibre and its worker are lazy-loaded with the map component. Vite emits the worker
as a separate asset; `setWorkerUrl` explicitly points MapLibre to it in development
and production. The map instance lives in a ref, uses GeoJSON sources for route risk
segments and checkpoints, and uses an image source for interpolated forecast frames.
Resizing follows the map container through `ResizeObserver`.
Map styles and GeoJSON construction live in separate modules. All routes' checkpoints
remain on the map, and the selected route has a summary overlay. A map error boundary
keeps planning usable when WebGL or the map worker fails.

`theme/system.ts` owns Chakra tokens and global styles. Fonts are self-hosted. Risk
colors have text labels, checkpoint details are also available as buttons, and forecast
controls support keyboard operation. The map itself requires browser WebGL support.

Browser requests use `/api/v1`. Vite proxies `/api` to Django in development and preview.
Provider secrets must never use a `VITE_*` variable, because those values become public
build assets. TomTom map requests go through Django's bounded tile endpoint, keeping
the key out of browser URLs and bundles.

## API contract

| Method | Endpoint                         | Purpose                                               |
| ------ | -------------------------------- | ----------------------------------------------------- |
| GET    | `/api/v1/health/`                | API liveness; does not test providers or the database |
| GET    | `/api/v1/geocode/?q=...`         | Address candidates                                    |
| POST   | `/api/v1/plans/`                 | Analyze and temporarily store a trip                  |
| GET    | `/api/v1/plans/{uuid}/forecast/` | Cached 48-hour corridor forecast                      |
| GET    | `/api/v1/map/tiles/{z}/{x}/{y}/` | Cached TomTom raster tile proxy                       |
| GET    | `/api/docs/`                     | Interactive OpenAPI reference                         |

Planning endpoints are explicitly public and throttled. DRF's default authentication
policy stays in place for future endpoints. Error responses have a public message and
code; provider exception strings and credential-bearing URLs are not returned or logged.

Drf-spectacular generates `backend/openapi.yaml`; openapi-typescript generates
`frontend/src/lib/api/schema.d.ts`. Openapi-fetch provides typed requests and responses.
Run `npm run api:generate` after serializer or endpoint changes. The local contract check generates temporary
copies and compares them with the tracked contract files without editing the checkout.

## Storage and configuration

Python 3.13 and Django 5.2 LTS form the backend baseline. `base.py` contains shared
settings, `local.py` enables local defaults, and `production.py` validates deployment
configuration. Process environment variables override `backend/.env`.

SQLite stores Django tables and `TripPlan` JSON snapshots with UUIDs and expiry times.
The app does not write weather rows per checkpoint. Plan creation uses a short database
write after provider calls finish. Forecast snapshots are written on first request and
reused for the remaining lifetime. Provider caches are bounded local-memory caches.

`TOMTOM_API_KEY` is required for live routing and maps. Open-Meteo needs no key for the
configured public endpoint. Timeouts, limited concurrency, transient retries, sample
caps, and request throttles bound provider usage. See [assessment decisions](assumptions.md)
for thresholds, caching, and unknown-weather behavior.

## Deployment

The root Dockerfile builds React and packages it with Django in one Railway service.
WhiteNoise serves the Vite build at the root and Django handles `/api/` on the same origin.
SQLite lives on a persistent volume at `/app/data`. The development server stays local.
See [deployment](deployment.md) for the exact Railway configuration.

Set these values in the deployment platform's environment:

```text
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY=<private random value of at least 50 characters>
DJANGO_ALLOWED_HOSTS=<API hostname>
DATABASE_URL=sqlite:////app/data/db.sqlite3
TOMTOM_API_KEY=<existing TomTom key with routing, search, and map access>
DJANGO_CSRF_TRUSTED_ORIGINS=https://<public application hostname>
```

Mount persistent writable storage at `/app/data` for SQLite. Install and run from `backend/`:

```sh
uv sync --frozen --no-dev
uv run --no-dev python manage.py migrate
uv run --no-dev python manage.py collectstatic --noinput
uv run --no-dev gunicorn config.wsgi:application --bind 0.0.0.0:8000 --access-logfile -
```

WSGI and ASGI select production settings by default. Management commands default to
local settings, so set `DJANGO_SETTINGS_MODULE` explicitly for deployment commands.
WhiteNoise serves Django's collected static assets. HTTPS redirects and secure cookies
are enabled in production. Configure forwarded-protocol handling only for the trusted
reverse proxy used by the hosting platform.

Run `uv run --no-dev python manage.py purge_expired_plans` periodically if analyses
should be removed during idle periods. The SQLite assessment is intended for a single
application instance. The optional PostgreSQL dependency group is available if later
requirements justify changing storage.

GitHub Actions is disabled. Run `npm run check` and `npm run test:e2e` locally before
pushing. Railway builds the Docker image directly from the GitHub repository. External
provider calls are mocked in repeatable tests; deployed smoke checks use live services.
