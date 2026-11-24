from decimal import Decimal, InvalidOperation

from django.db import models, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsPatient, IsVerifiedPharmacy
from audit.services import record
from notifications.services import notify
from prescriptions.models import Prescription, PrescriptionStatus, PrescriptionShare

from .engine import compare
from .models import Quotation, QuotationItem, QuotationStatus
from .serializers import QuotationSerializer

MAX_PICKUP_FEE = Decimal('500.00')


def _parse_pickup_fee(raw_fee) -> Decimal:
    if raw_fee is None or raw_fee == '':
        return Decimal('0.00')
    try:
        fee = Decimal(str(raw_fee))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError('pickup_fee must be a valid number.')
    if fee < 0 or fee > MAX_PICKUP_FEE:
        raise ValueError(f'pickup_fee must be between 0 and {MAX_PICKUP_FEE}.')
    return fee


class PharmacyRequestsView(APIView):
    """Dashboard: finalized prescriptions shared with this pharmacy (targeted or open)."""

    permission_classes = [IsVerifiedPharmacy]

    def get(self, request):
        profile = request.user.pharmacy_profile
        now = timezone.now()
        shares = (PrescriptionShare.objects
                  .filter(revoked_at__isnull=True, expires_at__gt=now)
                  .filter(pharmacy=profile) | PrescriptionShare.objects
                  .filter(revoked_at__isnull=True, expires_at__gt=now,
                          pharmacy__isnull=True))
        shares = shares.distinct().select_related('prescription', 'prescription__patient__user')
        rows = []
        for share in shares:
            rx = share.prescription
            if rx.is_expired or rx.status != PrescriptionStatus.FINALIZED:
                continue
            existing = Quotation.objects.filter(prescription=rx, pharmacy=profile).first()
            rows.append({
                'share_id': share.id,
                'prescription_id': rx.id,
                'consultation_date': rx.consultation_date.isoformat(),
                'patient': rx.patient.user.get_full_name() or 'Patient',
                'item_count': rx.items.count(),
                'expires_at': share.expires_at.isoformat(),
                'my_quotation_id': existing.id if existing else None,
                'my_quotation_status': existing.status if existing else None,
            })
        return Response(rows)


class QuotationListCreateView(APIView):
    permission_classes = [IsVerifiedPharmacy]

    def get(self, request):
        """My quotations (pharmacy portal)."""
        qs = request.user.pharmacy_profile.quotations.select_related('prescription')
        st = request.query_params.get('status')
        if st:
            qs = qs.filter(status=st)
        return Response(QuotationSerializer(qs[:100], many=True).data)

    def post(self, request):
        share_id = request.data.get('share_id')
        prescription_id = request.data.get('prescription') or request.data.get('prescription_id')
        share = None
        if share_id:
            try:
                share = PrescriptionShare.objects.select_related('prescription').get(pk=share_id)
            except PrescriptionShare.DoesNotExist:
                return Response({'detail': 'Share not found.', 'code': 'not_found'}, status=404)
        elif prescription_id:
            profile = request.user.pharmacy_profile
            # Look for active share targeted to this pharmacy or open
            share = PrescriptionShare.objects.select_related('prescription').filter(
                prescription_id=prescription_id
            ).filter(models.Q(pharmacy=profile) | models.Q(pharmacy__isnull=True)).first()
            if not share:
                # Check if prescription itself exists
                rx_exists = Prescription.objects.filter(pk=prescription_id).first()
                if rx_exists and (rx_exists.is_expired or rx_exists.status != PrescriptionStatus.FINALIZED):
                    return Response({'detail': 'This prescription has expired.', 'code': 'prescription_expired'}, status=410)
                return Response({'detail': 'Share not found.', 'code': 'not_found'}, status=404)
        else:
            return Response({'detail': 'share_id or prescription is required.', 'code': 'validation_error'}, status=400)

        if not share.is_active:
            return Response({'detail': 'This share link is no longer active.',
                             'code': 'share_inactive'}, status=410)
        profile = request.user.pharmacy_profile
        if share.pharmacy_id and share.pharmacy_id != profile.id:
            return Response({'detail': 'This share was not sent to you.',
                             'code': 'not_your_share'}, status=403)

        rx = share.prescription
        if rx.is_expired or rx.status != PrescriptionStatus.FINALIZED:
            return Response({'detail': 'Prescription is not active.',
                             'code': 'rx_inactive'}, status=409)
        if Quotation.objects.filter(prescription=rx, pharmacy=profile).exists():
            return Response({'detail': 'You already have a quotation for this prescription. '
                                       'Update it instead.',
                             'code': 'duplicate'}, status=409)

        items_data = request.data.get('items')
        if not isinstance(items_data, list) or not items_data:
            return Response({'detail': 'items list is required.', 'code': 'validation_error'},
                            status=400)

        try:
            pickup_fee = _parse_pickup_fee(request.data.get('pickup_fee'))
        except ValueError as e:
            return Response({'detail': str(e), 'code': 'validation_error'}, status=400)

        try:
            valid_days = int(request.data.get('valid_days', 2))
            valid_days = max(1, min(valid_days, 14))
        except (ValueError, TypeError):
            return Response({'detail': 'valid_days must be an integer between 1 and 14.', 'code': 'validation_error'}, status=400)

        with transaction.atomic():
            quote = Quotation.objects.create(
                prescription=rx, pharmacy=profile, share=share,
                pickup_fee=pickup_fee,
                valid_until=timezone.now() + timezone.timedelta(days=valid_days))
            try:
                total = _save_items(quote, items_data, rx)
            except ValueError as e:
                transaction.set_rollback(True)
                return Response({'detail': str(e), 'code': 'validation_error'}, status=400)
            quote.total = total
            quote.save(update_fields=['total'])

        record(request.user, 'quotation.create', 'quotation', quote.id,
               {'prescription_id': rx.id}, request)
        return Response(QuotationSerializer(quote).data, status=201)


