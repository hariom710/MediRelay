from django.conf import settings
from django.db import models
from config.state_machine import StateMachineMixin


class PrescriptionStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    FINALIZED = 'finalized', 'Finalized'
    REVISED = 'revised', 'Revised'
    CANCELLED = 'cancelled', 'Cancelled'
    EXPIRED = 'expired', 'Expired'


class MealTiming(models.TextChoices):
    BEFORE = 'before_food', 'Before food'
    AFTER = 'after_food', 'After food'
    WITH = 'with_food', 'With food'
    EMPTY = 'empty_stomach', 'Empty stomach'
    BEDTIME = 'at_bedtime', 'At bedtime'
    AS_NEEDED = 'as_needed', 'As needed'
    OTHER = 'other', 'Other'


class Prescription(StateMachineMixin, models.Model):
    patient = models.ForeignKey('accounts.PatientProfile', on_delete=models.PROTECT,
                                related_name='prescriptions')
    doctor = models.ForeignKey('accounts.DoctorProfile', on_delete=models.PROTECT,
                               related_name='prescriptions')
    status = models.CharField(max_length=20, choices=PrescriptionStatus.choices,
                              default=PrescriptionStatus.DRAFT)

    TRANSITIONS = {
        PrescriptionStatus.DRAFT: [PrescriptionStatus.FINALIZED, PrescriptionStatus.CANCELLED],
        PrescriptionStatus.FINALIZED: [PrescriptionStatus.REVISED, PrescriptionStatus.CANCELLED, PrescriptionStatus.EXPIRED],
        PrescriptionStatus.REVISED: [],     # Terminal state for version N
        PrescriptionStatus.CANCELLED: [],   # Terminal state
        PrescriptionStatus.EXPIRED: [],     # Terminal state
    }
    version = models.PositiveIntegerField(default=1)
    previous_version = models.ForeignKey('self', null=True, blank=True,
                                         on_delete=models.SET_NULL,
                                         related_name='next_versions')
    consultation_date = models.DateField()
    valid_until = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    revision_reason = models.CharField(max_length=300, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.valid_until and self.consultation_date:
            from datetime import date, timedelta
            c_date = self.consultation_date
            if isinstance(c_date, str):
                c_date = date.fromisoformat(c_date)
            self.valid_until = c_date + timedelta(days=30)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'RX-{self.pk} v{self.version} ({self.status})'

    @property
    def is_expired(self):
        from django.utils import timezone
        from datetime import date, timedelta
        if self.status == PrescriptionStatus.EXPIRED:
            return True
        now_date = timezone.now().date()
        c_date = self.consultation_date
        if isinstance(c_date, str):
            c_date = date.fromisoformat(c_date)
        v_date = self.valid_until
        if isinstance(v_date, str):
            v_date = date.fromisoformat(v_date)
        target = v_date or (c_date + timedelta(days=30))
        return now_date > target

    def finalize(self, actor=None, reason: str = None, request=None):
        from django.utils import timezone
        self.signed_at = timezone.now()
        return self.transition_to(
            PrescriptionStatus.FINALIZED,
            actor=actor,
            reason=reason or 'Prescription finalized and signed',
            request=request,
            update_fields=['signed_at']
        )

    def revise(self, reason: str, actor=None, request=None):
        self.revision_reason = reason
        return self.transition_to(
            PrescriptionStatus.REVISED,
            actor=actor,
            reason=reason,
            request=request,
            update_fields=['revision_reason']
        )

    def cancel(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            PrescriptionStatus.CANCELLED,
            actor=actor,
            reason=reason or 'Prescription cancelled',
            request=request
        )

    def expire(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            PrescriptionStatus.EXPIRED,
            actor=actor,
            reason=reason or 'Prescription expired',
            request=request
        )


class PrescriptionItem(models.Model):
    """One medicine line. Structured dosage — not plain text."""

    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE,
                                     related_name='items')
    medicine = models.ForeignKey('catalog.Medicine', on_delete=models.PROTECT,
                                 related_name='prescription_items')
    strength = models.CharField(max_length=60, blank=True)
    dosage_form = models.CharField(max_length=20, blank=True)
    qty_per_dose = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    morning = models.PositiveSmallIntegerField(default=0)
    afternoon = models.PositiveSmallIntegerField(default=0)
    night = models.PositiveSmallIntegerField(default=0)
    meal_timing = models.CharField(max_length=20, choices=MealTiming.choices,
                                   default=MealTiming.AFTER)
    duration_days = models.PositiveIntegerField(default=1)
    total_qty = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    instructions = models.CharField(max_length=300, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    @property
    def doses_per_day(self):
        return self.morning + self.afternoon + self.night

    @property
    def calculated_qty(self):
        """(M+A+N) × qty_per_dose × days — doctor must confirm before signing."""
        return self.doses_per_day * self.qty_per_dose * self.duration_days


class ShareStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    REVOKED = 'revoked', 'Revoked'
    EXPIRED = 'expired', 'Expired'


class PrescriptionShare(StateMachineMixin, models.Model):
    """Token = consent record. Pharmacy sees rx items only, never patient history."""

    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE,
                                     related_name='shares')
    # null pharmacy = open link any verified pharmacy can open; set = targeted
    pharmacy = models.ForeignKey('accounts.PharmacyProfile', null=True, blank=True,
                                 on_delete=models.CASCADE, related_name='prescription_shares')
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=ShareStatus.choices,
                              default=ShareStatus.ACTIVE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name='+')
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    TRANSITIONS = {
        ShareStatus.ACTIVE: [ShareStatus.REVOKED, ShareStatus.EXPIRED],
        ShareStatus.REVOKED: [],
        ShareStatus.EXPIRED: [],
    }

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'expires_at'], name='idx_rxshare_stat_exp'),
        ]

    @property
    def is_active(self):
        from django.utils import timezone
        if self.status != ShareStatus.ACTIVE:
            return False
        if self.revoked_at is not None:
            return False
        if self.expires_at <= timezone.now():
            return False
        return True

    def revoke(self, actor=None, reason: str = None, request=None):
        from django.utils import timezone
        self.revoked_at = timezone.now()
        return self.transition_to(
            ShareStatus.REVOKED,
            actor=actor,
            reason=reason or 'Share link revoked',
            request=request,
            update_fields=['revoked_at']
        )

    def expire(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            ShareStatus.EXPIRED,
            actor=actor,
            reason=reason or 'Share link validity expired',
            request=request
        )
