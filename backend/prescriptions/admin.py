from django.contrib import admin
from .models import Prescription, PrescriptionItem, PrescriptionShare, Visit


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 0


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'doctor', 'patient', 'status', 'version', 'consultation_date', 'valid_until', 'is_expired')
    list_filter = ('status', 'consultation_date')
    search_fields = ('doctor__user__email', 'patient__user__email', 'patient__patient_code')
    inlines = [PrescriptionItemInline]


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ('id', 'doctor', 'patient', 'visited_at', 'complaint', 'diagnosis')
    search_fields = ('doctor__user__email', 'patient__patient_code', 'complaint', 'diagnosis')
    list_filter = ('visited_at',)


@admin.register(PrescriptionShare)
class PrescriptionShareAdmin(admin.ModelAdmin):
    list_display = ('id', 'prescription', 'pharmacy', 'status', 'created_at', 'expires_at')
    list_filter = ('status',)
