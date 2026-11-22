from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import admin

from .models import Medicine


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ['generic_name', 'brand_name', 'strength', 'dosage_form', 'is_active']
    list_filter = ['dosage_form', 'is_active']
    search_fields = ['generic_name', 'brand_name']
