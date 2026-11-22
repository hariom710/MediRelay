from django.urls import path

from . import views

urlpatterns = [
    path('pharmacy/inventory', views.InventoryListCreateView.as_view()),
    path('pharmacy/inventory/<int:pk>', views.InventoryDetailView.as_view()),
    path('pharmacy/inventory/<int:item_id>/batches', views.BatchCreateView.as_view()),
    path('pharmacy/inventory/alerts', views.ExpiryAlertView.as_view()),
]
