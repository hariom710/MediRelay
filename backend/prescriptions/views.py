import hashlib
import secrets

from django.db import models, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, VerificationStatus
from accounts.permissions import IsDoctor
from audit.models import PrescriptionAccessLog
from audit.services import record
from notifications.services import notify

from .models import Prescription, PrescriptionItem, PrescriptionShare, PrescriptionStatus, ShareStatus
from .serializers import (ItemWriteSerializer, PharmacyRxSerializer,
                          PrescriptionItemSerializer, PrescriptionSerializer,
                          ShareSerializer)
from .services import computed_total

SHARE_TTL_DAYS = 7


def _can_view(user, rx) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_staff or user.active_role == Role.ADMIN:
        return True
    if user.active_role == Role.DOCTOR and hasattr(user, 'doctor_profile') \
            and rx.doctor_id == user.doctor_profile.id:
        return True
    if user.active_role == Role.PATIENT and hasattr(user, 'patient_profile') \
            and rx.patient_id == user.patient_profile.id:
        return True
    if user.active_role == Role.PHARMACY and hasattr(user, 'pharmacy_profile'):
        profile = user.pharmacy_profile
        if profile.verification_status != VerificationStatus.VERIFIED:
            return False
        has_share = PrescriptionShare.objects.filter(
            prescription=rx,
            status=ShareStatus.ACTIVE,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).filter(models.Q(pharmacy=profile) | models.Q(pharmacy__isnull=True)).exists()
        if has_share:
            return True
        from quotations.models import Quotation
        if Quotation.objects.filter(prescription=rx, pharmacy=profile).exists():
            return True
    return False


