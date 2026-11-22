import logging

from .models import Notification

logger = logging.getLogger('medirelay.notifications')


def notify(user, ntype, title, body=''):
    """Best-effort: a failed notification must never undo a committed business action."""
    try:
        Notification.objects.create(user=user, notification_type=ntype,
                                    title=title, body=body)
    except Exception:
        logger.exception('notification failed for user=%s type=%s', getattr(user, 'id', None), ntype)
