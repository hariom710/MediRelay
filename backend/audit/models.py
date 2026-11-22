import logging

from django.db import models

logger = logging.getLogger('medirelay.audit')


class _AppendOnlyQuerySet(models.QuerySet):
    """Prevent bulk-update and bulk-delete on AuditLog rows."""

    def update(self, **kwargs):
        # Allow Django's cascade collector to set user=None when a user is deleted (on_delete=SET_NULL)
        if set(kwargs.keys()).issubset({'user', 'user_id'}) and all(v is None for v in kwargs.values()):
            return super().update(**kwargs)
        raise PermissionError('AuditLog rows are immutable. update() is blocked.')

    def delete(self):
        raise PermissionError('AuditLog rows are immutable. delete() is blocked.')


class AuditLogManager(models.Manager):
    def get_queryset(self):
        return _AppendOnlyQuerySet(self.model, using=self._db)


class AuditLog(models.Model):
    """Append-only audit trail. Rows can never be updated or deleted.

    Enforcement:
    - save() raises PermissionError for existing PKs (updates).
    - delete() on the instance is blocked.
    - Queryset update() and delete() are blocked via _AppendOnlyQuerySet.
    - Django admin lists the model but provides no edit/delete UI.
    """

    user = models.ForeignKey('accounts.User', on_delete=models.SET_NULL,
                             null=True, related_name='audit_logs')
    role = models.CharField(max_length=20, blank=True)
    action = models.CharField(max_length=80)  # e.g. prescription.finalize
    object_type = models.CharField(max_length=40)
    object_id = models.CharField(max_length=40)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.CharField(max_length=45, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    objects = AuditLogManager()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} {self.object_type}#{self.object_id}'

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise PermissionError(
                f'AuditLog row {self.pk} is immutable. Updates are not allowed.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError(
            f'AuditLog row {self.pk} is immutable. Deletion is not allowed.')


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
