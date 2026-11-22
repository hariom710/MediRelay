from django.urls import path

from . import views

urlpatterns = [
    path('prescriptions', views.PrescriptionListCreateView.as_view()),
    path('prescriptions/<int:pk>', views.PrescriptionDetailView.as_view()),
    path('prescriptions/<int:pk>/finalize', views.PrescriptionFinalizeView.as_view()),
    path('prescriptions/<int:pk>/revise', views.PrescriptionReviseView.as_view()),
    path('prescriptions/<int:pk>/cancel', views.PrescriptionCancelView.as_view()),
    path('prescriptions/<int:pk>/pdf', views.PrescriptionPDFView.as_view()),
    path('prescriptions/<int:pk>/shares', views.ShareListCreateView.as_view()),
    path('prescriptions/<int:pk>/shares/<int:share_id>/revoke',
         views.ShareRevokeView.as_view()),
    path('shares/<str:token>', views.ShareTokenView.as_view()),
]
