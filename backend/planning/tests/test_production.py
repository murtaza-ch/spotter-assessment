"""Exercise the actual production middleware in a separate settings process."""

import os
import subprocess
import sys
from pathlib import Path


def test_production_serves_frontend_and_api_behind_https_proxy(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html><body>Production frontend</body></html>")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app-test1234.js").write_text("console.log('production asset')")
    environment = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.production",
        "DJANGO_SECRET_KEY": "test-only-production-secret-" + "x" * 40,
        "DJANGO_ALLOWED_HOSTS": "testserver,healthcheck.railway.app",
        "DJANGO_TRUST_PROXY_HEADERS": "true",
        "DATABASE_URL": "sqlite:///:memory:",
        "FRONTEND_DIST_PATH": str(tmp_path),
    }
    script = """
import django
django.setup()
from django.test import Client
client = Client()
root = client.get('/', HTTP_X_FORWARDED_PROTO='https')
assert root.status_code == 200, root.status_code
assert b'Production frontend' in b''.join(root.streaming_content)
asset = client.get('/assets/app-test1234.js', HTTP_X_FORWARDED_PROTO='https')
assert asset.status_code == 200
assert 'javascript' in asset['Content-Type']
health = client.get('/api/v1/health/', HTTP_HOST='healthcheck.railway.app')
assert health.status_code == 200
assert health.json()['status'] == 'ok'
redirect = client.get('/api/docs/')
assert redirect.status_code == 301
assert redirect['Location'].startswith('https://')
assert client.get('/api/v1/health/', HTTP_HOST='untrusted.example').status_code == 400
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=Path(__file__).resolve().parents[2],
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
