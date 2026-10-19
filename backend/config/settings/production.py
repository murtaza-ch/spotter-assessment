"""Deployment settings that require explicit configuration."""

from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import ALLOWED_HOSTS, BASE_DIR, SECRET_KEY, env
from .base import MIDDLEWARE as BASE_MIDDLEWARE

if len(SECRET_KEY) < 50 or SECRET_KEY.startswith("development-only"):
    raise ImproperlyConfigured(
        "Set DJANGO_SECRET_KEY to a private value of at least 50 characters."
    )

if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set DJANGO_ALLOWED_HOSTS to explicit deployment hostnames.")

DATABASES = {"default": env.db("DATABASE_URL")}
MIDDLEWARE = BASE_MIDDLEWARE.copy()
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
# The container serves the Vite build and API from one origin.
WHITENOISE_ROOT = Path(env("FRONTEND_DIST_PATH", default=str(BASE_DIR.parent / "frontend/dist")))
WHITENOISE_INDEX_FILE = True
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$"]
if env.bool("DJANGO_TRUST_PROXY_HEADERS", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=3600)
SECURE_CONTENT_TYPE_NOSNIFF = True
