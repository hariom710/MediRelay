"""record() must never break the business request — audit failures are logged, not raised."""

import hashlib
import json
import logging
from django.utils import timezone

logger = logging.getLogger('medirelay.audit')

GENESIS_HASH = '0' * 64


def compute_entry_hash(prev_hash, rec_id, user_id, role, action, object_type, object_id, metadata, ip_address):
    """Deterministic cryptographic hash for audit block chaining based on block sequence and payload."""
    try:
        meta_str = json.dumps(metadata or {}, sort_keys=True)
    except Exception:
        meta_str = '{}'
    parts = [str(x) for x in [prev_hash, rec_id, user_id or '', role or '', action, object_type, object_id, meta_str, ip_address or '']]
    raw = '|'.join(parts)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def record(user, action, object_type, object_id, metadata=None, request=None):
    from .models import AuditLog

    try:
        ip = ''
        if request is not None:
            ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() \
                or request.META.get('REMOTE_ADDR', '')

        # Cryptographic chain linking to the immediate previous entry
        last_entry = AuditLog.objects.order_by('-id').first()
        prev_h = last_entry.entry_hash if (last_entry and last_entry.entry_hash) else GENESIS_HASH

        uid = user.id if (user and getattr(user, 'is_authenticated', False)) else None
        role_val = getattr(user, 'active_role', '') or ''

        log_obj = AuditLog.objects.create(
            user=user if getattr(user, 'is_authenticated', False) else None,
            role=role_val,
            action=action,
            object_type=object_type,
            object_id=str(object_id),
            metadata=metadata or {},
            ip_address=ip,
            prev_hash=prev_h,
            entry_hash='',
        )

        entry_h = compute_entry_hash(
            prev_h, log_obj.id, uid, role_val, action, object_type, str(object_id),
            metadata, ip
        )
        AuditLog.objects.filter(pk=log_obj.id).update(entry_hash=entry_h)
    except Exception:
        logger.exception('audit record failed: %s %s', action, object_type)
