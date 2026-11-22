import threading
import pytest
from django.utils import timezone
from config.state_machine import InvalidStateTransitionError
from prescriptions.models import Prescription, PrescriptionStatus, PrescriptionItem
from quotations.models import Quotation, QuotationStatus, QuotationItem
from orders.models import (
    Order, OrderStatus, OrderFulfillment, FulfillmentStatus,
    Invoice, PaymentStatus, OrderItem
)
from accounts.models import User, DoctorProfile, PharmacyProfile, VerificationStatus
from catalog.models import Medicine
from inventory.models import InventoryItem, MedicineBatch
from audit.models import AuditLog


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
    rx.transition_to(PrescriptionStatus.FINALIZED, actor=doctor, reason="Finalizing consultation")
    assert rx.status == PrescriptionStatus.FINALIZED

    # Valid transition: Finalized -> Cancelled
    rx.transition_to(PrescriptionStatus.CANCELLED, actor=doctor, reason="Patient cancelled")
    assert rx.status == PrescriptionStatus.CANCELLED

    # Illegal transition: Cancelled -> Draft (Terminal)
    with pytest.raises(InvalidStateTransitionError):
        rx.transition_to(PrescriptionStatus.DRAFT)


@pytest.mark.django_db(transaction=True)
def test_concurrent_transition_conditional_update(doctor, patient):
    """Conditional UPDATE ensures two concurrent transitions cannot both succeed."""
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22"
    )

    # Load two separate in-memory references to the same database row
    ref1 = Prescription.objects.get(pk=rx.pk)
    ref2 = Prescription.objects.get(pk=rx.pk)

    # Transaction 1 succeeds: DRAFT -> FINALIZED
    ref1.transition_to(PrescriptionStatus.FINALIZED)
    assert ref1.status == PrescriptionStatus.FINALIZED

    # Transaction 2 attempts DRAFT -> CANCELLED with stale in-memory state:
    # Must fail because row in DB is no longer DRAFT (0 rows updated)
    with pytest.raises(InvalidStateTransitionError) as exc_info:
        ref2.transition_to(PrescriptionStatus.CANCELLED)

    assert "Cannot transition Prescription" in str(exc_info.value)


@pytest.mark.django_db(transaction=True)
def test_threaded_concurrent_transitions(doctor, patient):
    """Real multi-threaded test verifying concurrency control stops simultaneous transitions."""
    from django.db import connection

    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22"
    )
    results = []

    def attempt_transition(target_state):
        connection.close()  # ensure thread has a fresh connection
        try:
            instance = Prescription.objects.get(pk=rx.pk)
            instance.transition_to(target_state)
            results.append(("success", target_state))
        except Exception:
            # Caught either InvalidStateTransitionError or db lock concurrency refusal
            results.append(("failed", target_state))
        finally:
            connection.close()

    t1 = threading.Thread(target=attempt_transition, args=(PrescriptionStatus.FINALIZED,))
    t2 = threading.Thread(target=attempt_transition, args=(PrescriptionStatus.FINALIZED,))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Exactly one thread succeeded, the other failed / was rejected
    statuses = [r[0] for r in results]
    assert statuses.count("success") == 1
    assert statuses.count("failed") == 1


@pytest.mark.django_db
def test_audit_log_created_inside_transition(doctor, patient):
    """Every transition writes an audit log row inside the same transaction."""
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22"
    )
    rx.transition_to(PrescriptionStatus.FINALIZED, actor=doctor, reason="Clinical review complete")

    log = AuditLog.objects.filter(
        object_type="prescription",
        object_id=str(rx.pk),
        action="prescription.transition"
    ).first()

    assert log is not None
    assert log.user == doctor
    assert log.metadata['from'] == PrescriptionStatus.DRAFT
    assert log.metadata['to'] == PrescriptionStatus.FINALIZED
    assert log.metadata['reason'] == "Clinical review complete"
    assert 'when' in log.metadata


