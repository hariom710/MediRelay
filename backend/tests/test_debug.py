import pytest
from rest_framework.test import APIClient

from accounts.models import Role, User

pytestmark = pytest.mark.django_db


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
        return user
    return _make


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def medicine(db):
    from catalog.models import Medicine
    return Medicine.objects.create(
        generic_name='Paracetamol', brand_name='Crocin', strength='500 mg',
        dosage_form='tablet', pack_size=10, pack_unit='tablet')


def test_debug_create(client, make_user, medicine):
    doctor = make_user('drdebug@example.com', 'doctor', registration_number='MH-DBG')
    patient = make_user('patdebug@example.com', 'patient')
    client.force_login(doctor)
    r = client.post('/api/v1/prescriptions', {
        'patient_id': patient.patient_profile.id,
        'consultation_date': '2026-11-20',
        'items': [{'medicine': medicine.id, 'morning': 1, 'night': 1,
                   'duration_days': 5}]}, format='json')
    print("STATUS:", r.status_code)
    print("CONTENT:", r.content)
