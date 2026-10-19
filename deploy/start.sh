#!/bin/sh
set -eu

# Railway mounts persistent volumes only when the container starts.
mkdir -p "${RAILWAY_VOLUME_MOUNT_PATH:-/app/data}"
python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 1 \
  --threads 4 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
