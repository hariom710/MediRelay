from django.db import transaction
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
            if rx.status != PrescriptionStatus.FINALIZED:
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
        try:
            share = PrescriptionShare.objects.select_related('prescription').get(pk=share_id)
        except PrescriptionShare.DoesNotExist:
            return Response({'detail': 'Share not found.', 'code': 'not_found'}, status=404)
        if not share.is_active:
            return Response({'detail': 'This share link is no longer active.',
                             'code': 'share_inactive'}, status=410)
        profile = request.user.pharmacy_profile
        if share.pharmacy_id and share.pharmacy_id != profile.id:
            return Response({'detail': 'This share was not sent to you.',
                             'code': 'not_your_share'}, status=403)

        rx = share.prescription
        if rx.status != PrescriptionStatus.FINALIZED:
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

        valid_days = int(request.data.get('valid_days', 2))
        valid_days = max(1, min(valid_days, 14))

        with transaction.atomic():
            quote = Quotation.objects.create(
                prescription=rx, pharmacy=profile, share=share,
                pickup_fee=request.data.get('pickup_fee') or 0,
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
        qi = QuotationItem.objects.create(
            quotation=quote, prescription_item_id=pid,
            offered_medicine_id=row.get('offered_medicine') or None,
            available=available,
            qty_offered=int(row.get('qty_offered') or 0),
            unit_price=Decimal(str(row.get('unit_price') or 0)),
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
        quote.transition_to(QuotationStatus.SUBMITTED, save=True,
                            update_fields=['status', 'submitted_at', 'valid_until'])
        record(request.user, 'quotation.submit', 'quotation', quote.id, {}, request)
        notify(quote.prescription.patient.user, 'quotation_submitted',
               'New price quotation',
               f'{quote.pharmacy.pharmacy_name} submitted a quotation.')
        return Response(QuotationSerializer(quote).data)


class PrescriptionQuotationsView(APIView):
    """Patient view: all quotations for their prescription. Marks them viewed."""

    permission_classes = [IsPatient]

    def get(self, request, pk):
        try:
            rx = Prescription.objects.get(pk=pk, patient=request.user.patient_profile)
        except Prescription.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        quotes = list(rx.quotations.exclude(status=QuotationStatus.DRAFT))
        now = timezone.now()
        for q in quotes:
            if q.valid_until < now and q.status in (QuotationStatus.SUBMITTED,
                                                    QuotationStatus.VIEWED):
                q.transition_to(QuotationStatus.EXPIRED, save=True)
            elif q.status == QuotationStatus.SUBMITTED:
                q.transition_to(QuotationStatus.VIEWED, save=True)
        return Response(QuotationSerializer(quotes, many=True).data)


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
