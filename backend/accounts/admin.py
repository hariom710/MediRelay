from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, DoctorProfile, PatientProfile, PharmacyProfile, CareAccess, PatientAccessCode


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'first_name', 'last_name', 'active_role', 'is_staff', 'is_active')
    search_fields = ('email', 'first_name', 'last_name', 'phone')
    ordering = ('email',)
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Roles & State', {'fields': ('roles', 'active_role', 'must_change_password')}),
        ('Dates', {'fields': ('last_login', 'date_joined')}),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')


@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'qualification', 'registration_number', 'clinic_name', 'verification_status')
    list_filter = ('verification_status',)
    search_fields = ('user__email', 'registration_number', 'clinic_name')


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient_code', 'user', 'phone_normalized', 'gender', 'is_claimed')
    search_fields = ('patient_code', 'user__email', 'phone_normalized')
    list_filter = ('is_claimed', 'gender')


@admin.register(PharmacyProfile)
class PharmacyProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'pharmacy_name', 'user', 'license_number', 'city', 'verification_status')
    list_filter = ('verification_status', 'city')
    search_fields = ('pharmacy_name', 'license_number', 'user__email')


@admin.register(CareAccess)
class CareAccessAdmin(admin.ModelAdmin):
    list_display = ('id', 'doctor', 'patient', 'scope', 'status', 'granted_via', 'expires_at')
    list_filter = ('status', 'scope', 'granted_via')
    search_fields = ('doctor__user__email', 'patient__patient_code', 'patient__user__email')


@admin.register(PatientAccessCode)
class PatientAccessCodeAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'attempts', 'expires_at', 'used_at')
    search_fields = ('patient__patient_code', 'patient__user__email')