def _save_items(quote, items_data, rx):
    from decimal import Decimal
    total = Decimal('0')
    seen = set()
    rx_items = {i.id: i for i in rx.items.all()}
    for row in items_data:
        pid = row.get('prescription_item')
        if pid not in rx_items:
            raise ValueError(f'prescription_item {pid} not in this prescription')
        if pid in seen:
            raise ValueError(f'duplicate prescription_item {pid}')
        seen.add(pid)
        available = bool(row.get('available', True))

        raw_price = row.get('unit_price')
        if raw_price is None or str(raw_price).strip() == '':
            raise ValueError(f'unit_price is required for item {pid}.')
        try:
            unit_price = Decimal(str(raw_price))
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError(f'unit_price for item {pid} must be a valid number.')

        if available and unit_price <= Decimal('0'):
            raise ValueError(f'unit_price for available item {pid} must be greater than zero.')
        if not available:
            unit_price = Decimal('0.00')

        try:
            qty_offered = int(row.get('qty_offered', 0))
        except (ValueError, TypeError):
            raise ValueError(f'qty_offered for item {pid} must be an integer.')

        qi = QuotationItem.objects.create(
            quotation=quote, prescription_item_id=pid,
            offered_medicine_id=row.get('offered_medicine') or None,
            available=available,
            qty_offered=qty_offered,
            unit_price=unit_price,
            batch_number=row.get('batch_number') or '',
            note=row.get('note') or '')
        if available:
            required = int(rx_items[pid].total_qty)
            if qi.qty_offered < required:
                raise ValueError(
                    f'qty_offered ({qi.qty_offered}) < required ({required}) '
                    f'for item {pid} — mark it unavailable instead')
            pack = (qi.offered_medicine.pack_size or 1) if qi.offered_medicine_id \
                else (rx_items[pid].medicine.pack_size or 1)
            from math import ceil
            charged = max(1, ceil(required / pack)) * pack
            total += qi.unit_price * charged
    return total


class QuotationSubmitView(APIView):
    permission_classes = [IsVerifiedPharmacy]

    def post(self, request, pk):
        try:
            quote = Quotation.objects.get(pk=pk,
                                          pharmacy=request.user.pharmacy_profile)
        except Quotation.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if quote.status != QuotationStatus.DRAFT:
            return Response({'detail': 'Only draft quotations can be submitted.',
                             'code': 'not_draft'}, status=409)
        if not quote.items.filter(available=True).exists():
            return Response({'detail': 'Add at least one available medicine.',
                             'code': 'empty_quotation'}, status=400)
        if quote.is_expired:
            quote.valid_until = timezone.now() + timezone.timedelta(days=2)
        quote.submitted_at = timezone.now()
        quote.transition_to(QuotationStatus.SUBMITTED, actor=request.user, request=request, reason='Pharmacy submitted quotation', save=True,
                            update_fields=['status', 'submitted_at', 'valid_until'])
        record(request.user, 'quotation.submit', 'quotation', quote.id, {}, request)
        notify(quote.prescription.patient.user, 'quotation_submitted',
               'New price quotation',
               f'{quote.pharmacy.pharmacy_name} submitted a quotation.')
        return Response(QuotationSerializer(quote).data)


class PrescriptionQuotationsView(APIView):
    """Patient view: all quotations for their prescription (pure read, idempotent)."""

    permission_classes = [IsPatient]

    def get(self, request, pk):
        try:
            rx = Prescription.objects.get(pk=pk, patient=request.user.patient_profile)
        except Prescription.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        quotes = list(rx.quotations.exclude(status=QuotationStatus.DRAFT))
        return Response(QuotationSerializer(quotes, many=True).data)


