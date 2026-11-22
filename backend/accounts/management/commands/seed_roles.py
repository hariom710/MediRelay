"""Ensure the four base roles exist (run before first login attempts)."""

from django.core.management.base import BaseCommand

from accounts.models import Role


class Command(BaseCommand):
    help = 'Create doctor/patient/pharmacy/admin roles if missing.'

    def handle(self, *args, **opts):
        for name in (Role.DOCTOR, Role.PATIENT, Role.PHARMACY, Role.ADMIN):
            _, created = Role.objects.get_or_create(name=name)
            self.stdout.write(f'{"created" if created else "exists"}: {name}')
