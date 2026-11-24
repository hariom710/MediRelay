from django.urls import path

from . import views

urlpatterns = [
    path('pharmacy/requests', views.PharmacyRequestsView.as_view()),
    path('quotations', views.QuotationListCreateView.as_view()),
    path('quotations/<int:pk>', views.QuotationDetailView.as_view()),
    path('quotations/<int:pk>/submit', views.QuotationSubmitView.as_view()),
    path('quotations/<int:pk>/mark-viewed', views.QuotationMarkViewedView.as_view()),
    path('quotations/<int:pk>/reject', views.QuotationRejectView.as_view()),
    path('quotations/<int:pk>/revise', views.QuotationReviseView.as_view()),
    path('prescriptions/<int:pk>/quotations',
         views.PrescriptionQuotationsView.as_view()),
    path('price-comparisons', views.PriceComparisonView.as_view()),
]
