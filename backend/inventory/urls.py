from django.urls import path

from . import views

urlpatterns = [
    path('pharmacy/inventory', views.InventoryListCreateView.as_view()),
    path('pharmacy/inventory/<int:pk>', views.InventoryDetailView.as_view()),
    path('pharmacy/inventory/<int:item_id>/batches', views.BatchCreateView.as_view()),
    path('pharmacy/inventory/<int:item_id>/adjust/<int:batch_id>', views.StockAdjustmentView.as_view()),
    path('pharmacy/inventory/<int:item_id>/ledger', views.StockLedgerView.as_view()),
    path('pharmacy/inventory/<int:item_id>/expire/<int:batch_id>', views.ExpireBatchView.as_view()),
    path('pharmacy/inventory/alerts', views.ExpiryAlertView.as_view()),
]
