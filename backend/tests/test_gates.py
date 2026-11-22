"""Release gates 1, 2 and 5, plus auth basics."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_register_and_login(client):
    r = client.post('/api/v1/auth/register', {
        'role': 'patient', 'email': 'new@example.com', 'password': 'Str0ngPass!23',
        'full_name': 'Test User'}, format='json')
    assert r.status_code == 201, r.content
    assert r.json()['roles'] == ['patient']
    assert r.json()['active_role'] == 'patient'

    client.logout()
    r = client.post('/api/v1/auth/login',
                    {'email': 'new@example.com', 'password': 'Str0ngPass!23'},
                    format='json')
    assert r.status_code == 200
    assert r.json()['email'] == 'new@example.com'


def test_login_wrong_password(client, patient):
    r = client.post('/api/v1/auth/login',
                    {'email': 'pat@example.com', 'password': 'wrong'}, format='json')
    assert r.status_code == 400
    assert r.json()['code'] == 'invalid_credentials'


def test_me_requires_auth(client):
    r = client.get('/api/v1/auth/me')
    assert r.status_code in (401, 403)


def test_switch_role_rejects_unheld_role(client, patient):
    client.force_login(patient)
    r = client.post('/api/v1/auth/switch-role', {'role': 'admin'}, format='json')
    assert r.status_code == 403


# --- GATE 1: a pharmacy cannot access a prescription not shared with it ---

def test_gate1_pharmacy_cannot_access_unshared_prescription(client, doctor, patient,
                                                            pharmacy, medicine):
    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'night': 1,
                   'duration_days': 5}]}, format='json')
    assert r.status_code == 201, r.content
    rx_id = r.json()['id']
    r = client.post(f'/api/v1/prescriptions/{rx_id}/finalize',
                    {'items': [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
                               for i in r.json()['items']]}, format='json')
    assert r.status_code == 200, r.content

    client.force_login(pharmacy)
    r = client.get(f'/api/v1/prescriptions/{rx_id}')
    assert r.status_code == 404  # not shared -> must not exist for this pharmacy
    assert 'patient' not in r.content.decode().lower() or r.status_code == 404


def test_gate1_pharmacy_cannot_list_other_prescriptions(client, doctor, patient,
                                                        pharmacy, medicine):
    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1,
                   'duration_days': 3}]}, format='json')
    client.force_login(pharmacy)
    r = client.get('/api/v1/prescriptions')
    # pharmacy role is not the doctor list endpoint's permission -> 403
    assert r.status_code == 403


# --- GATE 2: a patient cannot view another patient's prescription ---

def test_gate2_patient_cannot_read_other_patients_rx(client, doctor, make_user,
                                                     medicine):
    other = make_user('other@example.com', 'patient')
    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': other.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1,
                   'duration_days': 3}]}, format='json')
    rx_id = r.json()['id']

    # stranger patient
    stranger = make_user('stranger@example.com', 'patient')
    client.force_login(stranger)
    assert client.get(f'/api/v1/prescriptions/{rx_id}').status_code == 404


# --- GATE 5: failed notification must not undo a committed prescription ---

def test_gate5_notification_failure_does_not_undo_prescription(
        client, doctor, patient, medicine, monkeypatch):
    from notifications import services as nservices

    def boom(*a, **k):
        raise RuntimeError('notification subsystem down')

    monkeypatch.setattr(nservices, 'notify', boom)
    # views imported notify by name — patch there too
    import prescriptions.views as pv
    monkeypatch.setattr(pv, 'notify', boom)

    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1,
                   'duration_days': 3}]}, format='json')
    assert r.status_code == 201, r.content
    from prescriptions.models import Prescription
    assert Prescription.objects.filter(pk=r.json()['id']).exists()


def test_unauthenticated_share_token_rejected(client, doctor, patient, medicine):
    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'duration_days': 3}]},
        format='json')
    rx_id = r.json()['id']
    client.post(f'/api/v1/prescriptions/{rx_id}/finalize',
                {'items': [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
                           for i in r.json()['items']]}, format='json')
    client.logout()
    r = client.post(f'/api/v1/prescriptions/{rx_id}/shares', {}, format='json')
    assert r.status_code in (401, 403)
