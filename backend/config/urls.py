from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/v1/', include([
        path('', include('accounts.urls')),
        path('', include('audit.urls')),
        path('', include('catalog.urls')),
        path('', include('prescriptions.urls')),
        path('', include('inventory.urls')),
        path('', include('quotations.urls')),
        path('', include('orders.urls')),
        path('', include('notifications.urls')),
        path('', include('health_records.urls')),
        path('', include('laboratories.urls')),
        path('', include('ai_services.urls')),
    ])),
]
