from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('api/v1/', include([
        path('', include('accounts.urls')),
        path('', include('audit.urls')),
        path('', include('catalog.urls')),
        path('', include('prescriptions.urls')),
        path('', include('inventory.urls')),
        path('', include('quotations.urls')),
        path('', include('orders.urls')),
        path('', include('notifications.urls')),
    ])),
]

# Fix (f): Restrict django-admin in production (only enable if DEBUG or DJANGO_ENABLE_ADMIN is True)
if settings.DEBUG or getattr(settings, 'ENABLE_DJANGO_ADMIN', False):
    urlpatterns.insert(0, path('django-admin/', admin.site.urls))
