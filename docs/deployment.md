# Railway deployment

Application: https://spotter-assessment-production-c72e.up.railway.app

Repository: https://github.com/murtaza-ch/spotter-assessment

Railway project: https://railway.com/project/d5dd38c9-e802-4822-a1c0-dbc76861233e

GitHub Actions is disabled. Railway builds the root Dockerfile directly from GitHub;
no GitHub-hosted runner is involved. Run `npm run check` and `npm run test:e2e` locally
before pushing changes.

## Application service

Create one service from the repository's `main` branch, with the repository root as its
build context. Railway detects the root Dockerfile. Set the health check to
`/api/v1/health/` and the On Failure restart policy to three retries in the dashboard.
Do not set a pre-deploy migration command: Railway volumes are only
available once the application container starts.

Attach a persistent volume at `/app/data`. Keep this SQLite service at one replica.
The startup script migrates the database, collects Django static files, and starts one
Gunicorn worker with four request threads. Railway supplies `PORT`.

The image contains the Vite production build. WhiteNoise serves `/`, `/assets/`, and
Django's `/static/` files; API requests stay on the same origin. Provider credentials
are runtime variables and are excluded from the build context and Git repository.

## Runtime variables

Generate a Railway public domain and set these variables on the application service:

| Variable                      | Value                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `DJANGO_SETTINGS_MODULE`      | `config.settings.production`                                                                        |
| `DJANGO_SECRET_KEY`           | A private random value with at least 50 characters                                                  |
| `DJANGO_ALLOWED_HOSTS`        | The exact public hostname, `healthcheck.railway.app`, `localhost`, and `127.0.0.1`, comma-separated |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://` followed by the public hostname                                                          |
| `DJANGO_TRUST_PROXY_HEADERS`  | `true`, for Railway's trusted HTTPS proxy                                                           |
| `DATABASE_URL`                | `sqlite:////app/data/db.sqlite3`                                                                    |
| `TOMTOM_API_KEY`              | The existing private key enabled for routing, search, and maps                                      |

The Docker image sets `FRONTEND_DIST_PATH=/app/frontend/dist`. Keep HTTPS redirects
enabled; only the public liveness endpoint is exempt so internal health checks can run.
There is no browser-visible provider key and no need for frontend API URL overrides.

## Verification

After deployment, check the public homepage, `/api/v1/health/`, and `/api/docs/`. Submit
Chicago to Detroit with a future departure and verify route alternatives, checkpoint
popups, basemap tiles, and all 49 corridor forecast frames. Confirm that the database
file is on the mounted volume before relying on persistence across redeploys.

The live smoke check passed for all three routes, 13/14/15 route checkpoints, 49 forecast
frames across 109 locations, geocoding, map tiles, the homepage, health, and API docs.

The local production test covers frontend and asset serving, the trusted HTTPS header,
HTTP-to-HTTPS redirection, the liveness exemption, and rejecting untrusted hosts.

## Updates

Push tested commits to `main` for Railway's native GitHub deployment integration.
Keep Actions disabled and do not add workflow files. SQLite migrations run at startup,
so allow a brief interruption during deployments with the attached volume. Temporary
trip analyses expire after 30 minutes; they are removed as new analyses are created.
