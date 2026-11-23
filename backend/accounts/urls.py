from django.urls import path

from . import patient_views, views

urlpatterns = [
    path('auth/register', views.RegisterView.as_view()),
    path('auth/login', views.LoginView.as_view()),
    path('auth/logout', views.LogoutView.as_view()),
    path('auth/change-password', views.ChangePasswordView.as_view()),
    path('auth/me', views.MeView.as_view()),
    path('auth/switch-role', views.SwitchRoleView.as_view()),
    path('doctor/profile', views.DoctorProfileView.as_view()),
    path('doctor/dashboard', views.DoctorDashboardView.as_view()),
    path('patient/profile', views.PatientProfileView.as_view()),
    path('pharmacy/profile', views.PharmacyProfileView.as_view()),
    path('admin/verifications', views.VerificationQueueView.as_view()),
    path('admin/verifications/<str:profile_type>/<int:pk>',
         views.VerificationDecisionView.as_view()),
    path('patients', patient_views.PatientListCreateView.as_view()),
    path('patients/<int:pk>', patient_views.PatientDetailView.as_view()),
]
