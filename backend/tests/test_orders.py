"""Gate 3: concurrent orders cannot oversell stock. Plus order -> invoice flow."""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from inventory.models import MedicineBatch

from .helpers import build_prescription, quote_from, set_stock

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _order(client, patient, rx, selection):
    client.force_login(patient)
    return client.post('/api/v1/orders', {
        'prescription_id': rx.id,
        'selection': [{'prescription_item': pi, 'pharmacy': pid}
                      for pi, pid in selection]}, format='json')


def test_order_requires_full_coverage(client, doctor, patient, pharmacy, pharmacy2,
                                      medicine, medicine2):
    rx = build_prescription(doctor, patient, [(medicine, 10), (medicine2, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10), medicine2.id: (100, 10)})
    quote_from(pharmacy2, rx, {medicine2.id: (100, 10)})

    rx_items = list(rx.items.all())
    r = _order(client, patient, rx, [(rx_items[0].id, pharmacy.pharmacy_profile.id)])
    assert r.status_code == 400
    assert r.json()['code'] == 'incomplete_selection'


def test_duplicate_item_in_selection_rejected(client, doctor, patient, pharmacy,
                                              medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)})
    pi = rx.items.first().id
    r = _order(client, patient, rx, [(pi, pharmacy.pharmacy_profile.id),
                                     (pi, pharmacy.pharmacy_profile.id)])
    assert r.status_code == 400
    assert r.json()['code'] == 'duplicate_item'


# --- GATE 3: oversell protection ---

def test_gate3_second_order_cannot_oversell(client, doctor, patient, pharmacy,
                                            medicine):
    """Stock = 10; two orders each needing 10. Second must fail with 409."""
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)})
    set_stock(pharmacy, medicine, 10)

    pi = rx.items.first().id
    pid = pharmacy.pharmacy_profile.id

    r1 = _order(client, patient, rx, [(pi, pid)])
    assert r1.status_code == 201, r1.content

    # same prescription can't be re-ordered fully, so use a second prescription
    rx2 = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx2, {medicine.id: (100, 10)})
    pi2 = rx2.items.first().id
    r2 = _order(client, patient, rx2, [(pi2, pid)])
    assert r2.status_code == 409
    assert r2.json()['code'] == 'insufficient_stock'

    # stock is exactly 0, never negative
    batch = MedicineBatch.objects.get(batch_number='B001')
    assert batch.qty == 0
    assert batch.qty >= 0


def test_gate3b_partial_stock_fails_cleanly(client, doctor, patient, pharmacy,
                                            medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)})
    set_stock(pharmacy, medicine, 6)  # FEFO can only cover 6 of pack-rounded 10

    r = _order(client, patient, rx,
               [(rx.items.first().id, pharmacy.pharmacy_profile.id)])
    assert r.status_code == 409
    assert r.json()['code'] == 'insufficient_stock'
    # nothing partially deducted
    batch = MedicineBatch.objects.get(batch_number='B001')
    assert batch.qty == 6


def test_expired_batch_never_sold(client, doctor, patient, pharmacy, medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)})
    # stock exists but is expired
    set_stock(pharmacy, medicine, 50, days_to_expiry=-1)

    r = _order(client, patient, rx,
               [(rx.items.first().id, pharmacy.pharmacy_profile.id)])
    assert r.status_code == 409


def test_multi_pharmacy_order_creates_two_fulfillments(client, doctor, patient,
                                                       pharmacy, pharmacy2,
                                                       medicine, medicine2):
    rx = build_prescription(doctor, patient, [(medicine, 10), (medicine2, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)}, pickup_fee=20)
    quote_from(pharmacy2, rx, {medicine2.id: (50, 10)}, pickup_fee=30)
    set_stock(pharmacy, medicine, 20)
    set_stock(pharmacy2, medicine2, 20)

    rx_items = {i.medicine_id: i.id for i in rx.items.all()}
    r = _order(client, patient, rx, [
        (rx_items[medicine.id], pharmacy.pharmacy_profile.id),
        (rx_items[medicine2.id], pharmacy2.pharmacy_profile.id)])
    assert r.status_code == 201, r.content
    body = r.json()
    assert len(body['fulfillments']) == 2
    # 1000 + 20 + 500 + 30
    assert Decimal(body['total']) == Decimal('1550.00')