@pytest.mark.django_db
def test_invoice_state_machine(patient, pharmacy, doctor):
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22",
        status=PrescriptionStatus.FINALIZED
    )
    order = Order.objects.create(patient=patient.patient_profile, prescription=rx)
    ful = OrderFulfillment.objects.create(order=order, pharmacy=pharmacy.pharmacy_profile)
    inv = Invoice.objects.create(fulfillment=ful, invoice_number="INV-TEST-001")
    assert inv.payment_status == PaymentStatus.PENDING

    # Valid: PENDING -> PAID
    inv.transition_to(PaymentStatus.PAID)
    assert inv.payment_status == PaymentStatus.PAID

    # Valid: PAID -> REFUNDED
    inv.transition_to(PaymentStatus.REFUNDED)
    assert inv.payment_status == PaymentStatus.REFUNDED

    # Illegal: REFUNDED -> PAID
    with pytest.raises(InvalidStateTransitionError):
        inv.transition_to(PaymentStatus.PAID)

    # Test FAILED path on a fresh invoice and order
    order2 = Order.objects.create(patient=patient.patient_profile, prescription=rx)
    ful2 = OrderFulfillment.objects.create(order=order2, pharmacy=pharmacy.pharmacy_profile)
    inv2 = Invoice.objects.create(fulfillment=ful2, invoice_number="INV-TEST-002")
    inv2.transition_to(PaymentStatus.FAILED)
    assert inv2.payment_status == PaymentStatus.FAILED

    # Valid: FAILED -> PENDING
    inv2.transition_to(PaymentStatus.PENDING)
    assert inv2.payment_status == PaymentStatus.PENDING


@pytest.mark.django_db
def test_order_and_fulfillment_state_machines(patient, pharmacy, doctor):
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22",
        status=PrescriptionStatus.FINALIZED
    )
    order = Order.objects.create(patient=patient.patient_profile, prescription=rx)
    ful = OrderFulfillment.objects.create(order=order, pharmacy=pharmacy.pharmacy_profile)

    # Order valid: PLACED -> COMPLETED
    order.transition_to(OrderStatus.COMPLETED)
    assert order.status == OrderStatus.COMPLETED

    # Order invalid: COMPLETED -> CANCELLED
    with pytest.raises(InvalidStateTransitionError):
        order.transition_to(OrderStatus.CANCELLED)

    # Fulfillment valid: PENDING -> FULFILLED
    ful.transition_to(FulfillmentStatus.FULFILLED)
    assert ful.status == FulfillmentStatus.FULFILLED

    # Fulfillment invalid: FULFILLED -> CANCELLED
    with pytest.raises(InvalidStateTransitionError):
        ful.transition_to(FulfillmentStatus.CANCELLED)


@pytest.mark.django_db
def test_verification_state_machine_mixin():
    user = User.objects.create_user(email="newdoc@example.com", password="password")
    doc_prof = DoctorProfile.objects.create(user=user, verification_status=VerificationStatus.PENDING)
    assert doc_prof.verification_status == VerificationStatus.PENDING

    # Valid: PENDING -> UNDER_REVIEW
    doc_prof.transition_to(VerificationStatus.UNDER_REVIEW)
    assert doc_prof.verification_status == VerificationStatus.UNDER_REVIEW

    # Valid: UNDER_REVIEW -> VERIFIED
    doc_prof.transition_to(VerificationStatus.VERIFIED)
    assert doc_prof.verification_status == VerificationStatus.VERIFIED

    # Valid: VERIFIED -> SUSPENDED
    doc_prof.transition_to(VerificationStatus.SUSPENDED)
    assert doc_prof.verification_status == VerificationStatus.SUSPENDED

    # Invalid: SUSPENDED -> PENDING
    with pytest.raises(InvalidStateTransitionError):
        doc_prof.transition_to(VerificationStatus.PENDING)


