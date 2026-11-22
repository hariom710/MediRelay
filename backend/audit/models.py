import logging

from django.db import models

logger = logging.getLogger('medirelay.audit')


class AuditLog(models.Model):
    """Append-only. Never update or delete rows."""

    user = models.ForeignKey('accounts.User', on_delete=models.SET_NULL,
                             null=True, related_name='audit_logs')
    role = models.CharField(max_length=20, blank=True)
    action = models.CharField(max_length=80)  # e.g. prescription.finalize
    object_type = models.CharField(max_length=40)
    object_id = models.CharField(max_length=40)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.CharField(max_length=45, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} {self.object_type}#{self.object_id}'


class PrescriptionAccessLog(models.Model):
    """Who opened a shared prescription view, and when."""

    share = models.ForeignKey('prescriptions.PrescriptionShare',
                              on_delete=models.CASCADE, related_name='access_logs')
    user = models.ForeignKey('accounts.User', on_delete=models.SET_NULL,
                             null=True, related_name='+')
    role = models.CharField(max_length=20, blank=True)
    accessed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-accessed_at']
