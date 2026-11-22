import pytest
from config.state_machine import InvalidStateTransitionError
from prescriptions.models import Prescription, PrescriptionStatus
from quotations.models import Quotation, QuotationStatus
from orders.models import Order, OrderStatus, OrderFulfillment, FulfillmentStatus, Invoice, PaymentStatus


@pytest.mark.django_db
def test_prescription_state_machine(doctor, patient):
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22"
    )
    assert rx.status == PrescriptionStatus.DRAFT

    # Illegal transition: Draft directly to Revised
    with pytest.raises(InvalidStateTransitionError):
        rx.transition_to(PrescriptionStatus.REVISED)

    # Valid transition: Draft -> Finalized
    rx.transition_to(PrescriptionStatus.FINALIZED)
    assert rx.status == PrescriptionStatus.FINALIZED

    # Valid transition: Finalized -> Cancelled
    rx.transition_to(PrescriptionStatus.CANCELLED)
    assert rx.status == PrescriptionStatus.CANCELLED

    # Illegal transition: Cancelled -> Draft (Terminal)
    with pytest.raises(InvalidStateTransitionError):
        rx.transition_to(PrescriptionStatus.DRAFT)


@pytest.mark.django_db
def test_quotation_state_machine(doctor, patient, pharmacy):
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22",
        status=PrescriptionStatus.FINALIZED
    )
    quote = Quotation.objects.create(
        prescription=rx,
        pharmacy=pharmacy.pharmacy_profile,
        valid_until="2026-11-30T00:00:00Z"
    )
    assert quote.status == QuotationStatus.DRAFT

    # Valid: Draft -> Submitted
    quote.transition_to(QuotationStatus.SUBMITTED)
    assert quote.status == QuotationStatus.SUBMITTED

    # Valid: Submitted -> Viewed
    quote.transition_to(QuotationStatus.VIEWED)
    assert quote.status == QuotationStatus.VIEWED

    # Valid: Viewed -> Selected
    quote.transition_to(QuotationStatus.SELECTED)
    assert quote.status == QuotationStatus.SELECTED

    # Illegal: Selected -> Draft (terminal)
    with pytest.raises(InvalidStateTransitionError):
        quote.transition_to(QuotationStatus.DRAFT)


@pytest.mark.django_db
def test_order_fulfillment_state_machine(patient, pharmacy, doctor):
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22",
        status=PrescriptionStatus.FINALIZED
    )
    order = Order.objects.create(patient=patient.patient_profile, prescription=rx)
    ful = OrderFulfillment.objects.create(order=order, pharmacy=pharmacy.pharmacy_profile)
    assert ful.status == FulfillmentStatus.PENDING

    # Valid: Pending -> Fulfilled
    ful.transition_to(FulfillmentStatus.FULFILLED)
    assert ful.status == FulfillmentStatus.FULFILLED

    # Illegal: Fulfilled -> Cancelled
    with pytest.raises(InvalidStateTransitionError):
        ful.transition_to(FulfillmentStatus.CANCELLED)
