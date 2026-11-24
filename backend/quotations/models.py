from django.db import models
from config.state_machine import StateMachineMixin


class QuotationStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    SUBMITTED = 'submitted', 'Submitted'
    VIEWED = 'viewed', 'Viewed'
    SELECTED = 'selected', 'Selected'
    REJECTED = 'rejected', 'Rejected'
    EXPIRED = 'expired', 'Expired'


class Quotation(StateMachineMixin, models.Model):
    """One per (prescription, pharmacy). Revision bumps when patient re-approves."""

    prescription = models.ForeignKey('prescriptions.Prescription',
                                     on_delete=models.CASCADE, related_name='quotations')
    pharmacy = models.ForeignKey('accounts.PharmacyProfile', on_delete=models.CASCADE,
                                 related_name='quotations')
    share = models.ForeignKey('prescriptions.PrescriptionShare', on_delete=models.PROTECT,
                              related_name='quotations', null=True, blank=True)
    status = models.CharField(max_length=20, choices=QuotationStatus.choices,
                              default=QuotationStatus.DRAFT)

    TRANSITIONS = {
        QuotationStatus.DRAFT: [QuotationStatus.SUBMITTED],
        QuotationStatus.SUBMITTED: [QuotationStatus.VIEWED, QuotationStatus.SELECTED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED, QuotationStatus.DRAFT],
        QuotationStatus.VIEWED: [QuotationStatus.SELECTED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED, QuotationStatus.DRAFT],
        QuotationStatus.SELECTED: [QuotationStatus.SUBMITTED, QuotationStatus.EXPIRED, QuotationStatus.DRAFT],
        QuotationStatus.REJECTED: [QuotationStatus.DRAFT],
        QuotationStatus.EXPIRED: [QuotationStatus.DRAFT],
    }
    revision = models.PositiveIntegerField(default=1)
    pickup_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    valid_until = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('prescription', 'pharmacy')]
        ordering = ['-updated_at']

    @property
    def is_expired(self):
        from django.utils import timezone
        return self.valid_until < timezone.now()

    def submit(self, actor=None, reason: str = None, request=None):
        from django.utils import timezone
        self.submitted_at = timezone.now()
        return self.transition_to(
            QuotationStatus.SUBMITTED,
            actor=actor,
            reason=reason or 'Quotation submitted by pharmacy',
            request=request,
            update_fields=['submitted_at']
        )

    def mark_viewed(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            QuotationStatus.VIEWED,
            actor=actor,
            reason=reason or 'Quotation viewed by patient',
            request=request
        )

    def select(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            QuotationStatus.SELECTED,
            actor=actor,
            reason=reason or 'Quotation selected by patient for order',
            request=request
        )

    def reject(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            QuotationStatus.REJECTED,
            actor=actor,
            reason=reason or 'Quotation rejected',
            request=request
        )

    def expire(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            QuotationStatus.EXPIRED,
            actor=actor,
            reason=reason or 'Quotation validity expired',
            request=request
        )

    def revert_to_draft(self, actor=None, reason: str = None, request=None):
        return self.transition_to(
            QuotationStatus.DRAFT,
            actor=actor,
            reason=reason or 'Quotation reverted to draft for revision',
            request=request
        )


class QuotationItem(models.Model):
    """Availability + price per prescription line. Partial quotes are allowed."""

    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE,
                                  related_name='items')
    prescription_item = models.ForeignKey('prescriptions.PrescriptionItem',
                                          on_delete=models.CASCADE,
                                          related_name='quotation_items')
    # null = offering exactly the prescribed medicine; set = equivalent offered
    # for professional review (NEVER auto-substituted by the engine)
    offered_medicine = models.ForeignKey('catalog.Medicine', null=True, blank=True,
                                         on_delete=models.PROTECT,
                                         related_name='+')
    available = models.BooleanField(default=True)
    qty_offered = models.IntegerField(default=0)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    batch_number = models.CharField(max_length=60, blank=True)
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        unique_together = [('quotation', 'prescription_item')]
