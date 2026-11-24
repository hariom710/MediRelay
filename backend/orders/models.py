from django.db import models
from config.state_machine import StateMachineMixin


class OrderStatus(models.TextChoices):
    PLACED = 'placed', 'Placed'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'


class FulfillmentStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    IN_PROGRESS = 'in_progress', 'In progress'
    READY_FOR_PICKUP = 'ready_for_pickup', 'Ready for pickup'
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

    def complete(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            OrderStatus.COMPLETED,
            actor=actor,
            reason=reason or 'All fulfillments completed',
            request=request
        )

    def cancel(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            OrderStatus.CANCELLED,
            actor=actor,
            reason=reason or 'Order cancelled',
            request=request
        )


class OrderFulfillment(StateMachineMixin, models.Model):
    """One per pharmacy in the order. Each pharmacy invoices separately."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='fulfillments')
    pharmacy = models.ForeignKey('accounts.PharmacyProfile', on_delete=models.PROTECT,
                                 related_name='fulfillments')
    status = models.CharField(max_length=20, choices=FulfillmentStatus.choices,
                              default=FulfillmentStatus.PENDING)

    TRANSITIONS = {
        FulfillmentStatus.PENDING: [
            FulfillmentStatus.IN_PROGRESS,
            FulfillmentStatus.FULFILLED,
            FulfillmentStatus.CANCELLED,
        ],
        FulfillmentStatus.IN_PROGRESS: [
            FulfillmentStatus.READY_FOR_PICKUP,
            FulfillmentStatus.FULFILLED,
            FulfillmentStatus.CANCELLED,
        ],
        FulfillmentStatus.READY_FOR_PICKUP: [
            FulfillmentStatus.FULFILLED,
            FulfillmentStatus.CANCELLED,
        ],
        FulfillmentStatus.FULFILLED: [],
        FulfillmentStatus.CANCELLED: [],
    }
    pickup_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('order', 'pharmacy')]
        indexes = [
            models.Index(fields=['pharmacy'], name='idx_orderfulfillment_pharmacy'),
            models.Index(fields=['pharmacy', 'status'], name='idx_orderfulfillment_pharm_status'),
        ]

    def start_processing(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            FulfillmentStatus.IN_PROGRESS,
            actor=actor,
            reason=reason or 'Pharmacy started preparing fulfillment',
            request=request
        )

    def mark_ready(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            FulfillmentStatus.READY_FOR_PICKUP,
            actor=actor,
            reason=reason or 'Order ready for pharmacy pickup',
            request=request
        )

    def fulfill(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            FulfillmentStatus.FULFILLED,
            actor=actor,
            reason=reason or 'Order fulfillment completed',
            request=request
        )

    def cancel(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            FulfillmentStatus.CANCELLED,
            actor=actor,
            reason=reason or 'Fulfillment cancelled',
            request=request
        )


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
        constraints = [
            models.CheckConstraint(
                check=models.Q(payment_status__in=['pending', 'paid', 'failed', 'refunded']),
                name='valid_payment_status',
            ),
        ]


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

    def mark_paid(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            PaymentStatus.PAID,
            actor=actor,
            reason=reason or 'Invoice marked paid',
            request=request
        )

    def mark_failed(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            PaymentStatus.FAILED,
            actor=actor,
            reason=reason or 'Payment failed',
            request=request
        )

    def refund(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            PaymentStatus.REFUNDED,
            actor=actor,
            reason=reason or 'Invoice refunded',
            request=request
        )
