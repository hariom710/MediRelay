"""Gate 4: revision preserves the earlier finalized version.
Plus quantity calculation and immutability rules."""

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _create_and_finalize(client, doctor, patient, medicine, qty_confirm='auto'):
    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'afternoon': 0, 'night': 1,
                   'duration_days': 5, 'qty_per_dose': 1}]}, format='json')
    assert r.status_code == 201, r.content
    rx = r.json()
    if qty_confirm == 'auto':
        confirm = [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
                   for i in rx['items']]
    else:
        confirm = qty_confirm
    r2 = client.post(f'/api/v1/prescriptions/{rx["id"]}/finalize',
                     {'items': confirm}, format='json')
    return rx['id'], r2


def test_quantity_calculation_morning_plus_night_times_days(client, doctor, patient,
                                                            medicine):
    rx_id, r = _create_and_finalize(client, doctor, patient, medicine)
    assert r.status_code == 200, r.content
    item = r.json()['items'][0]
    # (1 + 0 + 1) × 1 × 5 = 10 tablets
    assert item['calculated_qty'] == '10'
    assert item['total_qty'] == '10.00'


def test_finalize_requires_quantity_confirmation(client, doctor, patient, medicine):
    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'duration_days': 5}]},
        format='json')
    rx_id = r.json()['id']
    r2 = client.post(f'/api/v1/prescriptions/{rx_id}/finalize',
                     {'items': []}, format='json')
    assert r2.status_code == 400
    assert r2.json()['code'] == 'quantity_unconfirmed'


def test_finalize_rejects_wrong_confirmed_qty(client, doctor, patient, medicine):
    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'night': 1,
                   'duration_days': 5}]}, format='json')
    item_id = r.json()['items'][0]['id']
    r2 = client.post(f'/api/v1/prescriptions/{r.json()["id"]}/finalize',
                     {'items': [{'item_id': item_id, 'confirmed_qty': 99}]},
                     format='json')
    assert r2.status_code == 400
    assert r2.json()['code'] == 'quantity_mismatch'


def test_finalized_prescription_is_immutable(client, doctor, patient, medicine):
    rx_id, r = _create_and_finalize(client, doctor, patient, medicine)
    assert r.status_code == 200
    r2 = client.patch(f'/api/v1/prescriptions/{rx_id}',
                      {'notes': 'hacked'}, format='json')
    assert r2.status_code == 409


# --- GATE 4: revision preserves the earlier finalized version ---

def test_gate4_revise_preserves_previous_version(client, doctor, patient, medicine):
    rx_id, r = _create_and_finalize(client, doctor, patient, medicine)
    assert r.status_code == 200

    r2 = client.post(f'/api/v1/prescriptions/{rx_id}/revise',
                     {'reason': 'dosage change'}, format='json')
    assert r2.status_code == 200, r2.content
    new_rx = r2.json()
    assert new_rx['version'] == 2
    assert new_rx['previous_version'] == rx_id

    # old version still readable, marked revised, items intact
    old = client.get(f'/api/v1/prescriptions/{rx_id}').json()
    assert old['status'] == 'revised'
    assert len(old['items']) == 1
    assert old['items'][0]['total_qty'] == '10.00'

    # revised (old) prescription can no longer be revised again
    r3 = client.post(f'/api/v1/prescriptions/{rx_id}/revise',
                     {'reason': 'again'}, format='json')
    assert r3.status_code == 409


def test_revise_requires_reason(client, doctor, patient, medicine):
    rx_id, r = _create_and_finalize(client, doctor, patient, medicine)
    r2 = client.post(f'/api/v1/prescriptions/{rx_id}/revise', {}, format='json')
    assert r2.status_code == 400


def test_share_link_lifecycle(client, doctor, patient, pharmacy, medicine):
    rx_id, r = _create_and_finalize(client, doctor, patient, medicine)

    r = client.post(f'/api/v1/prescriptions/{rx_id}/shares',
                    {'pharmacy_id': pharmacy.pharmacy_profile.id,
                     'expires_in_days': 7}, format='json')
    assert r.status_code == 201, r.content
    token = r.json()['token']
    share_id = r.json()['share']['id']

    # pharmacy opens it: scoped view, no history/contact
    client.force_login(pharmacy)
    r = client.get(f'/api/v1/shares/{token}')
    assert r.status_code == 200, r.content
    body = r.json()['prescription']
    assert 'patient_display' in body
    assert 'allergy_flag' in body
    assert 'items' in body
    assert 'notes' not in body          # doctor's internal notes not exposed
    assert 'patient_name' not in body   # full history serializer not used

    # access was logged
    from audit.models import PrescriptionAccessLog
    assert PrescriptionAccessLog.objects.filter(
        share_id=share_id, user=pharmacy, role='pharmacy').exists()

    # revoke -> 410
    client.force_login(doctor)
    client.post(f'/api/v1/prescriptions/{rx_id}/shares/{share_id}/revoke',
                format='json')
    client.force_login(pharmacy)
    r = client.get(f'/api/v1/shares/{token}')
    assert r.status_code == 410
    assert r.json()['code'] == 'revoked'


def test_expired_share_rejected(client, doctor, patient, pharmacy, medicine):
    from django.utils import timezone
    rx_id, r = _create_and_finalize(client, doctor, patient, medicine)
    r = client.post(f'/api/v1/prescriptions/{rx_id}/shares', {}, format='json')
    token = r.json()['token']

    from prescriptions.models import PrescriptionShare
    import hashlib
    share = PrescriptionShare.objects.get(
        token_hash=hashlib.sha256(token.encode()).hexdigest())
    share.expires_at = timezone.now() - timezone.timedelta(days=1)
    share.save()

    client.force_login(pharmacy)
    r = client.get(f'/api/v1/shares/{token}')
    assert r.status_code == 410
    assert r.json()['code'] == 'expired'


def test_targeted_share_not_openable_by_other_pharmacy(client, doctor, patient,
                                                       pharmacy, pharmacy2, medicine):
    rx_id, r = _create_and_finalize(client, doctor, patient, medicine)
    r = client.post(f'/api/v1/prescriptions/{rx_id}/shares',
                    {'pharmacy_id': pharmacy.pharmacy_profile.id}, format='json')
    token = r.json()['token']

    client.force_login(pharmacy2)
    r = client.get(f'/api/v1/shares/{token}')
    assert r.status_code == 404
