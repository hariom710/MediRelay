"""Verify config.production is safe to deploy.

Run in a subprocess: the main pytest run has already initialised Django with
config.settings, so importing config.production in-process would neither
re-initialise Django nor prove anything about the real startup path.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent

HOSTS = 'api.example.com,app.example.com'
ORIGINS = 'https://app.example.com'

_PROBE = f"""
import json, os, django
os.environ['DJANGO_SECRET_KEY'] = 'test-only-' + 'x' * 50
os.environ['DJANGO_ALLOWED_HOSTS'] = {HOSTS!r}
os.environ['DJANGO_CSRF_TRUSTED_ORIGINS'] = {ORIGINS!r}
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.production'
django.setup()
from django.conf import settings
print(json.dumps({{
    'DEBUG': settings.DEBUG,
    'SECRET_KEY': settings.SECRET_KEY,
    'ALLOWED_HOSTS': settings.ALLOWED_HOSTS,
    'CSRF_TRUSTED_ORIGINS': settings.CSRF_TRUSTED_ORIGINS,
    'SESSION_COOKIE_SECURE': settings.SESSION_COOKIE_SECURE,
    'CSRF_COOKIE_SECURE': settings.CSRF_COOKIE_SECURE,
    'CSRF_COOKIE_HTTPONLY': settings.CSRF_COOKIE_HTTPONLY,
    'SESSION_COOKIE_HTTPONLY': settings.SESSION_COOKIE_HTTPONLY,
    'SECURE_SSL_REDIRECT': settings.SECURE_SSL_REDIRECT,
    'SECURE_PROXY_SSL_HEADER': list(settings.SECURE_PROXY_SSL_HEADER),
    'SECURE_HSTS_SECONDS': settings.SECURE_HSTS_SECONDS,
    'SECURE_HSTS_INCLUDE_SUBDOMAINS': settings.SECURE_HSTS_INCLUDE_SUBDOMAINS,
    'SECURE_HSTS_PRELOAD': settings.SECURE_HSTS_PRELOAD,
    'THROTTLE_RATES': settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'],
}}))
"""


@pytest.fixture(scope='module')
def prod():
    env = {k: v for k, v in os.environ.items() if k != 'DATABASE_URL'}
    result = subprocess.run(
        [sys.executable, '-c', _PROBE],
        cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=120,
    )
    assert result.returncode == 0, f'config.production failed to load:\n{result.stderr}'
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_production_debug_is_false(prod):
    assert prod['DEBUG'] is False


def test_production_secret_key_is_set(prod):
    assert prod['SECRET_KEY']
    assert prod['SECRET_KEY'] != 'django-insecure-dev-only-local-key-never-use-in-production-7l_kg0'


def test_production_allowed_hosts_come_from_env(prod):
    assert prod['ALLOWED_HOSTS'] == HOSTS.split(',')


def test_production_csrf_trusted_origins_come_from_env_and_are_https(prod):
    assert prod['CSRF_TRUSTED_ORIGINS'] == [ORIGINS]
    for origin in prod['CSRF_TRUSTED_ORIGINS']:
        assert origin.startswith('https://'), origin


def test_production_cookies_are_secure_and_httponly(prod):
    assert prod['SESSION_COOKIE_SECURE'] is True
    assert prod['CSRF_COOKIE_SECURE'] is True
    assert prod['SESSION_COOKIE_HTTPONLY'] is True
    assert prod['CSRF_COOKIE_HTTPONLY'] is True


def test_production_ssl_redirect_trusts_proxy_header(prod):
    # Without this pair Django redirect-loops forever behind Render/Vercel.
    assert prod['SECURE_SSL_REDIRECT'] is True
    assert prod['SECURE_PROXY_SSL_HEADER'] == ['HTTP_X_FORWARDED_PROTO', 'https']


def test_production_hsts_settings(prod):
    assert prod['SECURE_HSTS_SECONDS'] == 31536000
    assert prod['SECURE_HSTS_INCLUDE_SUBDOMAINS'] is True
    assert prod['SECURE_HSTS_PRELOAD'] is True


def test_production_throttle_rates_are_strict(prod):
    rates = prod['THROTTLE_RATES']
    assert rates['login'] in ('3/min', '5/min'), rates
    assert rates['login_email'] in ('3/min', '5/min'), rates
