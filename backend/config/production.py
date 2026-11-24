"""
MediRelay Production Settings

IMPORTANT:
- These settings are for PRODUCTION deployments only.
- Never commit production secrets to version control.
- Override via environment variables in deployment.
"""

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

# === CSRF trusted origins for production ===
# Override the development defaults from settings.py.
# In production, only HTTPS origins are allowed.
CSRF_TRUSTED_ORIGINS = [
    'https://medirelay.com',
    'https://www.medirelay.com',
]

# === Security Settings ===
# SECURITY: Enforce HTTPS-only cookies in production
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_HTTPONLY = True

# SECURE_SSL_REDIRECT must reference SECRET_KEY-safe setting
SECURE_SSL_REDIRECT = not DEBUG

# === Security Settings ===
# HSTS (HTTP Strict Transport Security)
# 1 year = 365 days * 24 hours * 60 minutes * 60 seconds
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# === Allowed Hosts ===
# Add your production domain(s) here
ALLOWED_HOSTS = [
    'medirelay.com',
    'www.medirelay.com',
    'localhost',
    '127.0.0.1',
]

# === CORS ===
# In production, be explicit about allowed origins
CORS_ALLOWED_ORIGINS = [
    'https://medirelay.com',
    'https://www.medirelay.com',
    'https://medirelay.app',
]

# === REST Framework throttling ===
# Production throttle rates (stricter than dev)
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'login': '3/min',
    'login_email': '3/min',
    'register': '5/min',
    'share_token': '10/min',
}

# === Note ===
# The following should be set via environment variables in production:
# - SECRET_KEY (must not be the development fallback key)
# - DATABASE_URL (or override DATABASES entirely)
# - EMAIL backend credentials
# - CORS_ALLOWED_ORIGINS
# - CSRF_TRUSTED_ORIGINS
# - ALLOWED_HOSTS