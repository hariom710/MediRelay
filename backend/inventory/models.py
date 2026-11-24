from django.db import models
from config.state_machine import StateMachineMixin


class BatchStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    DEPLETED = 'depleted', 'Depleted'
    EXPIRED = 'expired', 'Expired'
    WRITTEN_OFF = 'written_off', 'Written Off'
    QUARANTINED = 'quarantined', 'Quarantined'


class InventoryItem(models.Model):
    """Per-pharmacy (v1: single branch) row for one medicine."""

    pharmacy = models.ForeignKey('accounts.PharmacyProfile', on_delete=models.CASCADE,
                                 related_name='inventory_items')
    medicine = models.ForeignKey('catalog.Medicine', on_delete=models.PROTECT,
                                 related_name='inventory_items')
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('pharmacy', 'medicine')]
        ordering = ['medicine__generic_name']

    @property
    def available_qty(self):
        from django.utils import timezone
        return sum(b.qty for b in self.batches.filter(status=BatchStatus.ACTIVE).exclude(expiry_date__lt=timezone.now().date()))


class MedicineBatch(StateMachineMixin, models.Model):
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE,
                                       related_name='batches')
    batch_number = models.CharField(max_length=60)
    expiry_date = models.DateField()
    qty = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=BatchStatus.choices,
                              default=BatchStatus.ACTIVE)
    mrp = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    TRANSITIONS = {
        BatchStatus.ACTIVE: [BatchStatus.DEPLETED, BatchStatus.EXPIRED, BatchStatus.QUARANTINED, BatchStatus.WRITTEN_OFF],
        BatchStatus.DEPLETED: [BatchStatus.ACTIVE, BatchStatus.WRITTEN_OFF],
        BatchStatus.QUARANTINED: [BatchStatus.ACTIVE, BatchStatus.WRITTEN_OFF],
        BatchStatus.EXPIRED: [BatchStatus.WRITTEN_OFF],
        BatchStatus.WRITTEN_OFF: [],
    }

    class Meta:
        unique_together = [('inventory_item', 'batch_number')]
        ordering = ['expiry_date']  # FEFO: first expiry first out

    @property
    def is_expired(self):
        from django.utils import timezone
        return self.status == BatchStatus.EXPIRED or self.expiry_date < timezone.now().date()

    def mark_expired(self, actor=None, reason: str = None, request=None, update_fields: list = None):
        return self.transition_to(
            BatchStatus.EXPIRED,
            actor=actor,
            reason=reason or 'Batch expired past expiry date',
            update_fields=update_fields,
            request=request
        )

    def write_off(self, actor=None, reason: str = None, request=None, update_fields: list = None):
        return self.transition_to(
            BatchStatus.WRITTEN_OFF,
            actor=actor,
            reason=reason or 'Batch written off from inventory',
            update_fields=update_fields,
            request=request
        )

    def deplete(self, actor=None, reason: str = None, request=None, update_fields: list = None):
        return self.transition_to(
            BatchStatus.DEPLETED,
            actor=actor,
            reason=reason or 'Batch stock depleted to zero',
            update_fields=update_fields,
            request=request
        )

    def quarantine(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            BatchStatus.QUARANTINED,
            actor=actor,
            reason=reason or 'Batch quarantined for quality inspection',
            request=request
        )

    def reactivate(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            BatchStatus.ACTIVE,
            actor=actor,
            reason=reason or 'Batch reactivated with replenished stock',
            request=request
        )


class StockMovement(models.Model):
    """Append-only. Never overwrite a quantity — record why it changed."""

    TYPE_CHOICES = [('in', 'Stock in'), ('out', 'Sale/fulfilment'),
                    ('adjust', 'Adjustment'), ('expire', 'Expiry write-off'),
                    ('return', 'Return')]

    batch = models.ForeignKey(MedicineBatch, on_delete=models.PROTECT,
                              related_name='movements')
    movement_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    quantity = models.IntegerField()  # signed: +in, -out
    reason = models.CharField(max_length=200, blank=True)
    ref_type = models.CharField(max_length=30, blank=True)  # order_fulfillment, manual...
    ref_id = models.CharField(max_length=40, blank=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL,
                                   null=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
