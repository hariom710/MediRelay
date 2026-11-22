"""Create the admin account used for verification workflows."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts.models import Role, User


class Command(BaseCommand):
    help = 'Create an admin user (or grant admin role to an existing email).'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True,
                            help='Email address for the admin user.')
        parser.add_argument('--password', default=None,
                            help='Required only when creating a new user.')

    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError('seed_admin is disabled in production (DEBUG=False). '
                               'Use createsuperuser or set DJANGO_DEBUG=True in development.')

        email, password = opts['email'], opts['password']
        admin_role, _ = Role.objects.get_or_create(name=Role.ADMIN)
        user = User.objects.filter(email=email).first()
        if user is None:
            if not password:
                raise CommandError('New user: pass --password <pwd>.')
            user = User.objects.create_superuser(
                email=email, password=password,
                is_staff=True, is_superuser=True)
            user.roles.add(admin_role)
            user.active_role = Role.ADMIN
            user.save()
            self.stdout.write(f'Created admin {email}.')
        else:
            user.roles.add(admin_role)
            user.active_role = Role.ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(f'Granted admin to {email}.')
