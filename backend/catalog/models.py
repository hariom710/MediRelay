from django.db import models


class DosageForm(models.TextChoices):
    TABLET = 'tablet', 'Tablet'
    CAPSULE = 'capsule', 'Capsule'
    SYRUP = 'syrup', 'Syrup'
    INJECTION = 'injection', 'Injection'
    CREAM = 'cream', 'Cream'
    OINTMENT = 'ointment', 'Ointment'
    DROPS = 'drops', 'Drops (eye/ear)'
    INHALER = 'inhaler', 'Inhaler'
    OTHER = 'other', 'Other'


class PackUnit(models.TextChoices):
    TABLET = 'tablet', 'Tablet'
    CAPSULE = 'capsule', 'Capsule'
    ML = 'ml', 'ml'
    UNIT = 'unit', 'Unit'


class Medicine(models.Model):
    """Admin-maintained master catalogue. Quotations reference this id, so
    comparisons are always apples-to-apples. Substitution = separate offered id."""

    generic_name = models.CharField(max_length=200, db_index=True)
    brand_name = models.CharField(max_length=200, blank=True, db_index=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    strength = models.CharField(max_length=60, blank=True)  # "500 mg"
    dosage_form = models.CharField(max_length=20, choices=DosageForm.choices)
    pack_size = models.PositiveIntegerField(default=1)
    pack_unit = models.CharField(max_length=20, choices=PackUnit.choices, default=PackUnit.TABLET)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['generic_name', 'brand_name']

    @property
    def display_name(self):
        parts = [self.generic_name]
        if self.brand_name:
            parts.append(f'({self.brand_name})')
        if self.strength:
            parts.append(self.strength)
        return ' '.join(parts)

    def __str__(self):
        return self.display_name
