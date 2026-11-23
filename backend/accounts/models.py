from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from config.state_machine import StateMachineMixin


class UserManager(BaseUserManager):
    """Email is the identifier; no username field."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError('Users must have an email address')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('is_active', True)
        if extra.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        return self._create_user(email, password, **extra)


class VerificationStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    UNDER_REVIEW = 'under_review', 'Under review'
    VERIFIED = 'verified', 'Verified'
    REJECTED = 'rejected', 'Rejected'
    SUSPENDED = 'suspended', 'Suspended'


class Role(models.Model):
    """Static table: doctor / patient / pharmacy / admin."""

    DOCTOR = 'doctor'
    PATIENT = 'patient'
    PHARMACY = 'pharmacy'
    ADMIN = 'admin'
    ALL = (DOCTOR, PATIENT, PHARMACY, ADMIN)

    name = models.CharField(max_length=20, unique=True, choices=[
        (DOCTOR, 'Doctor'), (PATIENT, 'Patient'),
        (PHARMACY, 'Pharmacy'), (ADMIN, 'Admin'),
    ])

    def __str__(self):
        return self.name


class User(AbstractUser):
    """One login, many roles via user_roles; active_role picks the portal."""

    username = None  # email identifies the user
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    roles = models.ManyToManyField('Role', related_name='users', blank=True)
    active_role = models.CharField(max_length=20, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    objects = UserManager()

    def has_role(self, role: str) -> bool:
        return self.roles.filter(name=role).exists()

    @property
    def role_names(self) -> list:
        return list(self.roles.values_list('name', flat=True))

    def __str__(self):
        return self.email


class VerificationStateMachineMixin(StateMachineMixin):
    status_field_name = 'verification_status'
    TRANSITIONS = {
        VerificationStatus.PENDING: [VerificationStatus.UNDER_REVIEW, VerificationStatus.VERIFIED, VerificationStatus.REJECTED],
        VerificationStatus.UNDER_REVIEW: [VerificationStatus.VERIFIED, VerificationStatus.REJECTED],
        VerificationStatus.VERIFIED: [VerificationStatus.SUSPENDED],
        VerificationStatus.SUSPENDED: [VerificationStatus.UNDER_REVIEW, VerificationStatus.VERIFIED],
        VerificationStatus.REJECTED: [VerificationStatus.UNDER_REVIEW],
    }


class DoctorProfile(VerificationStateMachineMixin, models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    qualification = models.CharField(max_length=120, blank=True)
    registration_number = models.CharField(max_length=60, blank=True)
    clinic_name = models.CharField(max_length=160, blank=True)
    verification_status = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING)
    verification_note = models.TextField(blank=True)


class PatientProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    blood_group = models.CharField(max_length=10, blank=True)
    allergies = models.TextField(blank=True)  # free text in v1; structured allergy table later
    created_by = models.ForeignKey(User, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='created_patients')


class PharmacyProfile(VerificationStateMachineMixin, models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='pharmacy_profile')
    pharmacy_name = models.CharField(max_length=160)
    license_number = models.CharField(max_length=60, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=80, blank=True)
    pin_code = models.CharField(max_length=10, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    opening_hours = models.CharField(max_length=200, blank=True)
    contact_person = models.CharField(max_length=120, blank=True)
    default_pickup_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    default_validity_days = models.IntegerField(default=7)
    verification_status = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING)
    verification_note = models.TextField(blank=True)
