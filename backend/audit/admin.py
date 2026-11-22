from django.contrib import admin

from .models import AuditLog, PrescriptionAccessLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only admin. No add, change, or delete allowed."""
    list_display = ['created_at', 'action', 'object_type', 'object_id', 'user', 'role', 'ip_address']
    list_filter = ['action', 'role', 'object_type']
    search_fields = ['action', 'object_id', 'user__email']
    ordering = ['-created_at']
    readonly_fields = [f.name for f in AuditLog._meta.get_fields()]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PrescriptionAccessLog)
class PrescriptionAccessLogAdmin(admin.ModelAdmin):
    list_display = ['accessed_at', 'share', 'user', 'role']
    readonly_fields = [f.name for f in PrescriptionAccessLog._meta.get_fields()]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
