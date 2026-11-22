from django.urls import path
from . import views

urlpatterns = [
    path('patient/documents', views.MedicalDocumentListCreateView.as_view()),
    path('patient/documents/<int:pk>', views.MedicalDocumentDetailView.as_view()),
    path('patient/family', views.FamilyMemberListCreateView.as_view()),
    path('patient/reminders', views.MedicationReminderListCreateView.as_view()),
    path('patient/reminders/<int:pk>/take', views.MedicationReminderToggleView.as_view()),
]
