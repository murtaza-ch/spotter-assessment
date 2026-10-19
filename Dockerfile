FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci
COPY frontend/ ./frontend/
COPY e2e/fixtures/ ./e2e/fixtures/
RUN npm run build

FROM python:3.13-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.9.17 /uv /uvx /usr/local/bin/
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/ ./
COPY --from=frontend /build/frontend/dist /app/frontend/dist
RUN .venv/bin/python -m whitenoise.compress /app/frontend/dist
COPY deploy/start.sh /app/start.sh
RUN chmod 755 /app/start.sh
ENV PATH="/app/backend/.venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings.production \
    FRONTEND_DIST_PATH=/app/frontend/dist
EXPOSE 8000
CMD ["/app/start.sh"]
