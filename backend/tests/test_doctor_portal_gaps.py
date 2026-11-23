"""Backend gaps for the doctor portal (Phase 2).

These tests assert the security-relevant behaviour that the audit found
missing. They are written to FAIL before the implementation and PASS after.
"""

import json

import pytest
from rest_framework.test import APIClient

from accounts.models import Role, User, VerificationStatus

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user(db):
    def _make(email, role, active=None, **profile_kwargs):
        user = User.objects.create_user(email=email, password='Testpass123!')
        role_obj, _ = Role.objects.get_or_create(name=role)
        user.roles.add(role_obj)
        user.active_role = active or role
        user.save()
        if role == 'doctor':
            from accounts.models import DoctorProfile
            DoctorProfile.objects.create(
                user=user, verification_status=profile_kwargs.pop(
                    'verification_status', 'verified'),
                registration_number=profile_kwargs.pop('registration_number', ''),
                **profile_kwargs)
        elif role == 'patient':
            from accounts.models import PatientProfile
            PatientProfile.objects.create(user=user, **profile_kwargs)
        elif role == 'pharmacy':
            from accounts.models import PharmacyProfile
            PharmacyProfile.objects.create(
                user=user,
                pharmacy_name=profile_kwargs.pop(
                    'pharmacy_name', 'Test Pharmacy'),
                verification_status=profile_kwargs.pop(
                    'verification_status', 'verified'),
                **profile_kwargs)
        return user
    return _make


def post(client, path, data):
    return client.post(path, data=json.dumps(data),
                       content_type='application/json')


def patch(client, path, data):
    return client.patch(path, data=json.dumps(data),
                        content_type='application/json')


# --- E1/E2: unverified doctor cannot finalize or share ---

def _finalized_rx(client, doctor, patient, medicine):
    client.force_login(doctor)
    r = post(client, '/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'night': 1,
                   'duration_days': 5, 'qty_per_dose': 1}]})
    assert r.status_code == 201, r.content
    rx_id = r.json()['id']
    confirm = [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
               for i in r.json()['items']]
    r2 = post(client, f'/api/v1/prescriptions/{rx_id}/finalize',
              {'items': confirm})
    assert r2.status_code == 200, r2.content
    return rx_id


