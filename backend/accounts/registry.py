"""Patient identity and consent helpers.

Small, dependency-free primitives shared by views, serializers and migrations.
"""

import hmac
import hashlib
import re
import secrets

from django.conf import settings
from django.utils import timezone

# No 0/O/1/I: codes get read aloud and typed by hand.
CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
CODE_LENGTH = 6

ACCESS_CODE_TTL_MINUTES = 10
ACCESS_CODE_MAX_ATTEMPTS = 5
ACCESS_DEFAULT_DAYS = 365
TEMP_PASSWORD_TTL_DAYS = 7


def normalize_phone(raw):
    """Digits only, last 10 kept (Indian mobile). Shared numbers are allowed."""
    digits = re.sub(r'\D', '', raw or '')
    return digits[-10:] if len(digits) >= 10 else digits


def normalize_name(raw):
    return re.sub(r'[^a-z]', '', (raw or '').lower())


def mask_phone(normalized):
    return f'••••••{normalized[-4:]}' if normalized else ''


def generate_patient_code():
    return 'MR-' + ''.join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def unique_patient_code():
    from .models import PatientProfile
    for _ in range(20):
        code = generate_patient_code()
        if not PatientProfile.objects.filter(patient_code=code).exists():
            return code
    raise RuntimeError('Could not allocate a unique patient code')


def generate_temp_password():
    return secrets.token_urlsafe(9)  # ~12 characters


def _pepper(code):
    return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


def new_access_code(patient):
    """Create a fresh one-time code; returns the plaintext exactly once."""
    from .models import PatientAccessCode
    code = f'{secrets.randbelow(10 ** 6):06d}'
    PatientAccessCode.objects.create(
        patient=patient,
        code_hash=_pepper(code),
        expires_at=timezone.now() + timezone.timedelta(minutes=ACCESS_CODE_TTL_MINUTES),
    )
    return code


def redeem_access_code(patient, code):
    """Return True when the code is valid, unexpired, unused and under the attempt limit.

    A bare hash of 6 digits is offline-brute-forceable, so codes are HMAC'd with
    SECRET_KEY and capped at 5 attempts per row.
    """
    from .models import PatientAccessCode
    code = (code or '').strip()
    if not re.fullmatch(r'\d{6}', code):
        return False
    now = timezone.now()
    candidates = PatientAccessCode.objects.filter(
        patient=patient, used_at__isnull=True, expires_at__gt=now,
        attempts__lt=ACCESS_CODE_MAX_ATTEMPTS)
    target = _pepper(code)
    for candidate in candidates:
        if hmac.compare_digest(candidate.code_hash, target):
            candidate.used_at = now
            candidate.save(update_fields=['used_at'])
            return True
    # Count the miss against every live code for this patient.
    from django.db.models import F
    candidates.update(attempts=F('attempts') + 1)
    return False


def active_access(user, patient, scope=None):
    """The consent row that lets `user` read `patient`, or None."""
    from .models import AccessScope, AccessStatus, CareAccess
    doctor = getattr(user, 'doctor_profile', None)
    if doctor is None:
        return None
    qs = CareAccess.objects.filter(
        doctor=doctor, patient=patient,
        status=AccessStatus.ACTIVE,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    )
    if scope == AccessScope.FULL:
        qs = qs.filter(scope=AccessScope.FULL)
    return qs.first()


def active_access_rows(doctor):
    """All active consent rows for a doctor, newest first."""
    from .models import AccessStatus, CareAccess
    return CareAccess.objects.filter(
        doctor=doctor, status=AccessStatus.ACTIVE, revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    )
