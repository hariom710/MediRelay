"""Shared builders for tests: prescriptions, quotations, stock."""

from django.utils import timezone


def build_prescription(doctor, patient, items):
    """items: [(medicine, required_qty), ...] -> finalized Prescription.
    required_qty is encoded as morning=qty, duration=1, qty_per_dose=1."""
    from prescriptions.models import Prescription, PrescriptionItem, PrescriptionStatus
    from prescriptions.services import computed_total

    rx = Prescription.objects.create(
        patient=patient.patient_profile, doctor=doctor.doctor_profile,
        consultation_date=timezone.now().date(), status=PrescriptionStatus.FINALIZED,
        signed_at=timezone.now())
    for i, (medicine, qty) in enumerate(items):
        item = PrescriptionItem.objects.create(
            prescription=rx, medicine=medicine,
            strength=medicine.strength, dosage_form=medicine.dosage_form,
            morning=qty, afternoon=0, night=0, duration_days=1, qty_per_dose=1,
            sort_order=i)
        item.total_qty = computed_total(item)
        item.save(update_fields=['total_qty'])
    return rx


def quote_from(pharmacy_user, rx, item_map, pickup_fee=0, submit=True,
               offered=None, unavailable=None, valid_days=2):
    """item_map: {medicine_id: (unit_price, qty_offered)}.
    offered: {rx_item_id: offered_medicine_id} substitutions.
    unavailable: set of rx_item_id marked unavailable."""
    from quotations.models import Quotation, QuotationItem, QuotationStatus

    unavailable = unavailable or set()
    offered = offered or {}
    profile = pharmacy_user.pharmacy_profile
    quote = Quotation.objects.create(
        prescription=rx, pharmacy=profile,
        pickup_fee=pickup_fee,
        valid_until=timezone.now() + timezone.timedelta(days=valid_days),
        status=QuotationStatus.SUBMITTED if submit else QuotationStatus.DRAFT,
        submitted_at=timezone.now() if submit else None)
    total = 0
    for item in rx.items.all():
        if item.medicine_id not in item_map:
            continue
        price, qty = item_map[item.medicine_id]
        is_unavailable = item.id in unavailable
        qi = QuotationItem.objects.create(
            quotation=quote, prescription_item=item,
            offered_medicine_id=offered.get(item.id),
            available=not is_unavailable,
            qty_offered=0 if is_unavailable else qty,
            unit_price=price)
        if not is_unavailable:
            from math import ceil
            pack = item.medicine.pack_size or 1
            charged = max(1, ceil(int(item.total_qty) / pack)) * pack
            total += qi.unit_price * charged
    quote.total = total
    quote.save()
    return quote


def set_stock(pharmacy_user, medicine, qty, batch_no='B001', days_to_expiry=365):
    from inventory.models import InventoryItem, MedicineBatch, StockMovement

    profile = pharmacy_user.pharmacy_profile
    item, _ = InventoryItem.objects.get_or_create(
        pharmacy=profile, medicine=medicine,
        defaults={'selling_price': 100})
    batch, created = MedicineBatch.objects.get_or_create(
        inventory_item=item, batch_number=batch_no,
        defaults={'expiry_date': timezone.now().date() +
                  timezone.timedelta(days=days_to_expiry),
                  'qty': qty, 'mrp': 120, 'purchase_price': 80})
    if not created:
        batch.qty = qty
        batch.save(update_fields=['qty'])
    return item
