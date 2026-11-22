"""Permission matrix: role x endpoint, asserted from the spec."""

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_patient_cannot_create_prescription(client, patient, medicine, doctor):
    client.force_login(patient)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1}]}, format='json')
    assert r.status_code == 403


def test_pharmacy_cannot_create_prescription(client, pharmacy, patient, medicine):
    client.force_login(pharmacy)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1}]}, format='json')
    assert r.status_code == 403


def test_doctor_cannot_submit_quotation(client, doctor, pharmacy, medicine):
    client.force_login(doctor)
    r = client.post('/api/v1/quotations', {'share_id': 1, 'items': []}, format='json')
    assert r.status_code == 403


def test_patient_cannot_submit_quotation(client, patient):
    client.force_login(patient)
    r = client.post('/api/v1/quotations', {'share_id': 1, 'items': []}, format='json')
    assert r.status_code == 403


def test_unverified_pharmacy_cannot_quote_or_hold_inventory(client, make_user,
                                                            medicine):
    unverified = make_user('uv@example.com', 'pharmacy',
                           pharmacy_name='Unverified Meds',
                           verification_status='pending')
    client.force_login(unverified)
    assert client.get('/api/v1/pharmacy/requests').status_code == 403
    assert client.get('/api/v1/pharmacy/inventory').status_code == 403
    assert client.post('/api/v1/quotations', {}, format='json').status_code == 403


def test_non_admin_cannot_verify_accounts(client, doctor, pharmacy):
    client.force_login(doctor)
    r = client.post(f'/api/v1/admin/verifications/pharmacy/'
                    f'{pharmacy.pharmacy_profile.id}',
                    {'decision': 'approve'}, format='json')
    assert r.status_code == 403


def test_non_admin_cannot_write_medicine_catalogue(client, doctor, medicine):
    client.force_login(doctor)
    r = client.post('/api/v1/medicines', {
        'generic_name': 'Fake', 'dosage_form': 'tablet'}, format='json')
    assert r.status_code == 403


def test_non_admin_cannot_read_audit_logs(client, doctor):
    client.force_login(doctor)
    assert client.get('/api/v1/admin/audit-logs').status_code == 403


def test_patient_cannot_read_others_notifications(client, patient, make_user):
    from notifications.models import Notification
    other = make_user('other2@example.com', 'patient')
    Notification.objects.create(user=other, notification_type='x',
                                title='secret')
    client.force_login(patient)
    r = client.get('/api/v1/notifications').json()
    assert r['notifications'] == []


def test_doctor_patient_list_scoped_to_own_patients(client, doctor, make_user):
    """Gate 2 companion: doctor sees only their own patients."""
    stranger_doc = make_user('dr2@example.com', 'doctor',
                             registration_number='MH-9999')
    from accounts.models import PatientProfile
    # patient created by another doctor
    import secrets
    from django.contrib.auth import get_user_model
    User = get_user_model()
    u = User.objects.create_user(email=f'p{secrets.token_hex(4)}@x.com',
                                 password='x', first_name='Other')
    from accounts.models import Role
    u.roles.add(Role.objects.get_or_create(name='patient')[0])
    PatientProfile.objects.create(user=u, created_by=stranger_doc)

    client.force_login(doctor)
    r = client.get('/api/v1/patients').json()
    assert r == []


def test_admin_verification_flow(client, admin, make_user):
    new_doc = make_user('newdr@example.com', 'doctor',
                        registration_number='MH-7777',
                        verification_status='pending')
    client.force_login(admin)

    r = client.get('/api/v1/admin/verifications?status=pending').json()
    assert any(d['id'] == new_doc.doctor_profile.id for d in r['doctors'])

    r = client.post(f'/api/v1/admin/verifications/doctor/'
                    f'{new_doc.doctor_profile.id}',
                    {'decision': 'approve', 'note': 'verified license'},
                    format='json')
    assert r.status_code == 200
    assert r.json()['verification_status'] == 'verified'

    # audit trail exists
    from audit.models import AuditLog
    assert AuditLog.objects.filter(action='account.verify',
                                   object_id=str(new_doc.doctor_profile.id)).exists()