def test_unverified_doctor_cannot_finalize(api_client, make_user, patient, medicine):
    """E1: a pending doctor cannot finalize a prescription."""
    unverified = make_user('drpending@example.com', 'doctor',
                           registration_number='MH-PEND',
                           verification_status=VerificationStatus.PENDING)
    client = api_client
    client.force_login(unverified)
    r = post(client, '/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'duration_days': 5}]})
    assert r.status_code == 201, r.content
    rx_id = r.json()['id']
    confirm = [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
               for i in r.json()['items']]
    r2 = post(client, f'/api/v1/prescriptions/{rx_id}/finalize',
              {'items': confirm})
    assert r2.status_code == 403, r2.content
    assert r2.json()['code'] == 'doctor_not_verified'


def test_rejected_doctor_cannot_finalize(api_client, make_user, patient, medicine):
    rejected = make_user('drrej@example.com', 'doctor',
                         registration_number='MH-REJ',
                         verification_status=VerificationStatus.REJECTED)
    client = api_client
    client.force_login(rejected)
    r = post(client, '/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'duration_days': 5}]})
    rx_id = r.json()['id']
    confirm = [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
               for i in r.json()['items']]
    r2 = post(client, f'/api/v1/prescriptions/{rx_id}/finalize',
              {'items': confirm})
    assert r2.status_code == 403


def test_suspended_doctor_cannot_finalize(api_client, make_user, patient, medicine):
    suspended = make_user('drsusp@example.com', 'doctor',
                          registration_number='MH-SUSP',
                          verification_status=VerificationStatus.SUSPENDED)
    client = api_client
    client.force_login(suspended)
    r = post(client, '/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'duration_days': 5}]})
    rx_id = r.json()['id']
    confirm = [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
               for i in r.json()['items']]
    r2 = post(client, f'/api/v1/prescriptions/{rx_id}/finalize',
              {'items': confirm})
    assert r2.status_code == 403


def test_verified_doctor_can_finalize(api_client, doctor, patient, medicine):
    rx_id = _finalized_rx(api_client, doctor, patient, medicine)
    r = api_client.get(f'/api/v1/prescriptions/{rx_id}')
    assert r.status_code == 200


def test_unverified_doctor_cannot_share(api_client, make_user, patient, medicine,
                                       pharmacy):
    unverified = make_user('drshare@example.com', 'doctor',
                           registration_number='MH-SHR',
                           verification_status=VerificationStatus.PENDING)
    client = api_client
    client.force_login(unverified)
    r = post(client, '/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'duration_days': 5}]})
    rx_id = r.json()['id']
    r2 = post(client, f'/api/v1/prescriptions/{rx_id}/shares',
              {'pharmacy_id': pharmacy.pharmacy_profile.id})
    assert r2.status_code == 403, r2.content
    assert r2.json()['code'] == 'doctor_not_verified'


def test_verified_doctor_can_share(api_client, doctor, patient, medicine, pharmacy):
    rx_id = _finalized_rx(api_client, doctor, patient, medicine)
    r = post(api_client, f'/api/v1/prescriptions/{rx_id}/shares',
             {'pharmacy_id': pharmacy.pharmacy_profile.id})
    assert r.status_code == 201, r.content
    assert 'token' in r.json()


# --- E3: edit patient ---

def test_doctor_can_edit_patient(api_client, doctor, patient):
    from accounts.models import PatientProfile
    profile = PatientProfile.objects.get(pk=patient.patient_profile.id)
    profile.created_by = doctor
    profile.save()
    client = api_client
    client.force_login(doctor)
    r = patch(client, f'/api/v1/patients/{profile.id}', {
        'name': 'Updated Name',
        'allergies': 'Penicillin',
        'blood_group': 'O+',
    })
    assert r.status_code == 200, r.content
    assert r.json()['name'] == 'Updated Name'
    assert r.json()['allergies'] == 'Penicillin'
    assert r.json()['blood_group'] == 'O+'


def test_doctor_cannot_edit_another_doctor_patient(api_client, doctor, patient,
                                                   make_user, medicine):
    other = make_user('dr2@example.com', 'doctor',
                      registration_number='MH-2')
    from accounts.models import PatientProfile
    profile = PatientProfile.objects.get(pk=patient.patient_profile.id)
    profile.created_by = doctor  # owned by `doctor`, NOT `other`
    profile.save()
    client = api_client
    client.force_login(other)
    # `other` has NOT prescribed to this patient -> must be rejected
    r = patch(client, f'/api/v1/patients/{profile.id}', {
        'allergies': 'tampered',
    })
    assert r.status_code == 404, r.content


# --- E4: change password ---

def test_change_password(api_client, make_user):
    user = make_user('cp@example.com', 'patient')
    client = api_client
    client.force_login(user)
    r = post(client, '/api/v1/auth/change-password', {
        'old_password': 'Testpass123!',
        'new_password': 'NewStr0ngPass!23',
    })
    assert r.status_code == 200, r.content
    from django.contrib.auth import authenticate
    assert authenticate(email='cp@example.com', password='Testpass123!') is None
    assert authenticate(email='cp@example.com', password='NewStr0ngPass!23') is not None


def test_change_password_wrong_old(api_client, make_user):
    user = make_user('cp2@example.com', 'patient')
    client = api_client
    client.force_login(user)
    r = post(client, '/api/v1/auth/change-password', {
        'old_password': 'WrongOldPass!23',
        'new_password': 'NewStr0ngPass!23',
    })
    assert r.status_code == 400
    assert r.json()['code'] == 'invalid_password'


# --- E5: access logs for a prescription ---

def test_doctor_sees_access_logs_for_own_prescription(api_client, doctor, patient,
                                                      medicine, pharmacy):
    rx_id = _finalized_rx(api_client, doctor, patient, medicine)
    r = post(api_client, f'/api/v1/prescriptions/{rx_id}/shares',
             {'pharmacy_id': pharmacy.pharmacy_profile.id})
    share_id = r.json()['share']['id']
    token = r.json()['token']
    client = api_client
    client.force_login(pharmacy)
    client.get(f'/api/v1/shares/{token}')  # generate an access log
    client.force_login(doctor)
    r = client.get(f'/api/v1/prescriptions/{rx_id}/access-logs')
    assert r.status_code == 200, r.content
    logs = r.json()
    assert isinstance(logs, list)
    assert len(logs) >= 1


def test_doctor_cannot_see_access_logs_for_others_rx(api_client, doctor, patient,
                                                     make_user, medicine):
    other = make_user('dr3@example.com', 'doctor',
                      registration_number='MH-3')
    rx_id = _finalized_rx(api_client, other, patient, medicine)
    client = api_client
    client.force_login(doctor)
    r = client.get(f'/api/v1/prescriptions/{rx_id}/access-logs')
    assert r.status_code == 404


# --- E6: dashboard ---

def test_doctor_dashboard_counts(api_client, doctor, patient, medicine):
    client = api_client
    client.force_login(doctor)
    r = client.get('/api/v1/doctor/dashboard')
    assert r.status_code == 200, r.content
    body = r.json()
    for key in ('drafts', 'finalized_not_shared', 'active_shares',
                'expiring_soon', 'recent_prescriptions', 'recent_patients'):
        assert key in body, f'missing {key}'


def test_non_doctor_cannot_access_dashboard(api_client, patient):
    client = api_client
    client.force_login(patient)
    r = client.get('/api/v1/doctor/dashboard')
    assert r.status_code == 403