@pytest.mark.django_db
def test_invalid_state_transition_returns_http_409(client, pharmacy, patient, doctor):
    """Test that InvalidStateTransitionError is mapped to HTTP 409 Conflict with detail & code."""
    pharmacy.pharmacy_profile.verification_status = VerificationStatus.VERIFIED
    pharmacy.pharmacy_profile.save()

    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22",
        status=PrescriptionStatus.FINALIZED
    )
    order = Order.objects.create(patient=patient.patient_profile, prescription=rx)
    ful = OrderFulfillment.objects.create(order=order, pharmacy=pharmacy.pharmacy_profile)
    inv = Invoice.objects.create(fulfillment=ful, invoice_number="INV-409-TEST", payment_status=PaymentStatus.PAID)

    # Authenticate as pharmacy and attempt illegal transition from PAID directly to FAILED
    client.force_login(pharmacy)
    session = client.session
    session['active_role'] = 'pharmacy'
    session.save()

    resp = client.post(f'/api/v1/invoices/{inv.id}/payment', {'payment_status': 'failed'})
    assert resp.status_code == 409
    assert resp.json()['code'] == 'invalid_state_transition'
    assert "Cannot transition Invoice" in resp.json()['detail']


@pytest.mark.django_db
def test_quotation_get_view_does_not_mutate_status(client, patient, pharmacy, doctor):
    """GET /prescriptions/{id}/quotations is a pure read and does NOT write status."""
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22",
        status=PrescriptionStatus.FINALIZED
    )
    quote = Quotation.objects.create(
        prescription=rx,
        pharmacy=pharmacy.pharmacy_profile,
        valid_until=timezone.now() + timezone.timedelta(days=2),
        status=QuotationStatus.SUBMITTED
    )

    client.force_login(patient)
    session = client.session
    session['active_role'] = 'patient'
    session.save()

    resp = client.get(f'/api/v1/prescriptions/{rx.id}/quotations')
    assert resp.status_code == 200

    # Ensure status remained SUBMITTED (not mutated to VIEWED on GET)
    quote.refresh_from_db()
    assert quote.status == QuotationStatus.SUBMITTED

    # Explicit POST marks it viewed
    post_resp = client.post(f'/api/v1/quotations/{quote.id}/mark-viewed')
    assert post_resp.status_code == 200
    quote.refresh_from_db()
    assert quote.status == QuotationStatus.VIEWED


@pytest.mark.django_db
def test_quotation_selected_reorder_after_order_cancelled(client, patient, pharmacy, doctor):
    """After order cancellation, quotation returns to SUBMITTED and patient can order again."""
    pharmacy.pharmacy_profile.verification_status = VerificationStatus.VERIFIED
    pharmacy.pharmacy_profile.save()

    med = Medicine.objects.create(generic_name="Paracetamol", brand_name="Crocin 500", pack_size=10)
    inv = InventoryItem.objects.create(pharmacy=pharmacy.pharmacy_profile, medicine=med, selling_price=50)
    MedicineBatch.objects.create(
        inventory_item=inv, batch_number="B1",
        expiry_date=timezone.now().date() + timezone.timedelta(days=100),
        qty=50, mrp=50, purchase_price=30
    )

    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22",
        status=PrescriptionStatus.FINALIZED
    )
    pi = PrescriptionItem.objects.create(
        prescription=rx, medicine=med, morning=1, duration_days=5, total_qty=5
    )

    quote = Quotation.objects.create(
        prescription=rx,
        pharmacy=pharmacy.pharmacy_profile,
        valid_until=timezone.now() + timezone.timedelta(days=2),
        status=QuotationStatus.SUBMITTED,
        pickup_fee=0
    )
    QuotationItem.objects.create(
        quotation=quote, prescription_item=pi, available=True, qty_offered=10, unit_price=5
    )

    client.force_login(patient)
    session = client.session
    session['active_role'] = 'patient'
    session.save()

    # Place order
    order_resp = client.post('/api/v1/orders', {
        'prescription_id': rx.id,
        'selection': [{'prescription_item': pi.id, 'pharmacy': pharmacy.pharmacy_profile.id}]
    }, content_type='application/json')
    assert order_resp.status_code == 201
    quote.refresh_from_db()
    assert quote.status == QuotationStatus.SELECTED

    # Cancel fulfillment
    order_id = order_resp.json()['id']
    ful_id = order_resp.json()['fulfillments'][0]['id']
    cancel_resp = client.post(f'/api/v1/orders/{order_id}/fulfillments/{ful_id}/cancel')
    assert cancel_resp.status_code == 200

    # Verify quotation returned to SUBMITTED
    quote.refresh_from_db()
    assert quote.status == QuotationStatus.SUBMITTED

    # Patient can order again!
    reorder_resp = client.post('/api/v1/orders', {
        'prescription_id': rx.id,
        'selection': [{'prescription_item': pi.id, 'pharmacy': pharmacy.pharmacy_profile.id}]
    }, content_type='application/json')
    assert reorder_resp.status_code == 201


