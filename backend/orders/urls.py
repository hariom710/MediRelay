from django.urls import path

from . import views

urlpatterns = [
    path('orders', views.OrderCreateView.as_view()),
    path('orders/list', views.OrderListView.as_view()),
    path('pharmacy/orders', views.PharmacyOrderListView.as_view()),
    path('pharmacy/invoices', views.InvoiceListView.as_view()),
    path('orders/<int:pk>', views.OrderDetailView.as_view()),
    path('orders/<int:pk>/fulfillments/<int:fulfillment_id>/fulfill',
         views.FulfillView.as_view()),
    path('orders/<int:pk>/fulfillments/<int:fulfillment_id>/cancel',
         views.CancelFulfillmentView.as_view()),
    path('invoices/<int:pk>', views.InvoiceDetailView.as_view()),
    path('invoices/<int:pk>/pdf', views.InvoicePDFView.as_view()),
    path('invoices/<int:pk>/payment', views.PaymentStatusView.as_view()),
]
