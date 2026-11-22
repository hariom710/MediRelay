from django.urls import path
from . import views

urlpatterns = [
    path('labs/tests', views.DiagnosticTestSearchView.as_view()),
    path('labs/bookings', views.LabBookingListCreateView.as_view()),
]
