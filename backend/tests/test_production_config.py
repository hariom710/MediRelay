"""
Production configuration validation tests.

These tests verify that production-critical security settings are correct
when DJANGO_SETTINGS_MODULE=config.production is used.

They should always pass; if they fail, the production deployment is
misconfigured and should not proceed.
"""

import django
import os
import sys

# Force production settings BEFORE Django is initialized by any other module.
# This must be done at the top of the test file, before any pytest plugins
# or conftest.py modules load and pick up the pytest.ini setting.
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.production'

# Ensure the production settings module is imported before pytest.ini overrides it.
# We do this by importing django and setting up immediately.
django.setup()

import pytest

from django.conf import settings


@pytest.mark.usefixtures("production_settings")
class TestProductionConfig:
    """Production configuration validation tests."""

    def test_production_debug_is_false(self):
        """DEBUG must be False in production."""
        assert settings.DEBUG is False, \
            f"DEBUG must be False in production, got {settings.DEBUG}"

    def test_production_secret_key_is_set(self):
        """SECRET_KEY must be set (no insecure fallback)."""
        assert settings.SECRET_KEY is not None, "SECRET_KEY must be set"
        assert settings.SECRET_KEY != 'django-insecure-dev-only-local-key-never-use-in-production-7l_kg0', \
            "SECRET_KEY must not be the development fallback key"

    def test_production_allowed_hosts_explicit(self):
        """ALLOWED_HOSTS must be explicitly set (not default dev hosts only)."""
        assert len(settings.ALLOWED_HOSTS) > 2, \
            f"ALLOWED_HOSTS should include production domains, got {settings.ALLOWED_HOSTS}"

    def test_production_csrf_trusted_origins_https(self):
        """CSRF_TRUSTED_ORIGINS must contain only HTTPS origins in production."""
        for origin in settings.CSRF_TRUSTED_ORIGINS:
            assert origin.startswith('https://'), \
                f"CSRF_TRUSTED_ORIGINS must use HTTPS, got {origin}"

    def test_production_session_cookie_secure(self):
        """SESSION_COOKIE_SECURE must be True in production."""
        assert settings.SESSION_COOKIE_SECURE is True, \
            f"SESSION_COOKIE_SECURE must be True in production, got {settings.SESSION_COOKIE_SECURE}"

    def test_production_csrf_cookie_secure(self):
        """CSRF_COOKIE_SECURE must be True in production."""
        assert settings.CSRF_COOKIE_SECURE is True, \
            f"CSRF_COOKIE_SECURE must be True in production, got {settings.CSRF_COOKIE_SECURE}"

    def test_production_csrf_cookie_httponly(self):
        """CSRF_COOKIE_HTTPONLY must be True in production."""
        assert settings.CSRF_COOKIE_HTTPONLY is True, \
            f"CSRF_COOKIE_HTTPONLY must be True in production, got {settings.CSRF_COOKIE_HTTPONLY}"

    def test_production_session_cookie_httponly(self):
        """SESSION_COOKIE_HTTPONLY must be True in production."""
        assert settings.SESSION_COOKIE_HTTPONLY is True, \
            f"SESSION_COOKIE_HTTPONLY must be True in production, got {settings.SESSION_COOKIE_HTTPONLY}"

    def test_production_hsts_settings(self):
        """HSTS settings must be properly configured in production."""
        assert settings.SECURE_HSTS_SECONDS == 31536000, \
            f"SECURE_HSTS_SECONDS must be 31536000 (1 year), got {settings.SECURE_HSTS_SECONDS}"
        assert settings.SECURE_HSTS_INCLUDE_SUBDOMAINS is True, \
            "SECURE_HSTS_INCLUDE_SUBDOMAINS must be True"
        assert settings.SECURE_HSTS_PRELOAD is True, \
            "SECURE_HSTS_PRELOAD must be True"
        assert settings.SECURE_SSL_REDIRECT is True, \
            "SECURE_SSL_REDIRECT must be True"

    def test_production_throttle_rates_strict(self):
        """Production throttle rates should be stricter than development."""
        rates = settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {})
        # Login should be at most 5/min in production
        assert rates.get('login', '') in ('5/min', '3/min'), \
            f"Production login throttle should be 3-5/min, got {rates.get('login')}"