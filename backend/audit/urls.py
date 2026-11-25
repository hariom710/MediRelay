from django.urls import path

from . import views

urlpatterns = [
    path('admin/audit-logs', views.AuditLogListView.as_view()),
    path('admin/audit-logs/verify', views.AuditLogVerifyView.as_view()),
]
