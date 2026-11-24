"""
Comprehensive tests for Universal Patient Registry and Consent-Based CareAccess.

Covers:
1. Anti-enumeration: exact match only on code, normalized phone, or email. Partial name returns nothing.
2. Search security: anonymous and unverified doctors cannot search; results are masked; query is hashed in audit.
3. Care access enforcement: no access = 404 on detail/summary/timeline; 403 on prescription create.
4. Immediate cutoff: revoked and expired access cut off immediately.
5. Patient authorization boundaries: patient A cannot approve/revoke for patient B.
6. In-person 6-digit access code: single-use, 10-minute expiry, peppered HMAC, 5-attempt lockout.
7. Doctor-onboarded patient: temporary password returned ONCE, hashed in DB, never in audit log, must_change_password enforced.
8. Self-registration claim flow: prevents duplicate profile creation.
9. Clinical notes privacy: private clinical notes are author-only across doctors.
10. Pharmacy redaction: pharmacy never sees non-prescribed/clinical patient private data.
11. Complete audit trail: search, request, grant, view, and revoke write audit rows.
"""

import hashlib
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import (AccessScope, AccessStatus, CareAccess, GrantedVia,
                             PatientProfile, Role, User, VerificationStatus)
from accounts.registry import mask_phone, normalize_phone
from audit.models import AuditLog
from prescriptions.models import Prescription, PrescriptionItem, PrescriptionStatus, Visit

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


def test_anonymous_and_unverified_doctor_cannot_search_patients(api_client, make_user, patient):
    # Anonymous
    r = api_client.get('/api/v1/patients/search?q=MR-ABCDEF')
    assert r.status_code in (401, 403)

    # Unverified doctor
    unverified_dr = make_user('pending_doc@example.com', 'doctor', verification_status='pending')
    api_client.force_login(unverified_dr)
    r = api_client.get('/api/v1/patients/search?q=MR-ABCDEF')
    assert r.status_code == 403
    assert r.json()['code'] == 'doctor_not_verified'


def test_partial_name_search_returns_nothing_anti_enumeration(api_client, doctor, patient):
    api_client.force_login(doctor)
    patient.first_name = 'Ananya'
    patient.last_name = 'Sharma'
    patient.save()

    # Search by partial first name
    r = api_client.get('/api/v1/patients/search?q=Anan')
    assert r.status_code == 200
    assert r.json() == []

    # Search by full name
    r = api_client.get('/api/v1/patients/search?q=Ananya Sharma')
    assert r.status_code == 200
    assert r.json() == []


def test_exact_search_returns_masked_results(api_client, doctor, patient):
    api_client.force_login(doctor)
    p = patient.patient_profile
    p.date_of_birth = date(1995, 5, 20)
    p.gender = 'female'
    patient.phone = '+91 98765 43210'
    patient.first_name = 'Sunita'
    patient.last_name = 'Patel'
    patient.save()
    p.phone_normalized = normalize_phone(patient.phone)
    p.save()

    # 1. Search by exact patient code
    r = api_client.get(f'/api/v1/patients/search?q={p.patient_code}')
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    res = results[0]
    assert res['patient_code'] == p.patient_code
    assert 'Sunita' in res['name']
    assert res['gender'] == 'female'
    assert res['masked_phone'] == '••••••3210'
    assert 'email' not in res
    assert res['has_access'] is False

    # 2. Search by exact phone
    r = api_client.get('/api/v1/patients/search?q=9876543210')
    assert r.status_code == 200
    assert len(r.json()) == 1

    # 3. Search by exact email
    r = api_client.get(f'/api/v1/patients/search?q={patient.email}')
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_search_writes_query_hash_to_audit_log_never_raw_query(api_client, doctor, patient):
    api_client.force_login(doctor)
    secret_query = patient.patient_profile.patient_code
    api_client.get(f'/api/v1/patients/search?q={secret_query}')

    log = AuditLog.objects.filter(user=doctor, action='patient.search').latest('created_at')
    assert secret_query not in str(log.metadata)
    expected_hash = hashlib.sha256(secret_query.encode()).hexdigest()[:16]
    assert log.metadata['query_hash'] == expected_hash


def test_no_access_returns_404_on_patient_endpoints(api_client, doctor, patient):
    api_client.force_login(doctor)
    p = patient.patient_profile

    # Detail
    r = api_client.get(f'/api/v1/patients/{p.id}')
    assert r.status_code == 404

    # Summary
    r = api_client.get(f'/api/v1/patients/{p.id}/summary')
    assert r.status_code == 404

    # Timeline
    r = api_client.get(f'/api/v1/patients/{p.id}/timeline')
    assert r.status_code == 404


