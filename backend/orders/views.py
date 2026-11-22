import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from accounts.permissions import IsPatient, IsVerifiedPharmacy
from audit.services import record
from inventory.models import InventoryItem
from inventory.services import InsufficientStock, deduct_fefo, restock
from notifications.services import notify
from prescriptions.models import Prescription, PrescriptionStatus
from quotations.models import QuotationItem, QuotationStatus

from .models import (FulfillmentStatus, Invoice, Order, OrderFulfillment,
                     OrderItem, OrderStatus)
from .serializers import OrderSerializer


class OrderCreateView(APIView):
    """Patient selects a comparison option. Server re-validates everything —
    the client's chosen option is a wish, not a fact."""

    permission_classes = [IsPatient]

    def post(self, request):
        rx_id = request.data.get('prescription_id')
        selection = request.data.get('selection')  # [{prescription_item, pharmacy}]
        if not isinstance(selection, list) or not selection:
            return Response({'detail': 'selection list required.',
                             'code': 'validation_error'}, status=400)

        try:
            rx = Prescription.objects.get(pk=rx_id, patient=request.user.patient_profile)
        except Prescription.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if rx.is_expired or rx.status == PrescriptionStatus.EXPIRED:
            if rx.status == PrescriptionStatus.FINALIZED:
                rx.transition_to(PrescriptionStatus.EXPIRED, actor=request.user, reason='Expired prescription', save=True)
            return Response(
                {'detail': 'This prescription has expired and cannot be ordered.',
                 'code': 'prescription_expired'}, status=409)
        if rx.status != PrescriptionStatus.FINALIZED:
            return Response({'detail': 'Only finalized prescriptions can be ordered.',
                             'code': 'not_finalized'}, status=409)

        rx_items = {i.id: i for i in rx.items.all()}
        chosen = {}
        for row in selection:
            pi, pid = row.get('prescription_item'), row.get('pharmacy')
            if pi not in rx_items:
                return Response({'detail': f'Unknown prescription_item {pi}.',
                                 'code': 'validation_error'}, status=400)
            if pi in chosen:
                return Response({'detail': 'Each prescription item can be ordered once.',
                                 'code': 'duplicate_item'}, status=400)
            chosen[pi] = pid

        missing = set(rx_items) - set(chosen)
        if missing:
            return Response(
                {'detail': f'Order must cover every item; missing {sorted(missing)}.',
                 'code': 'incomplete_selection'}, status=400)

        # validate every line against live quotations (submitted, unexpired)
        now = timezone.now()
        lines_by_pharmacy: dict = {}
        for pi_id, pid in chosen.items():
            qi = (QuotationItem.objects
                  .select_related('quotation', 'prescription_item__medicine')
                  .filter(prescription_item_id=pi_id,
                          quotation__pharmacy_id=pid,
                          quotation__status__in=(QuotationStatus.SUBMITTED,
                                                 QuotationStatus.VIEWED),
                          quotation__valid_until__gte=now,
                          available=True)
                  .first())
            if qi is None:
                expired_qi = (QuotationItem.objects
                              .select_related('quotation')
                              .filter(prescription_item_id=pi_id,
                                      quotation__pharmacy_id=pid,
                                      quotation__valid_until__lt=now)
                              .first())
                if expired_qi:
                    return Response(
                        {'detail': f'Quotation for item {pi_id} at pharmacy {pid} has expired.',
                         'code': 'quotation_expired'}, status=409)
                return Response(
                    {'detail': f'No valid quotation for item {pi_id} at pharmacy {pid}.',
                     'code': 'invalid_quotation'}, status=400)
            if qi.offered_medicine_id and qi.offered_medicine_id != \
                    qi.prescription_item.medicine_id:
                return Response(
                    {'detail': 'Substituted medicines need explicit approval; '
                               'order the prescribed medicine.',
                     'code': 'substitution_not_approved'}, status=400)
            from math import ceil
            required = int(qi.prescription_item.total_qty)
            pack = qi.prescription_item.medicine.pack_size or 1
            charged = max(1, ceil(required / pack)) * pack
            if qi.qty_offered < charged:
                return Response(
                    {'detail': f'Pharmacy no longer has enough stock for item {pi_id}.',
                     'code': 'insufficient_quote_qty'}, status=400)
            lines_by_pharmacy.setdefault(pid, []).append(
                (qi, charged, qi.quotation))

        # create order + deduct stock (FEFO) in one transaction
        try:
            with transaction.atomic():
                order = Order.objects.create(
                    patient=request.user.patient_profile, prescription=rx)
                order_total = Decimal('0')
                for pid, lines in lines_by_pharmacy.items():
                    from accounts.models import PharmacyProfile
                    pharmacy = PharmacyProfile.objects.get(pk=pid)
                    quote = lines[0][2]
                    fulfillment = OrderFulfillment.objects.create(
                        order=order, pharmacy=pharmacy,
                        pickup_fee=quote.pickup_fee)
                    subtotal = Decimal('0')
                    for qi, charged, _q in lines:
                        inv_item = InventoryItem.objects.filter(
                            pharmacy=pharmacy, medicine=qi.prescription_item.medicine
                        ).first()
                        if inv_item is None:
                            raise InsufficientStock(
                                qi.prescription_item.medicine.display_name,
                                charged, 0)
                        deduct_fefo(inv_item, charged, 'order_fulfillment',
                                    fulfillment.id, request.user)
                        OrderItem.objects.create(
                            fulfillment=fulfillment,
                            prescription_item=qi.prescription_item,
                            medicine=qi.prescription_item.medicine,
                            qty=charged, unit_price=qi.unit_price)
                        subtotal += qi.unit_price * charged
                    fulfillment.subtotal = subtotal
                    fulfillment.save(update_fields=['subtotal'])
                    order_total += subtotal + quote.pickup_fee
                    # quotations used are now locked in
                    quote.transition_to(QuotationStatus.SELECTED, actor=request.user, request=request, reason='Order placed', save=True)

                order.total = order_total
                order.save(update_fields=['total'])
        except InsufficientStock as e:
            return Response(
                {'detail': f'Stock changed while you were deciding: {e}. '
                           f'Refresh quotations.',
                 'code': 'insufficient_stock'}, status=409)

        record(request.user, 'order.create', 'order', order.id,
               {'prescription_id': rx.id, 'total': str(order.total)}, request)
        for f in order.fulfillments.all():
            notify(f.pharmacy.user, 'order_placed', 'New order',
                   f'Order ORD-{order.pk} — {f.items.count()} item(s).')
        return Response(OrderSerializer(order).data, status=201)


