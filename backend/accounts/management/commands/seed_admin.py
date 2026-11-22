"""Create the admin account used for verification workflows."""

from django.core.management.base import BaseCommand

from accounts.models import Role, User


class Command(BaseCommand):
    help = 'Create an admin user (or grant admin role to an existing email).'

    def add_arguments(self, parser):
        parser.add_argument('--email', default='admin@medirelay.local')
        parser.add_argument('--password', default=None,
                           help='Required only when creating a new user.')

    def handle(self, *args, **opts):
        email, password = opts['email'], opts['password']
        admin_role, _ = Role.objects.get_or_create(name=Role.ADMIN)
        user = User.objects.filter(email=email).first()
        if user is None:
            if not password:
                self.stderr.write('New user: pass --password <pwd>.')
                return
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