class QuotationMarkViewedView(APIView):
    """Explicit POST endpoint to mark a quotation as viewed."""

    permission_classes = [IsPatient]

    def post(self, request, pk):
        try:
            quote = Quotation.objects.get(pk=pk, prescription__patient=request.user.patient_profile)
        except Quotation.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        if quote.status == QuotationStatus.SUBMITTED:
            quote.transition_to(QuotationStatus.VIEWED, actor=request.user, request=request, reason='Patient viewed quotation', save=True)
        return Response(QuotationSerializer(quote).data)


class QuotationReviseView(APIView):
    """Allows pharmacy to revise a quotation after submission or selection."""

    permission_classes = [IsVerifiedPharmacy]

    def post(self, request, pk):
        try:
            quote = Quotation.objects.get(pk=pk, pharmacy=request.user.pharmacy_profile)
        except Quotation.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        from orders.models import OrderFulfillment, FulfillmentStatus
        if OrderFulfillment.objects.filter(
            order__prescription=quote.prescription,
            pharmacy=quote.pharmacy,
            status=FulfillmentStatus.PENDING
        ).exists():
            return Response({
                'detail': 'Cannot revise quotation while order fulfillment is actively pending. Cancel the order first.',
                'code': 'active_fulfillment_pending'
            }, status=409)

        items_data = request.data.get('items')
        with transaction.atomic():
            quote.transition_to(QuotationStatus.DRAFT, actor=request.user, request=request, reason='Revision initiated', save=True)
            quote.revision += 1
            if items_data:
                quote.items.all().delete()
                try:
                    total = _save_items(quote, items_data, quote.prescription)
                    quote.total = total
                except ValueError as e:
                    transaction.set_rollback(True)
                    return Response({'detail': str(e), 'code': 'validation_error'}, status=400)
            if 'pickup_fee' in request.data:
                try:
                    quote.pickup_fee = _parse_pickup_fee(request.data['pickup_fee'])
                except ValueError as e:
                    transaction.set_rollback(True)
                    return Response({'detail': str(e), 'code': 'validation_error'}, status=400)
            if 'valid_days' in request.data:
                try:
                    days = int(request.data['valid_days'])
                    days = max(1, min(days, 14))
                    quote.valid_until = timezone.now() + timezone.timedelta(days=days)
                except (ValueError, TypeError):
                    transaction.set_rollback(True)
                    return Response({'detail': 'valid_days must be an integer between 1 and 14.', 'code': 'validation_error'}, status=400)
            quote.save(update_fields=['revision', 'total', 'pickup_fee', 'valid_until', 'updated_at'])

            if request.data.get('submit', True):
                quote.submitted_at = timezone.now()
                quote.transition_to(QuotationStatus.SUBMITTED, actor=request.user, request=request, reason=f'Submitted revision {quote.revision}', save=True)

        record(request.user, 'quotation.revise', 'quotation', quote.id, {'revision': quote.revision}, request)
        return Response(QuotationSerializer(quote).data)


class PriceComparisonView(APIView):
    permission_classes = [IsPatient]

    def post(self, request):
        rx_id = request.data.get('prescription_id')
        mode = request.data.get('mode', 'cheapest_complete')
        if mode not in ('cheapest_complete', 'cheapest_combination', 'fewest_pharmacies'):
            return Response({'detail': 'mode must be cheapest_complete | '
                                       'cheapest_combination | fewest_pharmacies',
                             'code': 'invalid_mode'}, status=400)
        try:
            rx = Prescription.objects.get(pk=rx_id, patient=request.user.patient_profile)
        except Prescription.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if rx.status != PrescriptionStatus.FINALIZED:
            return Response({'detail': 'Only finalized prescriptions can be compared.',
                             'code': 'not_finalized'}, status=409)
        return Response(compare(rx, mode))


class QuotationDetailView(APIView):
    """Read one quotation. Patient sees it only for their own prescription."""

    def get(self, request, pk):
        try:
            quote = Quotation.objects.get(pk=pk)
        except Quotation.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        user = request.user
        is_patient = (user.active_role == 'patient'
                      and hasattr(user, 'patient_profile')
                      and quote.prescription.patient_id == user.patient_profile.id)
        is_pharmacy = (user.active_role == 'pharmacy'
                       and hasattr(user, 'pharmacy_profile')
                       and quote.pharmacy_id == user.pharmacy_profile.id)
        if not (is_patient or is_pharmacy or user.active_role == 'admin'):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        return Response(QuotationSerializer(quote).data)


class QuotationRejectView(APIView):
    """Patient explicitly rejects a quotation."""

    def post(self, request, pk):
        try:
            quote = Quotation.objects.select_related('prescription__patient__user').get(pk=pk)
        except Quotation.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        user = request.user
        if not user.is_authenticated or user.active_role != 'patient' or quote.prescription.patient.user_id != user.id:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if quote.status not in (QuotationStatus.SUBMITTED, QuotationStatus.VIEWED):
            return Response({'detail': f'Cannot reject quotation in {quote.status} status.',
                             'code': 'invalid_state'}, status=409)
        quote.reject(actor=user, request=request, reason='Patient rejected quotation')
        return Response({'id': quote.id, 'status': quote.status})
