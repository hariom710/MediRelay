from rest_framework import permissions

from .models import Role


def _active_role(request):
    return getattr(request.user, 'active_role', '') or ''


class IsRole(permissions.BasePermission):
    """Allow when the user's active portal role is in `allowed`."""

    allowed: tuple = ()

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and _active_role(request) in self.allowed)


class IsDoctor(IsRole):
    allowed = (Role.DOCTOR,)


class IsPatient(IsRole):
    allowed = (Role.PATIENT,)


class IsPharmacy(IsRole):
    allowed = (Role.PHARMACY,)


class IsAdminRole(IsRole):
    allowed = (Role.ADMIN,)


class IsVerifiedPharmacy(IsPharmacy):
    """Pharmacy portal + verified by admin. Quotes/orders require this."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        profile = getattr(request.user, 'pharmacy_profile', None)
        return profile is not None and profile.verification_status == 'verified'