@pytest.mark.django_db
def test_quotation_revision_after_selection(client, patient, pharmacy, doctor):
    """Pharmacy can revise quotation (new revision) and return to SUBMITTED for re-approval."""
    pharmacy.pharmacy_profile.verification_status = VerificationStatus.VERIFIED
    pharmacy.pharmacy_profile.save()

    med = Medicine.objects.create(generic_name="Amoxicillin", brand_name="Mox 500", pack_size=10)
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date="2026-11-22",
        status=PrescriptionStatus.FINALIZED
    )
    pi = PrescriptionItem.objects.create(
        prescription=rx, medicine=med, morning=1, duration_days=5, total_qty=5
    )

    quote = Quotation.objects.create(
        prescription=rx,
        pharmacy=pharmacy.pharmacy_profile,
        valid_until=timezone.now() + timezone.timedelta(days=2),
        status=QuotationStatus.SELECTED,
        pickup_fee=10,
        revision=1
    )
    QuotationItem.objects.create(
        quotation=quote, prescription_item=pi, available=True, qty_offered=10, unit_price=10
    )

    client.force_login(pharmacy)
    session = client.session
    session['active_role'] = 'pharmacy'
    session.save()

    revise_resp = client.post(f'/api/v1/quotations/{quote.id}/revise', {
        'pickup_fee': 15,
        'valid_days': 3,
        'items': [{'prescription_item': pi.id, 'available': True, 'qty_offered': 10, 'unit_price': 12}]
    }, content_type='application/json')

    assert revise_resp.status_code == 200
    quote.refresh_from_db()
    assert quote.revision == 2
    assert quote.status == QuotationStatus.SUBMITTED
    assert quote.pickup_fee == 15


@pytest.mark.django_db
def test_expired_quotations_and_prescriptions_rejected(client, patient, pharmacy, doctor):
    """Expired quotes or prescriptions are rejected with 409 at order time."""
    pharmacy.pharmacy_profile.verification_status = VerificationStatus.VERIFIED
    pharmacy.pharmacy_profile.save()

    med = Medicine.objects.create(generic_name="Cetirizine", brand_name="Cetzine", pack_size=10)
    rx = Prescription.objects.create(
        doctor=doctor.doctor_profile,
        patient=patient.patient_profile,
        consultation_date=timezone.now().date() - timezone.timedelta(days=35),  # >30 days old = expired
        status=PrescriptionStatus.FINALIZED
    )
    pi = PrescriptionItem.objects.create(
        prescription=rx, medicine=med, morning=1, duration_days=5, total_qty=5
    )

    quote = Quotation.objects.create(
        prescription=rx,
        pharmacy=pharmacy.pharmacy_profile,
        valid_until=timezone.now() - timezone.timedelta(hours=1),  # Expired quote
        status=QuotationStatus.SUBMITTED
    )
    QuotationItem.objects.create(
        quotation=quote, prescription_item=pi, available=True, qty_offered=10, unit_price=5
    )

    client.force_login(patient)
    session = client.session
    session['active_role'] = 'patient'
    session.save()

    # Attempt to order with expired prescription
    order_resp = client.post('/api/v1/orders', {
        'prescription_id': rx.id,
        'selection': [{'prescription_item': pi.id, 'pharmacy': pharmacy.pharmacy_profile.id}]
    }, content_type='application/json')

    assert order_resp.status_code == 409
    assert order_resp.json()['code'] == 'prescription_expired'
