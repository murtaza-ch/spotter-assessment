# Spotter

[Live application](https://spotter-assessment-production-c72e.up.railway.app) · [API reference](https://spotter-assessment-production-c72e.up.railway.app/api/docs/)

Weather-aware truck route comparison built with React, TypeScript, Vite, Chakra UI,
Django REST Framework, SQLite, TomTom, Open-Meteo, and MapLibre.

Enter origin, destination, departure time, and cargo load to compare up to three truck
routes. The backend samples weather at checkpoint arrival times, applies the assessment's
risk and load rules, and recommends the best eligible route. The map shows risk-colored
segments, checkpoint details, and a locally animated 48-hour corridor forecast.

## Get started

Install Node.js 22.12+ or 24, npm, and [uv](https://docs.astral.sh/uv/getting-started/installation/).
The `.node-version` file selects Node 22; uv manages Python 3.13.

From the repository root:

```sh
npm run setup
test -f backend/.env || cp backend/.env.example backend/.env
```

Set `TOMTOM_API_KEY` in `backend/.env` to a TomTom key enabled for routing, search,
and raster maps. Open-Meteo needs no key for the public endpoint used here. Keep the
key in the backend; `.env` is ignored by Git. Existing environment files are preserved
by the command above. No external database service is needed.

```sh
npm run dev
```

Open [the application](http://127.0.0.1:5173) or the [API reference](http://127.0.0.1:8000/api/docs/).
Use **Chicago → Detroit** for a sample trip with real provider data. Stop both servers
with Ctrl+C. Use `127.0.0.1` consistently; Vite proxies `/api` to Django on port 8000.

The form interprets departure in your browser's timezone. Forecast coverage and provider
quotas can limit an analysis. Missing weather remains Unknown and prevents recommendation.

## Commands

| Command                               | Purpose                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                         | Start frontend and backend together                                |
| `npm run dev:web` / `npm run dev:api` | Start either application alone                                     |
| `npm run check`                       | Lint, formatting, types, Django checks, tests, contract, and build |
| `npm run format`                      | Format frontend, configuration, documentation, and Python          |
| `npm test`                            | Run backend and frontend unit tests                                |
| `npm run test:e2e`                    | Run desktop and mobile browser integration tests                   |
| `npm run api:generate`                | Update OpenAPI and generated TypeScript API types                  |
| `npm run db:migrate`                  | Apply SQLite migrations                                            |
| `npm run build`                       | Build the frontend into `frontend/dist/`                           |

Before the first browser test run:

```sh
npx playwright install chromium
npm run test:e2e
```

Browser tests build the frontend and exercise its production bundle on port 4173 with
a real Django health endpoint and synthetic planning transport fixtures. They require
no provider credentials. Backend API tests mock provider HTTP while exercising real
parsing, validation, domain calculations, and SQLite persistence. Frontend unit tests
cover forecast interpolation. Live smoke checks are separate from the repeatable suite.

## Repository layout

```text
frontend/src/
  app/                         Entry point and providers
  features/trip-planner/
    components/                Form, route cards, checkpoints, forecast controls
    map/                       MapLibre rendering and forecast interpolation
    api.ts, hooks.ts, types.ts  Feature transport and state
  components/ui/               Shared presentation components
  lib/api/                     Typed HTTP client and generated schema
  theme/                       Chakra tokens and global styles
backend/
  config/                      URLs, entry points, environment settings
  planning/
    domain/                    Pure risk, checkpoint, geometry, ranking logic
    providers/                 TomTom and Open-Meteo adapters
    services.py                Planning and forecast orchestration
    models.py                  Temporary trip snapshots
    serializers.py, views.py    HTTP contracts and endpoints
    tests/                     Domain, adapter, and API tests
  openapi.yaml                 Generated API contract
e2e/                           Desktop/mobile integration tests
docs/                          Architecture, decisions, and coding practices
```

npm workspaces use one root `package-lock.json`. Python uses `backend/pyproject.toml`
and `backend/uv.lock`. Keep both lockfiles and migrations under version control.

After changing an API serializer or endpoint, run `npm run api:generate`, `npm run check`,
and the browser tests. Do not edit generated API types directly. Run `npm run api:check` to check contract drift locally.

Read [architecture](docs/architecture.md), [assessment decisions](docs/assumptions.md),
and [coding practices](docs/coding-practices.md) for module boundaries and design choices.
Railway deployment uses the root Dockerfile and a persistent SQLite volume. See [deployment](docs/deployment.md).
The [assessment review](docs/assessment-review.md) tracks requirement coverage, resolved
findings, and the remaining GitHub, hosting, and Loom submission steps.

## Troubleshooting

If npm reports root-owned files in an existing global cache, use a separate cache:

```sh
npm ci --cache /tmp/spotter-npm-cache
uv sync --project backend --frozen
npm run db:migrate
```

If a trip reports a missing key or provider error, check the backend environment and
the key's enabled TomTom products. The health endpoint only confirms API liveness.
After a trip expires, submit it again to create a fresh analysis. For long trips that
exceed the weather sample cap, choose wider checkpoint spacing.