class PrescriptionListCreateView(APIView):
    def get(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Authentication credentials were not provided.', 'code': 'not_authenticated'}, status=401)
        st = request.query_params.get('status')
        if user.active_role == Role.PATIENT and hasattr(user, 'patient_profile'):
            qs = user.patient_profile.prescriptions.select_related('patient', 'doctor')
        elif user.active_role == Role.DOCTOR and hasattr(user, 'doctor_profile'):
            qs = user.doctor_profile.prescriptions.select_related('patient', 'doctor')
        elif user.is_staff or user.active_role == Role.ADMIN:
            qs = Prescription.objects.select_related('patient', 'doctor')
        else:
            return Response({'detail': 'Role not permitted to list prescriptions.', 'code': 'permission_denied'}, status=403)
        if st:
            qs = qs.filter(status=st)
        return Response(PrescriptionSerializer(qs[:100], many=True).data)

    def post(self, request):
        user = request.user
        if not (user.is_authenticated and user.active_role == Role.DOCTOR and hasattr(user, 'doctor_profile')):
            return Response({'detail': 'Doctor profile required.', 'code': 'permission_denied'}, status=403)
        ser = ItemWriteSerializer(data=request.data.get('items'), many=True)
        ser.is_valid(raise_exception=True)
        patient_id = request.data.get('patient_id')
        consult_date = request.data.get('consultation_date')

        from accounts.models import PatientProfile
        try:
            patient = PatientProfile.objects.get(pk=patient_id)
        except (PatientProfile.DoesNotExist, TypeError, ValueError):
            return Response({'detail': 'Patient not found.', 'code': 'patient_not_found'},
                            status=404)

        if not consult_date:
            return Response({'detail': 'consultation_date is required.',
                             'code': 'validation_error'}, status=400)

        valid_until = request.data.get('valid_until')
        if valid_until:
            from datetime import date
            try:
                v_date = date.fromisoformat(str(valid_until))
                c_date = date.fromisoformat(str(consult_date))
                if v_date < c_date:
                    return Response({'detail': 'valid_until cannot be earlier than consultation_date.',
                                     'code': 'invalid_valid_until'}, status=400)
                if (v_date - c_date).days > 180:
                    return Response({'detail': 'valid_until cannot exceed 180 days from consultation_date.',
                                     'code': 'invalid_valid_until'}, status=400)
            except ValueError:
                return Response({'detail': 'valid_until must be YYYY-MM-DD.',
                                 'code': 'invalid_valid_until'}, status=400)

        with transaction.atomic():
            rx = Prescription.objects.create(
                patient=patient, doctor=request.user.doctor_profile,
                consultation_date=consult_date,
                valid_until=valid_until or None,
                notes=request.data.get('notes', ''))
            for i, item in enumerate(ser.validated_data):
                med_id = item.pop('medicine')
                obj = PrescriptionItem.objects.create(
                    prescription=rx, medicine_id=med_id,
                    sort_order=i, **item)
                obj.total_qty = computed_total(obj)
                obj.save(update_fields=['total_qty'])

        record(request.user, 'prescription.create', 'prescription', rx.id, {}, request)
        return Response(PrescriptionSerializer(rx).data, status=status.HTTP_201_CREATED)


class PrescriptionDetailView(APIView):
    def get(self, request, pk):
        try:
            rx = Prescription.objects.get(pk=pk)
        except Prescription.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        if not _can_view(request.user, rx):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        if request.user.active_role == Role.PHARMACY:
            ser = PharmacyRxSerializer(rx)  # redacted: no notes, contact details or history
        else:
            ser = PrescriptionSerializer(rx)
        return Response(ser.data)

    def patch(self, request, pk):
        if request.user.active_role != Role.DOCTOR:
            return Response({'detail': 'Only the prescribing doctor can edit.',
                             'code': 'permission_denied'}, status=403)
        try:
            rx = Prescription.objects.select_for_update().get(pk=pk)
        except Prescription.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if rx.doctor_id != request.user.doctor_profile.id:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if rx.status != PrescriptionStatus.DRAFT:
            return Response({'detail': 'Finalized prescriptions cannot be edited. Revise instead.',
                             'code': 'not_draft'}, status=409)

        if 'consultation_date' in request.data:
            rx.consultation_date = request.data['consultation_date']
        if 'notes' in request.data:
            rx.notes = request.data['notes']
        rx.save()

        # optional item updates: full replace while draft
        if 'items' in request.data:
            ser = ItemWriteSerializer(data=request.data['items'], many=True)
            ser.is_valid(raise_exception=True)
            with transaction.atomic():
                rx.items.all().delete()
                for i, item in enumerate(ser.validated_data):
                    med_id = item.pop('medicine')
                    obj = PrescriptionItem.objects.create(
                        prescription=rx, medicine_id=med_id,
                        sort_order=i, **item)
                    obj.total_qty = computed_total(obj)
                    obj.save(update_fields=['total_qty'])

        record(request.user, 'prescription.update', 'prescription', rx.id, {}, request)
        return Response(PrescriptionSerializer(rx).data)


class PrescriptionFinalizeView(APIView):
    permission_classes = [IsDoctor]

    def post(self, request, pk):
        doctor_profile = getattr(request.user, 'doctor_profile', None)
        if (doctor_profile is None or
                doctor_profile.verification_status != VerificationStatus.VERIFIED):
            return Response(
                {'detail': 'Your account is not verified. Finalizing prescriptions is blocked.',
                 'code': 'doctor_not_verified'}, status=403)
        with transaction.atomic():
            try:
                rx = Prescription.objects.select_for_update().get(pk=pk)
            except Prescription.DoesNotExist:
                return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
            if rx.doctor_id != request.user.doctor_profile.id:
                return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
            if rx.status != PrescriptionStatus.DRAFT:
                return Response({'detail': 'Only drafts can be finalized.',
                                 'code': 'not_draft'}, status=409)
            if not rx.items.exists():
                return Response({'detail': 'Cannot finalize a prescription with no items.',
                                 'code': 'empty_prescription'}, status=400)

            # doctor must confirm each calculated quantity
            from decimal import Decimal, InvalidOperation
            confirmed = request.data.get('items') or []
            confirmed_map = {}
            for c in confirmed:
                raw_id = c.get('item_id')
                try:
                    confirmed_map[int(raw_id)] = c.get('confirmed_qty')
                except (TypeError, ValueError):
                    continue
            for item in rx.items.all():
                calc = computed_total(item)
                given = confirmed_map.get(item.id)
                if given is None:
                    return Response(
                        {'detail': f'Quantity for item {item.id} must be confirmed before signing.',
                         'code': 'quantity_unconfirmed'}, status=400)
                try:
                    given_qty = Decimal(str(given))
                except (InvalidOperation, TypeError, ValueError):
                    given_qty = None
                if given_qty != calc:
                    return Response(
                        {'detail': f'Confirmed quantity for item {item.id} ({given}) does not '
                                  f'match calculated ({calc}).',
                         'code': 'quantity_mismatch'}, status=400)

            rx.signed_at = timezone.now()
            rx.transition_to(PrescriptionStatus.FINALIZED, actor=request.user, request=request, reason='Doctor finalized prescription', save=True, update_fields=['status', 'signed_at'])

        record(request.user, 'prescription.finalize', 'prescription', rx.id, {}, request)
        notify(rx.patient.user, 'prescription_ready',
               'New prescription available',
               f'RX-{rx.pk} v{rx.version} from your doctor.')
        return Response(PrescriptionSerializer(rx).data)


class PrescriptionReviseView(APIView):
    permission_classes = [IsDoctor]

    def post(self, request, pk):
        reason = request.data.get('reason', '')
        if not reason:
            return Response({'detail': 'A reason is required to revise.',
                             'code': 'reason_required'}, status=400)
        with transaction.atomic():
            try:
                old = Prescription.objects.select_for_update().get(pk=pk)
            except Prescription.DoesNotExist:
                return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
            if old.doctor_id != request.user.doctor_profile.id:
                return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
            if old.status != PrescriptionStatus.FINALIZED:
                return Response({'detail': 'Only finalized prescriptions can be revised.',
                                 'code': 'not_finalized'}, status=409)

            new = Prescription.objects.create(
                patient=old.patient, doctor=old.doctor,
                consultation_date=old.consultation_date, notes=old.notes,
                version=old.version + 1, previous_version=old,
                revision_reason=reason)
            for item in old.items.all():
                item.pk = None
                item.prescription = new
                item.save()
            old.transition_to(PrescriptionStatus.REVISED, actor=request.user, request=request, reason=f'Revised to v{new.version}', save=True, update_fields=['status'])

        record(request.user, 'prescription.revise', 'prescription', new.id,
               {'from': old.id, 'reason': reason}, request)
        notify(old.patient.user, 'prescription_revised',
               'Prescription revised',
               f'RX-{old.pk} was revised to v{new.version}.')
        return Response(PrescriptionSerializer(new).data)


class PrescriptionCancelView(APIView):
    permission_classes = [IsDoctor]

    def post(self, request, pk):
        reason = request.data.get('reason', '')
        if not reason:
            return Response({'detail': 'A reason is required to cancel.',
                             'code': 'reason_required'}, status=400)
        try:
            rx = Prescription.objects.get(pk=pk)
        except Prescription.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if rx.doctor_id != request.user.doctor_profile.id:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if rx.status != PrescriptionStatus.FINALIZED:
            return Response({'detail': 'Only finalized prescriptions can be cancelled.',
                             'code': 'not_finalized'}, status=409)
        rx.revision_reason = reason
        rx.transition_to(PrescriptionStatus.CANCELLED, actor=request.user, request=request, reason=reason, save=True, update_fields=['status', 'revision_reason'])
        record(request.user, 'prescription.cancel', 'prescription', rx.id,
               {'reason': reason}, request)
        notify(rx.patient.user, 'prescription_cancelled',
               'Prescription cancelled', f'RX-{rx.pk} was cancelled.')
        return Response(PrescriptionSerializer(rx).data)


class PrescriptionPDFView(APIView):
    def get(self, request, pk):
        from .pdf import prescription_pdf
        try:
            rx = Prescription.objects.select_related().prefetch_related('items__medicine').get(pk=pk)
        except Prescription.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if not _can_view(request.user, rx):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if request.user.active_role == Role.PHARMACY:
            # Pharmacy gets the redacted JSON view, not notes/patient identity in a PDF.
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        if rx.is_expired:
            return Response({'detail': 'This prescription has expired.',
                             'code': 'prescription_expired'}, status=410)
        return prescription_pdf(rx)


class ShareListCreateView(APIView):
    """Shares only exist for finalized prescriptions."""

    def get(self, request, pk):
        rx = self._get_owned(request, pk)
        if rx is None:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        return Response(ShareSerializer(rx.shares.all(), many=True).data)

    def post(self, request, pk):
        rx = self._get_owned(request, pk)
        if rx is None:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if not (request.user.is_staff or request.user.active_role in
                (Role.ADMIN, Role.DOCTOR, Role.PATIENT)):
            return Response({'detail': 'Not permitted to create share links.',
                             'code': 'permission_denied'}, status=403)
        from accounts.models import PharmacyProfile, VerificationStatus
        doctor_profile = getattr(request.user, 'doctor_profile', None)
        if request.user.active_role == Role.DOCTOR and (
                doctor_profile is None or
                doctor_profile.verification_status != VerificationStatus.VERIFIED):
            return Response(
                {'detail': 'Your account is not verified. Sharing prescriptions is blocked.',
                 'code': 'doctor_not_verified'}, status=403)
        if rx.status != PrescriptionStatus.FINALIZED:
            return Response({'detail': 'Only finalized prescriptions can be shared.',
                             'code': 'not_finalized'}, status=409)

        pharmacy = None
        pharmacy_id = request.data.get('pharmacy_id')
        if pharmacy_id:
            from accounts.models import PharmacyProfile, VerificationStatus
            try:
                pharmacy = PharmacyProfile.objects.get(
                    pk=pharmacy_id, verification_status=VerificationStatus.VERIFIED)
            except PharmacyProfile.DoesNotExist:
                return Response({'detail': 'Pharmacy not found or not verified.',
                                 'code': 'pharmacy_not_found'}, status=404)

        raw_days = request.data.get('expires_in_days') or request.data.get('valid_days') or SHARE_TTL_DAYS
        try:
            days = int(raw_days)
            if days <= 0 or days > 365:
                raise ValueError()
        except (ValueError, TypeError):
            return Response({'detail': 'expires_in_days must be a positive integer.', 'code': 'validation_error'}, status=400)
        days = max(1, min(days, 30))
        token = secrets.token_urlsafe(32)
        share = PrescriptionShare.objects.create(
            prescription=rx, pharmacy=pharmacy,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            created_by=request.user,
            expires_at=timezone.now() + timezone.timedelta(days=days))
        record(request.user, 'prescription.share', 'prescription', rx.id,
               {'share_id': share.id, 'targeted': pharmacy is not None}, request)
        if pharmacy:
            notify(pharmacy.user, 'prescription_shared',
                   'New prescription request',
                   f'A prescription was shared with {pharmacy.pharmacy_name}.')
        # token returned exactly once; only the hash is stored
        return Response({'share': ShareSerializer(share).data, 'token': token},
                        status=status.HTTP_201_CREATED)

    def _get_owned(self, request, pk):
        try:
            rx = Prescription.objects.get(pk=pk)
        except Prescription.DoesNotExist:
            return None
        if not _can_view(request.user, rx):
            return None
        return rx


class ShareRevokeView(APIView):
    def post(self, request, pk, share_id):
        try:
            share = PrescriptionShare.objects.get(pk=share_id, prescription_id=pk)
        except PrescriptionShare.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        rx = share.prescription
        user = request.user
        allowed = (user.is_staff or user.active_role == Role.ADMIN
                   or (user.active_role == Role.DOCTOR
                       and rx.doctor_id == getattr(getattr(user, 'doctor_profile', None), 'id', None))
                   or (user.active_role == Role.PATIENT
                       and rx.patient_id == getattr(getattr(user, 'patient_profile', None), 'id', None)))
        if not allowed:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if share.status == ShareStatus.ACTIVE and share.revoked_at is None:
            share.revoke(actor=request.user, request=request, reason='Share link revoked by user')
            record(request.user, 'prescription.share_revoke', 'prescription', pk,
                   {'share_id': share.id}, request)
        return Response(ShareSerializer(share).data)


class PrescriptionAccessLogListView(APIView):
    """Doctor-facing access log: who opened a shared prescription and when."""

    def get(self, request, pk):
        try:
            rx = Prescription.objects.get(pk=pk)
        except Prescription.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if not _can_view(request.user, rx):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        user = request.user
        allowed = (user.is_staff or user.active_role == Role.ADMIN
                   or (user.active_role == Role.DOCTOR
                       and rx.doctor_id == getattr(getattr(user, 'doctor_profile', None), 'id', None))
                   or (user.active_role == Role.PATIENT
                       and rx.patient_id == getattr(getattr(user, 'patient_profile', None), 'id', None)))
        if not allowed:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        logs = (PrescriptionAccessLog.objects
                .filter(share__prescription=rx)
                .select_related('user')
                .order_by('-accessed_at')[:100])
        return Response([{
            'id': l.id,
            'user_id': l.user_id,
            'user_email': l.user.email if l.user else None,
            'role': l.role,
            'accessed_at': l.accessed_at.isoformat(),
        } for l in logs])


class ShareTokenView(APIView):
    from config.throttles import ShareTokenThrottle
    throttle_classes = [ShareTokenThrottle]

    def get(self, request, token):
        from rest_framework.permissions import IsAuthenticated
        if not request.user.is_authenticated:
            return Response({'detail': 'Login required to open this prescription.',
                             'code': 'authentication_required'}, status=401)

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        try:
            share = PrescriptionShare.objects.select_related('prescription').get(
                token_hash=token_hash)
        except PrescriptionShare.DoesNotExist:
            record(request.user if request.user.is_authenticated else None,
                   'prescription.share_lookup_failed', 'share_token', 0,
                   {'token_prefix': token[:8]}, request)
            return Response({'detail': 'Invalid link.', 'code': 'invalid_token'}, status=404)

        # Check revocation and expiry before pharmacy ownership checks to ensure correct status codes
        if share.status == ShareStatus.REVOKED or share.revoked_at is not None:
            return Response({'detail': 'This link was revoked.', 'code': 'revoked'}, status=410)
        if not share.is_active or share.status == ShareStatus.EXPIRED:
            return Response({'detail': 'This link has expired.', 'code': 'expired'}, status=410)

        rx = share.prescription
        if rx.is_expired or rx.status == PrescriptionStatus.EXPIRED:
            return Response({'detail': 'This prescription has expired.', 'code': 'prescription_expired'}, status=410)

        user = request.user
        # Only patients/doctors/admin can be owners here; a pharmacy must pass
        # the verified + targeted-share checks below even on an open link.
        is_owner = share.prescription and (
            user.is_staff
            or user.active_role == Role.ADMIN
            or user.active_role == Role.DOCTOR
            or user.active_role == Role.PATIENT
        ) and _can_view(user, share.prescription)
        if not is_owner:
            if user.active_role != Role.PHARMACY:
                return Response({'detail': 'Invalid link.', 'code': 'invalid_token'}, status=404)
            from accounts.models import VerificationStatus
            profile = getattr(user, 'pharmacy_profile', None)
            if profile is None or profile.verification_status != VerificationStatus.VERIFIED:
                return Response({'detail': 'Your pharmacy account is not verified yet.',
                                 'code': 'not_verified'}, status=403)
            # targeted share: only that pharmacy may open it
            if share.pharmacy_id and share.pharmacy_id != profile.id:
                return Response({'detail': 'Invalid link.', 'code': 'invalid_token'}, status=404)

        # log every access (owner or pharmacy)
        PrescriptionAccessLog.objects.create(
            share=share, user=user, role=user.active_role)

        rx = share.prescription
        rx_data = PharmacyRxSerializer(rx).data if user.active_role == Role.PHARMACY else PrescriptionSerializer(rx).data
        return Response({
            'share_id': share.id,
            'prescription_id': rx.id,
            'expires_at': share.expires_at.isoformat(),
            'prescription': rx_data
        })
