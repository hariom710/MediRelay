from django.db import models


class Notification(models.Model):
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE,
                             related_name='notifications')
    notification_type = models.CharField(max_length=40)  # prescription_ready, quotation_submitted...
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