class OrderListView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        qs = request.user.patient_profile.orders.all()
        return Response(OrderSerializer(qs[:100], many=True).data)


class OrderDetailView(APIView):
    def get(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        user = request.user
        is_patient = (user.active_role == Role.PATIENT
                      and order.patient_id == getattr(
                          getattr(user, 'patient_profile', None), 'id', None))
        is_pharmacy = (user.active_role == Role.PHARMACY
                       and order.fulfillments.filter(
                           pharmacy=getattr(user, 'pharmacy_profile', None)).exists())
        if not (is_patient or is_pharmacy or user.active_role == Role.ADMIN):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        return Response(OrderSerializer(order).data)


class FulfillView(APIView):
    """Pharmacy confirms handover and generates the invoice. Stock was already
    deducted at order time, so nothing to move here."""

    permission_classes = [IsVerifiedPharmacy]

    def post(self, request, pk, fulfillment_id):
        try:
            fulfillment = OrderFulfillment.objects.select_related(
                'order').get(pk=fulfillment_id, order_id=pk,
                             pharmacy=request.user.pharmacy_profile)
        except OrderFulfillment.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if fulfillment.status != FulfillmentStatus.PENDING:
            return Response({'detail': 'Fulfillment already processed.',
                             'code': 'not_pending'}, status=409)

        with transaction.atomic():
            fulfillment.transition_to(FulfillmentStatus.FULFILLED, actor=request.user, request=request, reason='Order fulfilled', save=True)
            invoice = Invoice.objects.create(
                fulfillment=fulfillment,
                invoice_number=f'INV-{timezone.now():%Y%m%d}-'
                               f'{uuid.uuid4().hex[:6].upper()}')
            order = fulfillment.order
            statuses = set(order.fulfillments.values_list('status', flat=True))
            if statuses == {FulfillmentStatus.FULFILLED}:
                order.transition_to(OrderStatus.COMPLETED, actor=request.user, request=request, reason='All fulfillments fulfilled', save=True)

        record(request.user, 'order.fulfill', 'order', order.id,
               {'fulfillment_id': fulfillment.id, 'invoice': invoice.invoice_number},
               request)
        notify(order.patient.user, 'invoice_ready', 'Invoice available',
               f'{fulfillment.pharmacy.pharmacy_name}: {invoice.invoice_number}')
        return Response({'fulfillment_id': fulfillment.id,
                         'invoice_number': invoice.invoice_number})


class CancelFulfillmentView(APIView):
    """Restock + refund the lines. Pharmacy or patient can trigger before fulfilment."""

    def post(self, request, pk, fulfillment_id):
        try:
            fulfillment = OrderFulfillment.objects.select_related(
                'order').get(pk=fulfillment_id, order_id=pk)
        except OrderFulfillment.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        user = request.user
        is_pharmacy = (user.active_role == Role.PHARMACY
                       and fulfillment.pharmacy_id ==
                       getattr(getattr(user, 'pharmacy_profile', None), 'id', None))
        is_patient = (user.active_role == Role.PATIENT
                      and fulfillment.order.patient_id ==
                      getattr(getattr(user, 'patient_profile', None), 'id', None))
        if not (is_pharmacy or is_patient or user.active_role == Role.ADMIN):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if fulfillment.status != FulfillmentStatus.PENDING:
            return Response({'detail': 'Already fulfilled — contact support for returns.',
                             'code': 'not_pending'}, status=409)

        with transaction.atomic():
            # reverse each order item's FEFO deduction: return qty to the same
            # earliest-expiry non-expired batches it came from
            for oi in fulfillment.items.all():
                inv_item = InventoryItem.objects.filter(
                    pharmacy=fulfillment.pharmacy, medicine=oi.medicine).first()
                if not inv_item:
                    continue
                target = (inv_item.batches
                          .filter(expiry_date__gte=timezone.now().date())
                          .order_by('expiry_date', 'id').first())
                if target is None:
                    # every batch is expired — restore into the newest anyway:
                    # expired stock is unsellable (FEFO filters it), so qty is
                    # preserved for manual write-off rather than silently lost
                    target = inv_item.batches.order_by('-expiry_date').first()
                if target:
                    restock([(target, oi.qty)], 'order_fulfillment',
                            fulfillment.id, user)

            fulfillment.transition_to(FulfillmentStatus.CANCELLED, actor=user, request=request, reason='Fulfillment cancelled', save=True)
            order = fulfillment.order
            statuses = set(order.fulfillments.values_list('status', flat=True))
            if statuses == {FulfillmentStatus.CANCELLED}:
                order.transition_to(OrderStatus.CANCELLED, actor=user, request=request, reason='All fulfillments cancelled', save=True)

            # Re-open quotation so the patient can order again from that quotation
            from quotations.models import Quotation, QuotationStatus
            quote = Quotation.objects.filter(
                prescription=fulfillment.order.prescription,
                pharmacy=fulfillment.pharmacy
            ).first()
            if quote and quote.status == QuotationStatus.SELECTED:
                if quote.valid_until < timezone.now():
                    quote.transition_to(QuotationStatus.EXPIRED, actor=user, request=request, reason='Order cancelled but quotation expired', save=True)
                else:
                    quote.transition_to(QuotationStatus.SUBMITTED, actor=user, request=request, reason='Order cancelled; quotation re-opened', save=True)

        record(user, 'order.fulfillment_cancel', 'order', order.id,
               {'fulfillment_id': fulfillment.id}, request)
        notify(order.patient.user, 'fulfillment_cancelled',
               'Order item cancelled',
               f'{fulfillment.pharmacy.pharmacy_name} could not fulfil your order.')
        return Response({'detail': 'cancelled and stock restored'})


class InvoiceDetailView(APIView):
    def get(self, request, pk):
        try:
            invoice = Invoice.objects.select_related(
                'fulfillment__order').get(pk=pk)
        except Invoice.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        fulfillment = invoice.fulfillment
        user = request.user
        is_patient = (user.active_role == Role.PATIENT
                      and fulfillment.order.patient_id ==
                      getattr(getattr(user, 'patient_profile', None), 'id', None))
        is_pharmacy = (user.active_role == Role.PHARMACY
                       and fulfillment.pharmacy_id ==
                       getattr(getattr(user, 'pharmacy_profile', None), 'id', None))
        if not (is_patient or is_pharmacy or user.active_role == Role.ADMIN):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        from .serializers import FulfillmentSerializer
        return Response({'invoice_id': invoice.id,
                         'invoice_number': invoice.invoice_number,
                         'payment_status': invoice.payment_status,
                         'issued_at': invoice.issued_at.isoformat(),
                         'fulfillment': FulfillmentSerializer(fulfillment).data})


class InvoicePDFView(APIView):
    def get(self, request, pk):
        from prescriptions.pdf import invoice_pdf
        try:
            invoice = Invoice.objects.select_related(
                'fulfillment__order', 'fulfillment__pharmacy').get(pk=pk)
        except Invoice.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        fulfillment = invoice.fulfillment
        user = request.user
        is_patient = (user.active_role == Role.PATIENT
                      and fulfillment.order.patient_id ==
                      getattr(getattr(user, 'patient_profile', None), 'id', None))
        is_pharmacy = (user.active_role == Role.PHARMACY
                       and fulfillment.pharmacy_id ==
                       getattr(getattr(user, 'pharmacy_profile', None), 'id', None))
        if not (is_patient or is_pharmacy or user.active_role == Role.ADMIN):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        return invoice_pdf(invoice)


class PaymentStatusView(APIView):
    permission_classes = [IsVerifiedPharmacy]

    def post(self, request, pk):
        status_val = request.data.get('payment_status')
        if status_val not in ('pending', 'paid', 'failed', 'refunded'):
            return Response({'detail': 'payment_status must be pending|paid|failed|refunded.',
                             'code': 'invalid_status'}, status=400)
        try:
            invoice = Invoice.objects.get(pk=pk,
                                          fulfillment__pharmacy=request.user.pharmacy_profile)
        except Invoice.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        invoice.transition_to(status_val, actor=request.user, request=request, reason=f'Manual update to {status_val}', save=True)
        record(request.user, 'invoice.payment_status', 'invoice', invoice.id,
               {'status': status_val}, request)
        return Response({'id': invoice.id, 'payment_status': invoice.payment_status})
