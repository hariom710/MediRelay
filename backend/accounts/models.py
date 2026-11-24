from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone
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
    # Set for doctor-created accounts; blocks portal use until changed.
    must_change_password = models.BooleanField(default=False)

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

    def submit_for_review(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            VerificationStatus.UNDER_REVIEW,
            actor=actor,
            reason=reason or 'Submitted for administrative verification',
            request=request
        )

    def verify(self, actor=None, reason: str = None, request=None, note: str = ''):
        if note:
            self.verification_note = note
        return self.transition_to(
            VerificationStatus.VERIFIED,
            actor=actor,
            reason=reason or 'Verification approved',
            request=request,
            update_fields=['verification_note'] if note else None
        )

    def reject(self, actor=None, reason: str = None, request=None, note: str = ''):
        if note:
            self.verification_note = note
        return self.transition_to(
            VerificationStatus.REJECTED,
            actor=actor,
            reason=reason or 'Verification rejected',
            request=request,
            update_fields=['verification_note'] if note else None
        )

    def suspend(self, actor=None, reason: str = None, request=None, note: str = ''):
        if note:
            self.verification_note = note
        return self.transition_to(
            VerificationStatus.SUSPENDED,
            actor=actor,
            reason=reason or 'Account suspended',
            request=request,
            update_fields=['verification_note'] if note else None
        )


class DoctorProfile(VerificationStateMachineMixin, models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    qualification = models.CharField(max_length=120, blank=True)
    registration_number = models.CharField(max_length=60, blank=True)
    clinic_name = models.CharField(max_length=160, blank=True)
    verification_status = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING)
    verification_note = models.TextField(blank=True)


class PatientProfile(models.Model):
    """One row per person, global. Never owned by a doctor.

    Access is granted separately via CareAccess. `created_by` records who
    registered the profile and is provenance only — it is never an
    authorization key.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    blood_group = models.CharField(max_length=10, blank=True)
    allergies = models.TextField(blank=True)  # free text in v1; structured allergy table later
    chronic_conditions = models.TextField(blank=True)
    patient_code = models.CharField(max_length=12, unique=True, editable=False)
    phone_normalized = models.CharField(max_length=20, blank=True, db_index=True)
    is_claimed = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='created_patients')

    def save(self, *args, **kwargs):
        from .registry import unique_patient_code, normalize_phone
        if not self.patient_code:
            self.patient_code = unique_patient_code()
        if self.user_id:
            self.phone_normalized = normalize_phone(self.user.phone)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.patient_code} ({self.user_id})'


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


class AccessScope(models.TextChoices):
    BASIC = 'basic', 'Basic'
    FULL = 'full', 'Full'


class AccessStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    ACTIVE = 'active', 'Active'
    DENIED = 'denied', 'Denied'
    REVOKED = 'revoked', 'Revoked'
    EXPIRED = 'expired', 'Expired'


class GrantedVia(models.TextChoices):
    PATIENT_APPROVED = 'patient_approved', 'Patient approved'
    ONE_TIME_CODE = 'one_time_code', 'One-time code'
    LEGACY = 'legacy', 'Legacy import'


class CareAccess(StateMachineMixin, models.Model):
    """A patient's consent for one doctor to read their record.

    One row per (doctor, patient); denying or revoking moves the row back to
    pending so a later re-request reuses it.
    """

    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE,
                               related_name='care_access')
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE,
                                related_name='care_access')
    scope = models.CharField(max_length=10, choices=AccessScope.choices,
                             default=AccessScope.BASIC)
    status = models.CharField(max_length=20, choices=AccessStatus.choices,
                              default=AccessStatus.PENDING)
    granted_via = models.CharField(max_length=20, choices=GrantedVia.choices, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    granted_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    TRANSITIONS = {
        AccessStatus.PENDING: [AccessStatus.ACTIVE, AccessStatus.DENIED],
        AccessStatus.ACTIVE: [AccessStatus.REVOKED, AccessStatus.EXPIRED],
        AccessStatus.DENIED: [AccessStatus.PENDING],
        AccessStatus.REVOKED: [AccessStatus.PENDING],
        AccessStatus.EXPIRED: [AccessStatus.PENDING],
    }

    class Meta:
        unique_together = [('doctor', 'patient')]
        indexes = [
            models.Index(fields=['patient', 'status'], name='idx_access_patient_status'),
            models.Index(fields=['doctor', 'status'], name='idx_access_doctor_status'),
        ]

    def __str__(self):
        return f'{self.doctor_id}->{self.patient_id} {self.status}'

    @property
    def effective_status(self):
        """Expiry is derived on read, so no cron job is needed."""
        if (self.status == AccessStatus.ACTIVE and self.expires_at
                and self.expires_at <= timezone.now()):
            return AccessStatus.EXPIRED
        return self.status

    def grant(self, via, days=365, scope=None, actor=None, request=None):
        if self.status in (AccessStatus.DENIED, AccessStatus.REVOKED, AccessStatus.EXPIRED):
            self.transition_to(AccessStatus.PENDING, actor=actor, request=request,
                               reason='Access re-requested')
        self.granted_via = via
        self.granted_at = timezone.now()
        self.expires_at = timezone.now() + timezone.timedelta(days=days)
        self.revoked_at = None
        if scope:
            self.scope = scope
        fields = ['granted_via', 'granted_at', 'expires_at', 'revoked_at', 'scope']
        if self.status == AccessStatus.PENDING:
            self.transition_to(AccessStatus.ACTIVE, actor=actor, request=request,
                               reason=f'Access granted via {via}', update_fields=fields)
        else:
            self.save(update_fields=fields)

    def deny(self, actor=None, request=None):
        self.transition_to(AccessStatus.DENIED, actor=actor, request=request,
                           reason='Access denied by patient')

    def revoke(self, actor=None, request=None):
        self.revoked_at = timezone.now()
        self.transition_to(AccessStatus.REVOKED, actor=actor, request=request,
                           reason='Access revoked by patient',
                           update_fields=['revoked_at'])


class PatientAccessCode(models.Model):
    """Short-lived in-person consent code. Only the HMAC is stored."""

    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE,
                                related_name='access_codes')
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['patient', 'expires_at'], name='idx_code_patient_exp')]