def test_fulfill_generates_invoice_and_completes_order(client, doctor, patient,
                                                       pharmacy, medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)}, pickup_fee=10)
    set_stock(pharmacy, medicine, 20)

    r = _order(client, patient, rx,
               [(rx.items.first().id, pharmacy.pharmacy_profile.id)])
    assert r.status_code == 201, r.content
    order = r.json()
    fid = order['fulfillments'][0]['id']

    client.force_login(pharmacy)
    r = client.post(f'/api/v1/orders/{order["id"]}/fulfillments/{fid}/fulfill',
                    format='json')
    assert r.status_code == 200, r.content
    invoice_no = r.json()['invoice_number']
    assert invoice_no.startswith('INV-')

    # order completed, stock deducted, invoice visible to patient
    client.force_login(patient)
    order_view = client.get(f'/api/v1/orders/{order["id"]}').json()
    assert order_view['status'] == 'completed'
    assert order_view['fulfillments'][0]['invoice']['invoice_number'] == invoice_no

    batch = MedicineBatch.objects.get(batch_number='B001')
    assert batch.qty == 10  # 20 - 10


def test_stock_movement_appended_not_overwritten(client, doctor, patient, pharmacy,
                                                 medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)})
    set_stock(pharmacy, medicine, 20)

    r = _order(client, patient, rx,
               [(rx.items.first().id, pharmacy.pharmacy_profile.id)])
    assert r.status_code == 201

    from inventory.models import StockMovement
    movement = StockMovement.objects.get(ref_type='order_fulfillment')
    assert movement.quantity == -10
    assert movement.reason == 'order fulfilment'


def test_cancel_fulfillment_restores_stock(client, doctor, patient, pharmacy,
                                           medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)})
    set_stock(pharmacy, medicine, 20)

    r = _order(client, patient, rx,
               [(rx.items.first().id, pharmacy.pharmacy_profile.id)])
    order = r.json()
    fid = order['fulfillments'][0]['id']
    assert MedicineBatch.objects.get(batch_number='B001').qty == 10

    r = client.post(f'/api/v1/orders/{order["id"]}/fulfillments/{fid}/cancel',
                    format='json')
    assert r.status_code == 200, r.content
    assert MedicineBatch.objects.get(batch_number='B001').qty == 20

    # cancelled order cannot be fulfilled afterwards
    client.force_login(pharmacy)
    r = client.post(f'/api/v1/orders/{order["id"]}/fulfillments/{fid}/fulfill',
                    format='json')
    assert r.status_code == 409


def test_invoice_pdf_generated(client, doctor, patient, pharmacy, medicine):
    rx = build_prescription(doctor, patient, [(medicine, 10)])
    quote_from(pharmacy, rx, {medicine.id: (100, 10)})
    set_stock(pharmacy, medicine, 20)
    r = _order(client, patient, rx,
               [(rx.items.first().id, pharmacy.pharmacy_profile.id)])
    order = r.json()
    client.force_login(pharmacy)
    r = client.post(f'/api/v1/orders/{order["id"]}/fulfillments/'
                    f'{order["fulfillments"][0]["id"]}/fulfill', format='json')
    invoice_id = None
    client.force_login(patient)
    order_view = client.get(f'/api/v1/orders/{order["id"]}').json()
    invoice_id = order_view['fulfillments'][0]['invoice']['id']
    r = client.get(f'/api/v1/invoices/{invoice_id}/pdf')
    assert r.status_code == 200
    assert r['Content-Type'] == 'application/pdf'
    assert r.content.startswith(b'%PDF')