def test_pharmacy_without_share_cannot_access_prescription(client, pharmacy, doctor, patient, medicine):
    """Gate 1: Pharmacy cannot access an unshared prescription."""
    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'duration_days': 5}]}, format='json')
    rx_id = r.json()['id']
    client.post(f'/api/v1/prescriptions/{rx_id}/finalize',
                {'items': [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
                           for i in r.json()['items']]}, format='json')

    client.force_login(pharmacy)
    assert client.get(f'/api/v1/prescriptions/{rx_id}').status_code == 404


def test_revoked_and_expired_share_token_rejected(client, doctor, patient, pharmacy, medicine):
    """Gate 1: Revoked or expired share tokens return 410."""
    from django.utils import timezone
    from prescriptions.models import Prescription, PrescriptionShare
    import hashlib

    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'duration_days': 5}]}, format='json')
    rx_id = r.json()['id']
    client.post(f'/api/v1/prescriptions/{rx_id}/finalize',
                {'items': [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
                           for i in r.json()['items']]}, format='json')

    rx = Prescription.objects.get(pk=rx_id)

    # 1. Revoked share
    revoked_share = PrescriptionShare.objects.create(
        prescription=rx,
        token_hash=hashlib.sha256(b"revoked_token_123").hexdigest(),
        created_by=patient,
        expires_at=timezone.now() + timezone.timedelta(days=7),
        revoked_at=timezone.now()
    )
    client.force_login(pharmacy)
    res_revoked = client.get('/api/v1/shares/revoked_token_123')
    assert res_revoked.status_code == 410
    assert res_revoked.json()['code'] == 'revoked'

    # 2. Expired share
    expired_share = PrescriptionShare.objects.create(
        prescription=rx,
        token_hash=hashlib.sha256(b"expired_token_123").hexdigest(),
        created_by=patient,
        expires_at=timezone.now() - timezone.timedelta(days=1)
    )
    res_expired = client.get('/api/v1/shares/expired_token_123')
    assert res_expired.status_code == 410
    assert res_expired.json()['code'] == 'expired'


def test_doctor_cannot_modify_other_doctor_prescription(client, make_user, patient, medicine):
    """Doctor A cannot edit, revise, or cancel Doctor B's prescription."""
    doc_a = make_user('doc_a@example.com', 'doctor', registration_number='DOC-A')
    doc_b = make_user('doc_b@example.com', 'doctor', registration_number='DOC-B')

    client.force_login(doc_a)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'duration_days': 5}]}, format='json')
    rx_id = r.json()['id']

    # Doc B attempts patch
    client.force_login(doc_b)
    patch_res = client.patch(f'/api/v1/prescriptions/{rx_id}', {'notes': 'tampered'})
    assert patch_res.status_code == 404

    # Finalize by Doc A
    client.force_login(doc_a)
    client.post(f'/api/v1/prescriptions/{rx_id}/finalize',
                {'items': [{'item_id': i['id'], 'confirmed_qty': i['calculated_qty']}
                           for i in r.json()['items']]}, format='json')

    # Doc B attempts cancel
    client.force_login(doc_b)
    cancel_res = client.post(f'/api/v1/prescriptions/{rx_id}/cancel', {'reason': 'malicious cancel'})
    assert cancel_res.status_code == 404


def test_doctor_cannot_access_admin_endpoints(client, doctor, pharmacy):
    """Doctor role receives 403 on admin-only endpoints."""
    client.force_login(doctor)
    assert client.get('/api/v1/admin/verifications').status_code == 403
    assert client.get('/api/v1/admin/audit-logs').status_code == 403
    assert client.post(f'/api/v1/admin/verifications/pharmacy/{pharmacy.pharmacy_profile.id}',
                       {'decision': 'approve'}).status_code == 403
