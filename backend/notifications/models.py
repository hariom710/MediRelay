from django.db import models
from config.state_machine import StateMachineMixin


class NotificationStatus(models.TextChoices):
    UNREAD = 'unread', 'Unread'
    READ = 'read', 'Read'
    ARCHIVED = 'archived', 'Archived'


class Notification(StateMachineMixin, models.Model):
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE,
                             related_name='notifications')
    notification_type = models.CharField(max_length=40)  # prescription_ready, quotation_submitted...
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=NotificationStatus.choices,
                              default=NotificationStatus.UNREAD)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    TRANSITIONS = {
        NotificationStatus.UNREAD: [NotificationStatus.READ, NotificationStatus.ARCHIVED],
        NotificationStatus.READ: [NotificationStatus.ARCHIVED],
        NotificationStatus.ARCHIVED: [],
    }

    class Meta:
        ordering = ['-created_at']

    def mark_read(self, actor=None, request=None):
        from django.utils import timezone
        self.read_at = timezone.now()
        return self.transition_to(
            NotificationStatus.READ,
            actor=actor,
            reason='Notification marked as read',
            request=request,
            update_fields=['read_at']
        )

    def archive(self, actor=None, request=None):
        return self.transition_to(
            NotificationStatus.ARCHIVED,
            actor=actor,
            reason='Notification archived',
            request=request
        )
