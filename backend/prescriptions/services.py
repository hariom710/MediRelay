"""Quantity calculation lives here so view, PDF and tests share one rule."""

from decimal import Decimal, ROUND_HALF_UP

from .models import PrescriptionItem

LIQUID_FORMS = {'syrup', 'drops'}


def computed_total(item: PrescriptionItem) -> Decimal:
    qty = Decimal(item.doses_per_day) * Decimal(str(item.qty_per_dose)) \
        * Decimal(item.duration_days)
    # liquids can land on .5 ml; tablets must be whole units
    if item.dosage_form in LIQUID_FORMS:
        return qty.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return qty.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
