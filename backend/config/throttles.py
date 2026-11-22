"""Custom DRF throttle classes for MediRelay.

Throttling design:
- LoginThrottle: rate throttle per IP (scope='login').
  Reads client IP using DRF's get_ident(), which inspects X-Forwarded-For
  with settings.NUM_PROXIES support.
- LoginEmailThrottle: rate throttle per normalized email (scope='login_email').
  Prevents targeted brute force against a specific account from rotating proxies.
- RegisterThrottle: rate throttle per IP (scope='register').
- ShareTokenThrottle: rate throttle per authenticated user (scope='share_token').
  ShareTokenView requires authentication; user-scoped throttling protects against
  probing of valid share tokens.

Cache Backend Documentation:
  Default cache backend in dev is Django's LocMemCache, which is per-process.
  When deploying with multi-process WSGI workers (e.g. Gunicorn/uWSGI), LocMemCache
  does NOT share throttle state across worker processes. In production, configure
  a shared cache backend such as Redis or Memcached in settings.CACHES:
      CACHES = {
          'default': {
              'BACKEND': 'django.core.cache.backends.redis.RedisCache',
              'LOCATION': os.environ.get('CACHE_URL', 'redis://127.0.0.1:6379/1'),
          }
      }
"""

import hashlib
from rest_framework.throttling import SimpleRateThrottle


class LoginThrottle(SimpleRateThrottle):
    """Throttle login requests per client IP."""
    scope = 'login'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class LoginEmailThrottle(SimpleRateThrottle):
    """Throttle login requests per normalized email."""
    scope = 'login_email'

    def get_cache_key(self, request, view):
        email = (request.data.get('email') or '').lower().strip()
        if not email:
            return None  # fall back to IP throttle only
        email_hash = hashlib.sha256(email.encode('utf-8')).hexdigest()[:32]
        return self.cache_format % {
            'scope': self.scope,
            'ident': f'email_{email_hash}',
        }


class RegisterThrottle(SimpleRateThrottle):
    """Throttle registration requests per client IP."""
    scope = 'register'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class ShareTokenThrottle(SimpleRateThrottle):
    """Throttle share token lookups per authenticated user (or IP if unauth)."""
    scope = 'share_token'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = str(request.user.pk)
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident,
        }
