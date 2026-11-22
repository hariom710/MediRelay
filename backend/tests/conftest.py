import pytest

from accounts.models import Role, User


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
                pharmacy_name=profile_kwargs.pop('pharmacy_name', 'Test Pharmacy'),
                verification_status=profile_kwargs.pop(
                    'verification_status', 'verified'),
                **profile_kwargs)
        return user
    return _make


@pytest.fixture
def doctor(make_user):
    return make_user('dr@example.com', 'doctor', registration_number='MH-1234')


@pytest.fixture
def patient(make_user):
    return make_user('pat@example.com', 'patient')


@pytest.fixture
def pharmacy(make_user):
    return make_user('rx@example.com', 'pharmacy', pharmacy_name='City Pharmacy')


@pytest.fixture
def pharmacy2(make_user):
    return make_user('rx2@example.com', 'pharmacy', pharmacy_name='Budget Chemists')


@pytest.fixture
def admin(make_user):
    return make_user('admin@example.com', 'admin')


@pytest.fixture
def medicine(db):
    from catalog.models import Medicine
    return Medicine.objects.create(
        generic_name='Paracetamol', brand_name='Crocin', strength='500 mg',
        dosage_form='tablet', pack_size=10, pack_unit='tablet')


@pytest.fixture
def medicine2(db):
    from catalog.models import Medicine
    return Medicine.objects.create(
        generic_name='Amoxicillin', brand_name='Mox', strength='500 mg',
        dosage_form='capsule', pack_size=10, pack_unit='capsule')


def login(client, user, password='Testpass123!'):
    client.force_login(user)
    return client
