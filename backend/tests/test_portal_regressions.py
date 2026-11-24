"""Regression: pharmacy stock-in reactivation and quotation submit-on-create."""

import pytest
from django.utils import timezone

from inventory.models import BatchStatus, MedicineBatch
from prescriptions.models import PrescriptionShare
from quotations.models import Quotation, QuotationStatus

from .helpers import build_prescription, set_stock

pytestmark = pytest.mark.django_db


def test_stock_in_reactivates_depleted_batch(client, pharmacy, medicine):
    item = set_stock(pharmacy, medicine, 0, batch_no='B-RE')
    batch = MedicineBatch.objects.get(inventory_item=item, batch_number='B-RE')
    batch.deplete(actor=pharmacy)
    assert batch.status == BatchStatus.DEPLETED

    client.force_login(pharmacy)
    r = client.post(f'/api/v1/pharmacy/inventory/{item.id}/batches', {
        'batch_number': 'B-RE',
        'expiry_date': str(timezone.now().date() + timezone.timedelta(days=90)),
        'qty': 20, 'mrp': 120, 'purchase_price': 80},
        content_type='application/json')
    assert r.status_code == 201, r.content
    batch.refresh_from_db()
    assert batch.status == BatchStatus.ACTIVE
    assert batch.qty == 20


def test_quotation_create_with_submit_is_immediately_visible(
        client, doctor, patient, pharmacy, medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    item = rx.items.first()
    PrescriptionShare.objects.create(
        prescription=rx, pharmacy=pharmacy.pharmacy_profile, token_hash='c' * 64,
        created_by=doctor, expires_at=timezone.now() + timezone.timedelta(days=7))
    client.force_login(pharmacy)

    r = client.post('/api/v1/quotations', {
        'prescription': rx.id,
        'submit': True,
        'items': [{'prescription_item': item.id, 'available': False,
                   'unit_price': 0, 'qty_offered': 0}]},
        content_type='application/json')
    assert r.status_code == 400, r.content
    assert r.json()['code'] == 'empty_quotation'

    r = client.post('/api/v1/quotations', {
        'prescription': rx.id,
        'submit': True,
        'items': [{'prescription_item': item.id, 'available': True,
                   'unit_price': 10, 'qty_offered': 10}]},
        content_type='application/json')
    assert r.status_code == 201, r.content
    assert r.json()['status'] == QuotationStatus.SUBMITTED
    quote = Quotation.objects.get(prescription=rx,
                                  pharmacy=pharmacy.pharmacy_profile)
    assert quote.submitted_at is not None


def test_patient_can_create_open_share_for_own_rx(client, doctor, patient, medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    client.force_login(patient)

    r = client.post(f'/api/v1/prescriptions/{rx.id}/shares', {},
                    content_type='application/json')
    assert r.status_code == 201, r.content
    assert r.json()['token']


def test_unverified_pharmacy_cannot_view_shared_prescription(
        client, make_user, doctor, patient, medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    unverified = make_user('unver@rx.com', 'pharmacy',
                           verification_status='pending')
    PrescriptionShare.objects.create(
        prescription=rx, pharmacy=unverified.pharmacy_profile, token_hash='d' * 64,
        created_by=doctor, expires_at=timezone.now() + timezone.timedelta(days=7))
    client.force_login(unverified)

    r = client.get(f'/api/v1/prescriptions/{rx.id}')
    assert r.status_code == 404