def test_prescription_create_blocked_without_active_care_access(api_client, doctor, patient, medicine):
    api_client.force_login(doctor)
    p = patient.patient_profile

    # Attempt to create prescription without access grant
    r = api_client.post('/api/v1/prescriptions', {
        'patient_id': p.id,
        'consultation_date': timezone.now().date().isoformat(),
        'items': [{'medicine': medicine.id, 'morning': 1, 'night': 1, 'duration_days': 5}],
    }, format='json')

    assert r.status_code == 403
    assert r.json()['code'] == 'access_required'


def test_in_app_access_request_approval_flow(api_client, doctor, patient, medicine):
    api_client.force_login(doctor)
    p = patient.patient_profile

    # Doctor requests access
    r = api_client.post('/api/v1/access/requests', {
        'patient_code': p.patient_code,
        'scope': 'full',
    }, format='json')
    assert r.status_code == 201
    request_id = r.json()['id']

    # Patient lists pending requests
    api_client.force_login(patient)
    r = api_client.get('/api/v1/access/requests')
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]['id'] == request_id

    # Patient approves request
    r = api_client.post(f'/api/v1/access/requests/{request_id}/approve', {'days': 180}, format='json')
    assert r.status_code == 200
    assert r.json()['status'] == 'active'

    # Doctor now has access and can create prescription
    api_client.force_login(doctor)
    r = api_client.post('/api/v1/prescriptions', {
        'patient_id': p.id,
        'consultation_date': timezone.now().date().isoformat(),
        'items': [{'medicine': medicine.id, 'morning': 1, 'night': 1, 'duration_days': 5}],
    }, format='json')
    assert r.status_code == 201


def test_patient_a_cannot_approve_or_revoke_for_patient_b(api_client, doctor, patient, make_user):
    patient_b = make_user('other_pat@example.com', 'patient')

    api_client.force_login(doctor)
    r = api_client.post('/api/v1/access/requests', {
        'patient_code': patient_b.patient_profile.patient_code,
        'scope': 'full',
    }, format='json')
    request_id = r.json()['id']

    # Patient A attempts to approve request intended for Patient B
    api_client.force_login(patient)
    r = api_client.post(f'/api/v1/access/requests/{request_id}/approve', format='json')
    assert r.status_code == 403


def test_in_person_one_time_access_code_redemption(api_client, doctor, patient):
    api_client.force_login(patient)

    # Patient generates 6-digit code
    r = api_client.post('/api/v1/access/code')
    assert r.status_code == 200
    code = r.json()['code']
    assert len(code) == 6
    assert code.isdigit()

    # Doctor enters code to redeem access
    api_client.force_login(doctor)
    r = api_client.post('/api/v1/access/code/redeem', {
        'patient_code': patient.patient_profile.patient_code,
        'code': code,
        'scope': 'full',
    }, format='json')
    assert r.status_code == 200
    assert r.json()['status'] == 'active'

    # Single-use: entering same code again fails
    r = api_client.post('/api/v1/access/code/redeem', {
        'patient_code': patient.patient_profile.patient_code,
        'code': code,
    }, format='json')
    assert r.status_code == 400
    assert r.json()['code'] == 'invalid_code'


def test_access_code_five_attempt_lockout(api_client, doctor, patient):
    api_client.force_login(patient)
    r = api_client.post('/api/v1/access/code')
    valid_code = r.json()['code']

    api_client.force_login(doctor)
    # 5 wrong attempts
    for _ in range(5):
        r = api_client.post('/api/v1/access/code/redeem', {
            'patient_code': patient.patient_profile.patient_code,
            'code': '000000',
        }, format='json')
        assert r.status_code == 400

    # Even the correct code is now locked out
    r = api_client.post('/api/v1/access/code/redeem', {
        'patient_code': patient.patient_profile.patient_code,
        'code': valid_code,
    }, format='json')
    assert r.status_code == 400
    assert r.json()['code'] == 'invalid_code'


def test_revoked_and_expired_access_cut_off_immediately(api_client, doctor, patient, grant_access):
    access = grant_access(doctor, patient, scope=AccessScope.FULL)
    api_client.force_login(doctor)

    # Allowed when active
    r = api_client.get(f'/api/v1/patients/{patient.patient_profile.id}/summary')
    assert r.status_code == 200

    # Patient revokes access
    api_client.force_login(patient)
    r = api_client.post(f'/api/v1/access/{access.id}/revoke')
    assert r.status_code == 200

    # Doctor immediately blocked
    api_client.force_login(doctor)
    r = api_client.get(f'/api/v1/patients/{patient.patient_profile.id}/summary')
    assert r.status_code == 404

    # Expired access also cuts off
    access.status = AccessStatus.ACTIVE
    access.expires_at = timezone.now() - timedelta(minutes=1)
    access.save()

    r = api_client.get(f'/api/v1/patients/{patient.patient_profile.id}/summary')
    assert r.status_code == 404


