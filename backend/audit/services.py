"""record() must never break the business request — audit failures are logged, not raised."""

import logging

logger = logging.getLogger('medirelay.audit')


def record(user, action, object_type, object_id, metadata=None, request=None):
    from .models import AuditLog

    try:
        ip = ''
        if request is not None:
            ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() \
                or request.META.get('REMOTE_ADDR', '')
        AuditLog.objects.create(
            user=user if getattr(user, 'is_authenticated', False) else None,
            role=getattr(user, 'active_role', '') or '',
            action=action, object_type=object_type, object_id=str(object_id),
            metadata=metadata or {}, ip_address=ip)
    except Exception:
        logger.exception('audit record failed: %s %s', action, object_type)
