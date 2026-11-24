"""Tests for newly completed flows, permissions, and edge cases."""
from decimal import Decimal
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Role, VerificationStatus
from catalog.models import Medicine
from inventory.models import MedicineBatch, BatchStatus
from orders.models import Order, OrderFulfillment, FulfillmentStatus
from prescriptions.models import Prescription, PrescriptionStatus, ShareStatus
from quotations.models import Quotation, QuotationStatus

from .helpers import build_prescription, quote_from, set_stock

pytestmark = pytest.mark.django_db


def test_patient_can_list_own_prescriptions(doctor, patient, medicine):
    client = APIClient()
    rx = build_prescription(doctor, patient, [(medicine, 10)])

    client.force_login(patient)
    res = client.get('/api/v1/prescriptions')
    assert res.status_code == 200
    ids = [r['id'] for r in res.json()]
    assert rx.id in ids


def test_pharmacy_with_quote_can_view_prescription(doctor, patient, pharmacy, medicine):
    client = APIClient()
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)})

    client.force_login(pharmacy)
    res = client.get(f'/api/v1/prescriptions/{rx.id}')
    assert res.status_code == 200
    assert res.json()['id'] == rx.id


def test_quotation_reject_flow(doctor, patient, pharmacy, medicine):
    client = APIClient()
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    q = quote_from(pharmacy, rx, {medicine.id: (100, 10)})

    client.force_login(patient)
    res = client.post(f'/api/v1/quotations/{q.id}/reject', {'reason': 'Found better rate'})
    assert res.status_code == 200
    q.refresh_from_db()
    assert q.status == QuotationStatus.REJECTED


def test_cannot_quote_expired_prescription(doctor, patient, pharmacy, medicine):
    client = APIClient()
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    # Expire prescription
    rx.valid_until = timezone.now().date() - timezone.timedelta(days=1)
    rx.status = PrescriptionStatus.EXPIRED
    rx.save(update_fields=['valid_until', 'status'], bypass_transition_check=True)

    client.force_login(pharmacy)
    res = client.post('/api/v1/quotations', {
        'prescription': rx.id,
        'pickup_fee': 0,
        'valid_days': 3,
        'items': [{'prescription_item': rx.items.first().id, 'available': True, 'unit_price': 10, 'qty_offered': 10}],
    })
    assert res.status_code == 410
    assert res.json()['code'] == 'prescription_expired'


def test_order_rollup_mixed_fulfillments_completes_order(doctor, patient, pharmacy, pharmacy2, medicine, medicine2):
    client = APIClient()
    rx = build_prescription(doctor, patient, [(medicine, 10), (medicine2, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10), medicine2.id: (100, 10)})
    quote_from(pharmacy2, rx, {medicine2.id: (100, 10)})
    set_stock(pharmacy, medicine, 20)
    set_stock(pharmacy2, medicine2, 20)

    pi1 = rx.items.get(medicine=medicine).id
    pi2 = rx.items.get(medicine=medicine2).id

    client.force_login(patient)
    r = client.post('/api/v1/orders', {
        'prescription_id': rx.id,
        'selection': [
            {'prescription_item': pi1, 'pharmacy': pharmacy.pharmacy_profile.id},
            {'prescription_item': pi2, 'pharmacy': pharmacy2.pharmacy_profile.id},
        ]
    }, format='json')
    assert r.status_code == 201, r.json()
    order_id = r.json()['id']
    order = Order.objects.get(id=order_id)
    fuls = list(order.fulfillments.all())
    assert len(fuls) == 2

    # Pharmacy 1 fulfills
    client.force_login(pharmacy)
    r1 = client.post(f'/api/v1/orders/{order_id}/fulfillments/{fuls[0].id}/fulfill')
    assert r1.status_code == 200, r1.content

    # Pharmacy 2 cancels
    client.force_login(pharmacy2)
    r2 = client.post(f'/api/v1/orders/{order_id}/fulfillments/{fuls[1].id}/cancel', {'reason': 'Out of stock'})
    assert r2.status_code == 200, r2.content

    order.refresh_from_db()
    # Since fuls[0] is FULFILLED and fuls[1] is CANCELLED (all terminal), order must be COMPLETED
    assert order.status == 'completed'