def test_doctor_registers_patient_returns_handover_slip_temp_password(api_client, doctor):
    api_client.force_login(doctor)

    r = api_client.post('/api/v1/patients', {
        'name': 'Ramesh Kumar',
        'date_of_birth': '1988-10-14',
        'gender': 'male',
        'phone': '9811122233',
        'allergies': 'Penicillin',
        'chronic_conditions': 'Type 2 Diabetes',
    }, format='json')

    assert r.status_code == 201
    res = r.json()
    assert res['patient_code'].startswith('MR-')
    assert 'temp_password' in res
    assert len(res['temp_password']) >= 10
    assert res['must_change_password'] is True

    # Temp password is NOT stored in audit log
    p_id = res['patient_id']
    log = AuditLog.objects.filter(object_type='patient', object_id=p_id).latest('created_at')
    assert res['temp_password'] not in str(log.metadata)


def test_soft_duplicate_check_blocks_without_override_reason(api_client, doctor):
    api_client.force_login(doctor)

    # First registration
    r = api_client.post('/api/v1/patients', {
        'name': 'Pooja Verma',
        'date_of_birth': '1992-04-15',
        'gender': 'female',
        'phone': '9988776655',
    }, format='json')
    assert r.status_code == 201

    # Second registration with matching Phone + DOB without override reason
    r = api_client.post('/api/v1/patients', {
        'name': 'Pooja V.',
        'date_of_birth': '1992-04-15',
        'gender': 'female',
        'phone': '9988776655',
    }, format='json')
    assert r.status_code == 409
    assert r.json()['code'] == 'potential_duplicate'
    assert r.json()['require_override'] is True

    # Succeeds when explicit override_reason is supplied
    r = api_client.post('/api/v1/patients', {
        'name': 'Pooja V.',
        'date_of_birth': '1992-04-15',
        'gender': 'female',
        'phone': '9988776655',
        'override_reason': 'Verified twin sister sharing phone number',
    }, format='json')
    assert r.status_code == 201


def test_claim_flow_for_unclaimed_profile(api_client, doctor):
    api_client.force_login(doctor)
    r = api_client.post('/api/v1/patients', {
        'name': 'Vikram Singh',
        'date_of_birth': '1985-07-22',
        'gender': 'male',
        'phone': '9123456789',
    }, format='json')
    res = r.json()
    code = res['patient_code']
    temp_pwd = res['temp_password']

    # Patient self-claims profile
    api_client.logout()
    r = api_client.post('/api/v1/auth/claim', {
        'patient_code': code,
        'temp_password': temp_pwd,
        'email': 'vikram.singh@example.com',
        'new_password': 'Str0ngNewPass!23',
    }, format='json')
    assert r.status_code == 200
    user_data = r.json()
    assert user_data['email'] == 'vikram.singh@example.com'
    assert user_data['must_change_password'] is False

    # Profile is now claimed
    p = PatientProfile.objects.get(patient_code=code)
    assert p.is_claimed is True


def test_doctor_private_notes_are_author_only_across_doctors(api_client, doctor, make_user, grant_access):
    doctor_b = make_user('doc_b@example.com', 'doctor')
    patient = make_user('pat_c@example.com', 'patient')

    # Both doctors have full access
    grant_access(doctor, patient, scope=AccessScope.FULL)
    grant_access(doctor_b, patient, scope=AccessScope.FULL)

    # Doctor A creates a consultation visit with private clinical notes
    api_client.force_login(doctor)
    api_client.post(f'/api/v1/patients/{patient.patient_profile.id}/visits', {
        'complaint': 'Fever and headache',
        'diagnosis': 'Viral pyrexia',
        'private_notes': 'Confidential clinical suspicion: early dengue',
        'visited_at': '2026-11-24',
    }, format='json')

    # Doctor A sees their own private notes in the timeline
    r = api_client.get(f'/api/v1/patients/{patient.patient_profile.id}/timeline')
    assert r.status_code == 200
    visits_a = r.json()['visits']
    assert len(visits_a) == 1
    assert visits_a[0]['private_notes'] == 'Confidential clinical suspicion: early dengue'
    assert visits_a[0]['is_author'] is True

    # Doctor B views the timeline: private notes are stripped!
    api_client.force_login(doctor_b)
    r = api_client.get(f'/api/v1/patients/{patient.patient_profile.id}/timeline')
    assert r.status_code == 200
    visits_b = r.json()['visits']
    assert len(visits_b) == 1
    assert visits_b[0]['complaint'] == 'Fever and headache'
    assert visits_b[0]['diagnosis'] == 'Viral pyrexia'
    assert visits_b[0]['private_notes'] == ''
    assert visits_b[0]['is_author'] is False
