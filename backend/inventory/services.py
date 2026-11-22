"""FEFO deduction shared by order fulfilment. Locks batches, refuses expired/short stock."""

from django.db import transaction
from django.utils import timezone

from .models import MedicineBatch, StockMovement


class InsufficientStock(Exception):
    def __init__(self, medicine_name, needed, available):
        self.medicine_name = medicine_name
        self.needed = needed
        self.available = available
        super().__init__(f'{medicine_name}: need {needed}, have {available}')


def deduct_fefo(inventory_item, qty, ref_type, ref_id, user) -> list[MedicineBatch]:
    """Deduct `qty` units from non-expired batches, earliest expiry first.
    Returns the batches touched. Rolls back completely if stock is short."""
    touched = []
    remaining = qty
    with transaction.atomic():
        batches = (MedicineBatch.objects
                   .select_for_update()
                   .filter(inventory_item=inventory_item,
                           expiry_date__gte=timezone.now().date(), qty__gt=0)
                   .order_by('expiry_date', 'id'))
        for batch in batches:
            if remaining <= 0:
                break
            take = min(batch.qty, remaining)
            batch.qty -= take
            batch.save(update_fields=['qty'])
            StockMovement.objects.create(
                batch=batch, movement_type='out', quantity=-take,
                reason='order fulfilment', ref_type=ref_type, ref_id=str(ref_id),
                created_by=user)
            remaining -= take
            touched.append(batch)
        if remaining > 0:
            raise InsufficientStock(
                inventory_item.medicine.display_name, qty,
                qty - remaining)
    return touched


def restock(batches_with_qty, ref_type, ref_id, user):
    """Reverse a deduction (order/fulfilment cancelled)."""
    for batch, qty in batches_with_qty:
        batch.qty += qty
        batch.save(update_fields=['qty'])
        StockMovement.objects.create(
            batch=batch, movement_type='return', quantity=qty,
            reason='cancelled order', ref_type=ref_type, ref_id=str(ref_id),
            created_by=user)
