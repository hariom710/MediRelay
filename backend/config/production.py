"""
MediRelay Production Settings

IMPORTANT:
- These settings are for PRODUCTION deployments only.
- Never commit production secrets to version control.
- Override via environment variables in deployment.
"""

import os

from .settings import *  # noqa: F401, F403

# === Debug ===
# SECURITY: Never set DEBUG=True in production
DEBUG = False

# === SECRET_KEY guard ===
# Ensure the development fallback key is never used in production.
# settings.py provides 'django-insecure-dev-only-local-key-...' when
# DJANGO_SECRET_KEY is not set and DEBUG is True. Enforce that production
# never silently falls back to that key.
if (
    SECRET_KEY
    == 'django-insecure-dev-only-local-key-never-use-in-production-7l_kg0'
):
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(
        "You're using the development SECRET_KEY in production. "
        "Set the DJANGO_SECRET_KEY environment variable with a secure value."
    )

# === Hosts and origins ===
# Deployment-specific: set both in the host's dashboard.
# ALLOWED_HOSTS must include the backend hostname (e.g. xyz.onrender.com).
# CSRF_TRUSTED_ORIGINS must include the browser-facing origin (e.g. https://xyz.vercel.app).
_env_list = lambda key: [v.strip() for v in os.environ.get(key, '').split(',') if v.strip()]
ALLOWED_HOSTS = _env_list('DJANGO_ALLOWED_HOSTS')
CSRF_TRUSTED_ORIGINS = _env_list('DJANGO_CSRF_TRUSTED_ORIGINS')

# === Security Settings ===
# SECURITY: Enforce HTTPS-only cookies in production
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True

# Trust the reverse proxy's X-Forwarded-Proto, otherwise SECURE_SSL_REDIRECT
# below loops forever (proxy speaks http, Django keeps redirecting to https).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = not DEBUG

# === Security Settings ===
# HSTS (HTTP Strict Transport Security)
# 1 year = 365 days * 24 hours * 60 minutes * 60 seconds
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# === REST Framework throttling ===
# Production throttle rates (stricter than dev)
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'login': '3/min',
    'login_email': '3/min',
    'register': '5/min',
    'share_token': '10/min',
}

# === Note ===
# Set these via environment variables in the deployment host:
# - DJANGO_SECRET_KEY (must not be the development fallback key)
# - DJANGO_ALLOWED_HOSTS, DJANGO_CSRF_TRUSTED_ORIGINS
# - DATABASE_URL (PostgreSQL; defaults to SQLite when unset)
# - DJANGO_NUM_PROXIES (2 behind Vercel -> Render)