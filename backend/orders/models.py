from django.db import models
from config.state_machine import StateMachineMixin


class OrderStatus(models.TextChoices):
    PLACED = 'placed', 'Placed'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'


class FulfillmentStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    FULFILLED = 'fulfilled', 'Fulfilled'
    CANCELLED = 'cancelled', 'Cancelled'


class PaymentStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    PAID = 'paid', 'Paid'
    FAILED = 'failed', 'Failed'
    REFUNDED = 'refunded', 'Refunded'


class Order(StateMachineMixin, models.Model):
    """One order per prescription selection; may span several pharmacies."""

    patient = models.ForeignKey('accounts.PatientProfile', on_delete=models.PROTECT,
                                related_name='orders')
    prescription = models.ForeignKey('prescriptions.Prescription', on_delete=models.PROTECT,
                                     related_name='orders')
    status = models.CharField(max_length=20, choices=OrderStatus.choices,
                              default=OrderStatus.PLACED)

    TRANSITIONS = {
        OrderStatus.PLACED: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        OrderStatus.COMPLETED: [],
        OrderStatus.CANCELLED: [],
    }
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class OrderFulfillment(StateMachineMixin, models.Model):
    """One per pharmacy in the order. Each pharmacy invoices separately."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='fulfillments')
    pharmacy = models.ForeignKey('accounts.PharmacyProfile', on_delete=models.PROTECT,
                                 related_name='fulfillments')
    status = models.CharField(max_length=20, choices=FulfillmentStatus.choices,
                              default=FulfillmentStatus.PENDING)

    TRANSITIONS = {
        FulfillmentStatus.PENDING: [FulfillmentStatus.FULFILLED, FulfillmentStatus.CANCELLED],
        FulfillmentStatus.FULFILLED: [],
        FulfillmentStatus.CANCELLED: [],
    }
    pickup_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('order', 'pharmacy')]


class OrderItem(models.Model):
    fulfillment = models.ForeignKey(OrderFulfillment, on_delete=models.CASCADE,
                                    related_name='items')
    prescription_item = models.ForeignKey('prescriptions.PrescriptionItem',
                                          on_delete=models.PROTECT,
                                          related_name='+')
    medicine = models.ForeignKey('catalog.Medicine', on_delete=models.PROTECT,
                                 related_name='+')
    qty = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = [('fulfillment', 'prescription_item')]


class Invoice(StateMachineMixin, models.Model):
    status_field_name = 'payment_status'
    fulfillment = models.OneToOneField(OrderFulfillment, on_delete=models.PROTECT,
                                        related_name='invoice')
    invoice_number = models.CharField(max_length=30, unique=True)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices,
                                      default=PaymentStatus.PENDING)
    issued_at = models.DateTimeField(auto_now_add=True)

    TRANSITIONS = {
        PaymentStatus.PENDING: [PaymentStatus.PAID, PaymentStatus.FAILED],
        PaymentStatus.PAID: [PaymentStatus.REFUNDED],
        PaymentStatus.FAILED: [PaymentStatus.PENDING],
        PaymentStatus.REFUNDED: [],
    }

    class Meta:
        ordering = ['-issued_at']
