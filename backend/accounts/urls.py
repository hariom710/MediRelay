from django.urls import path

from . import patient_views, views

urlpatterns = [
    path('auth/register', views.RegisterView.as_view()),
    path('auth/login', views.LoginView.as_view()),
    path('auth/logout', views.LogoutView.as_view()),
    path('auth/change-password', views.ChangePasswordView.as_view()),
    path('auth/me', views.MeView.as_view()),
    path('auth/switch-role', views.SwitchRoleView.as_view()),
    path('auth/claim', patient_views.ClaimProfileView.as_view()),
    path('doctor/profile', views.DoctorProfileView.as_view()),
    path('doctor/dashboard', views.DoctorDashboardView.as_view()),
    path('pharmacy/dashboard', views.PharmacyDashboardView.as_view()),
    path('patient/profile', views.PatientProfileView.as_view()),
    path('pharmacy/profile', views.PharmacyProfileView.as_view()),
    path('admin/verifications', views.VerificationQueueView.as_view()),
    path('admin/verifications/<str:profile_type>/<int:pk>',
         views.VerificationDecisionView.as_view()),
    # Patient Universal Registry & Search
    path('patients/search', patient_views.PatientSearchView.as_view()),
    path('patients', patient_views.PatientListCreateView.as_view()),
    path('patients/<int:pk>', patient_views.PatientDetailView.as_view()),
    path('patients/<int:pk>/summary', patient_views.PatientSummaryView.as_view()),
    path('patients/<int:pk>/timeline', patient_views.PatientTimelineView.as_view()),
    path('patients/<int:pk>/visits', patient_views.VisitListCreateView.as_view()),
    # Consent & CareAccess Management
    path('access/requests', patient_views.CareAccessRequestView.as_view()),
    path('access/requests/<int:pk>/<str:action>', patient_views.CareAccessDecisionView.as_view()),
    path('access/code', patient_views.CareAccessCodeView.as_view()),
    path('access/code/redeem', patient_views.CareAccessCodeRedeemView.as_view()),
    path('access', patient_views.CareAccessListView.as_view()),
    path('access/<int:pk>', patient_views.CareAccessListView.as_view()),
    path('access/<int:pk>/revoke', patient_views.CareAccessRevokeView.as_view()),
    path('access/log', patient_views.CareAccessLogView.as_view()),
    path('me/patient-code', patient_views.MePatientCodeView.as_view()),
]
