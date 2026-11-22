from django.urls import path
from . import views

urlpatterns = [
    path('ai/ocr/extract', views.PrescriptionOCRView.as_view()),
    path('ai/reports/summarize', views.MedicalReportSummarizerView.as_view()),
    path('ai/interactions/check', views.DrugInteractionCheckView.as_view()),
]
