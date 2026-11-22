from django.urls import path

from . import views

urlpatterns = [
    path('medicines/search', views.MedicineSearchView.as_view()),
    path('medicines', views.MedicineCreateView.as_view()),
    path('medicines/<int:pk>', views.MedicineDetailView.as_view()),
]
