import hashlib
import re
import secrets
from datetime import date, timedelta

from django.contrib.auth import get_user_model, login
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from accounts.models import (AccessScope, AccessStatus, CareAccess, DoctorProfile,
                             GrantedVia, PatientProfile, Role, User, VerificationStatus)
from accounts.permissions import IsDoctor, IsPatient
from accounts.registry import (ACCESS_CODE_TTL_MINUTES, active_access,
                               active_access_rows, generate_patient_code,
                               generate_temp_password, mask_phone, new_access_code,
                               normalize_name, normalize_phone, redeem_access_code,
                               unique_patient_code)
from accounts.serializers import PatientProfileSerializer, UserSerializer
from audit.models import AuditLog
from audit.services import record
from notifications.services import notify

User = get_user_model()


class PatientSearchThrottle(UserRateThrottle):
    rate = '30/minute'


class PatientSearchView(APIView):
    """Exact-match search for verified doctors only. Prevents patient enumeration."""

    permission_classes = [IsDoctor]
    throttle_classes = [PatientSearchThrottle]

    def get(self, request):
        doc = getattr(request.user, 'doctor_profile', None)
        if doc is None or doc.verification_status != VerificationStatus.VERIFIED:
            return Response(
                {'detail': 'Only verified doctors can search patients.',
                 'code': 'doctor_not_verified'}, status=403)

        q = (request.query_params.get('q') or '').strip()
        if not q:
            return Response([])

        # Hash query for audit log — never store raw query string
        q_hash = hashlib.sha256(q.encode()).hexdigest()[:16]
        record(request.user, 'patient.search', 'patient_search', 0,
               {'query_hash': q_hash}, request)

        q_upper = q.upper()
        norm_phone = normalize_phone(q)

        # Exact match logic only
        if q_upper.startswith('MR-') and len(q_upper) >= 6:
            qs = PatientProfile.objects.filter(patient_code__iexact=q_upper)
        elif len(norm_phone) == 10 and re.fullmatch(r'\d{10}', norm_phone):
            qs = PatientProfile.objects.filter(phone_normalized=norm_phone)
        elif '@' in q and len(q) >= 4:
            qs = PatientProfile.objects.filter(user__email__iexact=q)
        else:
            # Partial name or invalid format returns empty list (anti-scraping)
            return Response([])

        qs = qs.select_related('user')
        results = []
        today = timezone.now().date()
        for p in qs[:10]:
            dob = p.date_of_birth
            age = None
            if dob:
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            grant = active_access(request.user, p)
            has_acc = grant is not None
            full_name = p.user.get_full_name() or p.user.first_name or 'Patient'
            req_exists = CareAccess.objects.filter(
                doctor=doc, patient=p, status=AccessStatus.PENDING
            ).exists()
            results.append({
                'id': p.id,
                'patient_code': p.patient_code,
                'name': full_name,
                'age': age,
                'gender': p.gender,
                'masked_phone': mask_phone(p.phone_normalized),
                'phone_masked': mask_phone(p.phone_normalized),
                'has_access': has_acc,
                'has_active_access': has_acc,
                'access_scope': grant.scope if grant else None,
                'access_status': 'granted' if has_acc else ('requested' if req_exists else 'none'),
                'is_claimed': p.is_claimed,
            })
        return Response(results)


class PatientListCreateView(APIView):
    """GET: Patients for whom requesting doctor holds active consent.
    POST: Doctor registers patient on behalf, with soft duplicate warning and temporary credentials."""

    permission_classes = [IsDoctor]

    def get(self, request):
        doc = getattr(request.user, 'doctor_profile', None)
        if doc is None:
            return Response([])

        active_grants = active_access_rows(doc).select_related('patient__user')
        rows = []
        for grant in active_grants:
            p = grant.patient
            u = p.user
            rows.append({
                'id': p.id,
                'patient_code': p.patient_code,
                'name': u.get_full_name() or u.first_name or u.email,
                'email': u.email if p.is_claimed else '',
                'phone': u.phone,
                'date_of_birth': p.date_of_birth.isoformat() if p.date_of_birth else None,
                'gender': p.gender,
                'allergies': p.allergies,
                'chronic_conditions': p.chronic_conditions,
                'access_scope': grant.scope,
                'access_expires_at': grant.expires_at.isoformat() if grant.expires_at else None,
                'is_claimed': p.is_claimed,
            })
        return Response(rows)

    def post(self, request):
        doc = getattr(request.user, 'doctor_profile', None)
        if doc is None or doc.verification_status != VerificationStatus.VERIFIED:
            return Response(
                {'detail': 'Only verified doctors can register patients on behalf.',
                 'code': 'doctor_not_verified'}, status=403)

        data = request.data
        name = (data.get('name') or '').strip()
        dob_raw = data.get('date_of_birth')
        gender = (data.get('gender') or data.get('sex') or '').strip()
        phone = (data.get('phone') or '').strip()
        email = (data.get('email') or '').strip().lower()
        override_reason = (data.get('override_reason') or '').strip()

        if not name:
            return Response({'detail': 'name is required.', 'code': 'validation_error'}, status=400)
        if not dob_raw:
            return Response({'detail': 'date_of_birth is required.', 'code': 'validation_error'}, status=400)
        try:
            dob = date.fromisoformat(str(dob_raw))
        except (ValueError, TypeError):
            return Response({'detail': 'date_of_birth must be in YYYY-MM-DD format.', 'code': 'validation_error'}, status=400)

        norm_phone = normalize_phone(phone)
        norm_name = normalize_name(name)

        # Soft duplicate check
        if not override_reason:
            dup = None
            if norm_phone:
                dup = PatientProfile.objects.filter(phone_normalized=norm_phone, date_of_birth=dob).first()
            if dup is None and norm_name:
                dup = PatientProfile.objects.filter(date_of_birth=dob, user__first_name__iexact=name).first()

            if dup is not None:
                return Response({
                    'detail': 'A profile with matching details was found. Provide an override reason to continue.',
                    'code': 'potential_duplicate',
                    'matched_hint': f'{dup.patient_code} ({mask_phone(dup.phone_normalized)})',
                    'require_override': True,
                }, status=409)

        # Generate credentials
        temp_password = generate_temp_password()
        placeholder_email = email if email else f'patient-{secrets.token_hex(6)}@medirelay.local'

        with transaction.atomic():
            user = User.objects.create_user(
                email=placeholder_email,
                password=temp_password,
                first_name=name,
                phone=phone,
                must_change_password=True,
            )
            role_obj, _ = Role.objects.get_or_create(name=Role.PATIENT)
            user.roles.add(role_obj)
            user.active_role = Role.PATIENT
            user.save()

            code = unique_patient_code()
            profile = PatientProfile.objects.create(
                user=user,
                patient_code=code,
                date_of_birth=dob,
                gender=gender,
                allergies=data.get('allergies', ''),
                chronic_conditions=data.get('chronic_conditions', ''),
                phone_normalized=norm_phone,
                is_claimed=bool(email and not email.endswith('@medirelay.local')),
                created_by=request.user,
            )

            # Creating doctor receives active care access
            now = timezone.now()
            CareAccess.objects.create(
                doctor=doc,
                patient=profile,
                scope=AccessScope.FULL,
                status=AccessStatus.ACTIVE,
                granted_via=GrantedVia.ONE_TIME_CODE,
                granted_at=now,
                expires_at=now + timedelta(days=365),
            )

        # Audit without password!
        record(request.user, 'patient.create', 'patient', profile.id, {
            'patient_code': code,
            'has_override_reason': bool(override_reason),
        }, request)

        return Response({
            'patient_id': profile.id,
            'patient_code': profile.patient_code,
            'name': name,
            'login_id': user.email,
            'temp_password': temp_password,
            'expires_days': 7,
            'must_change_password': True,
        }, status=status.HTTP_201_CREATED)


class PatientDetailView(APIView):
    """Requires active CareAccess grant for doctors."""

    permission_classes = [IsDoctor]

    def get(self, request, pk):
        try:
            p = PatientProfile.objects.select_related('user').get(pk=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        grant = active_access(request.user, p)
        if grant is None:
            return Response({'detail': 'Not found or access not granted.', 'code': 'not_found'}, status=404)

        u = p.user
        data = {
            'id': p.id,
            'patient_code': p.patient_code,
            'name': u.get_full_name() or u.first_name or u.email,
            'email': u.email if p.is_claimed else '',
            'phone': u.phone,
            'date_of_birth': p.date_of_birth.isoformat() if p.date_of_birth else None,
            'gender': p.gender,
            'blood_group': p.blood_group,
            'allergies': p.allergies,
            'chronic_conditions': p.chronic_conditions,
            'access_scope': grant.scope,
            'access_expires_at': grant.expires_at.isoformat() if grant.expires_at else None,
            'is_claimed': p.is_claimed,
        }
        return Response(data)

    def patch(self, request, pk):
        try:
            p = PatientProfile.objects.select_related('user').get(pk=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        grant = active_access(request.user, p)
        if grant is None:
            return Response({'detail': 'Active access required.', 'code': 'not_found'}, status=404)

        data = request.data
        if 'allergies' in data:
            p.allergies = data['allergies'] or ''
        if 'chronic_conditions' in data:
            p.chronic_conditions = data['chronic_conditions'] or ''
        if 'blood_group' in data:
            p.blood_group = data['blood_group'] or ''
        if 'gender' in data:
            p.gender = data['gender'] or ''
        p.save()
        return Response({'detail': 'Updated successfully.'})


class PatientSummaryView(APIView):
    """Basic Scope: Demographics, allergies, chronic conditions, and active medicines."""

    permission_classes = [IsDoctor]

    def get(self, request, pk):
        try:
            p = PatientProfile.objects.select_related('user').get(pk=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        grant = active_access(request.user, p)
        if grant is None:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        from prescriptions.models import PrescriptionItem, PrescriptionStatus
        now_date = timezone.now().date()
        active_items = (PrescriptionItem.objects
                        .filter(prescription__patient=p,
                                prescription__status=PrescriptionStatus.FINALIZED)
                        .filter(Q(prescription__valid_until__gte=now_date) | Q(prescription__valid_until__isnull=True))
                        .select_related('medicine', 'prescription__doctor__user'))

        meds = []
        for it in active_items:
            doc_user = it.prescription.doctor.user
            meds.append({
                'medicine_name': it.medicine.display_name,
                'strength': it.strength,
                'dosage_form': it.dosage_form,
                'instructions': it.instructions,
                'prescribed_by': doc_user.get_full_name() or doc_user.email,
                'prescribed_date': it.prescription.consultation_date.isoformat(),
            })

        record(request.user, 'patient.view_summary', 'patient', p.id, {}, request)

        u = p.user
        return Response({
            'id': p.id,
            'patient_code': p.patient_code,
            'name': u.get_full_name() or u.first_name,
            'date_of_birth': p.date_of_birth.isoformat() if p.date_of_birth else None,
            'gender': p.gender,
            'blood_group': p.blood_group,
            'allergies': p.allergies,
            'chronic_conditions': p.chronic_conditions,
            'active_medications': meds,
            'current_medicines': meds,
            'scope': grant.scope,
        })


class PatientTimelineView(APIView):
    """Full Scope: Visits, prescriptions from ALL doctors, and MediRelay purchases.
    Clinical privacy: private notes/clinical notes are author-only."""

    permission_classes = [IsDoctor]

    def get(self, request, pk):
        try:
            p = PatientProfile.objects.select_related('user').get(pk=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        base_grant = active_access(request.user, p)
        if base_grant is None:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if base_grant.scope != AccessScope.FULL:
            return Response(
                {'detail': 'Full access required to view cross-doctor clinical timeline.',
                 'code': 'full_scope_required'}, status=403)
        grant = base_grant

        doc_profile = request.user.doctor_profile

        # 1. Visits across all attending doctors
        from prescriptions.models import Visit
        visits = Visit.objects.filter(patient=p).select_related('doctor__user')
        visit_rows = []
        for v in visits:
            doc_user = v.doctor.user
            is_author = (v.doctor_id == doc_profile.id)
            visit_rows.append({
                'id': v.id,
                'visited_at': v.visited_at.isoformat(),
                'doctor_name': doc_user.get_full_name() or doc_user.email,
                'doctor_qualification': v.doctor.qualification,
                'complaint': v.complaint,
                'diagnosis': v.diagnosis,
                'prescription_id': v.prescription_id,
                # Private notes visible only to the doctor who wrote them
                'private_notes': v.private_notes if is_author else '',
                'is_author': is_author,
            })

        # 2. Prescriptions across all attending doctors
        from prescriptions.models import Prescription
        prescriptions = Prescription.objects.filter(patient=p).select_related('doctor__user').prefetch_related('items__medicine')
        rx_rows = []
        for rx in prescriptions:
            doc_user = rx.doctor.user
            is_author = (rx.doctor_id == doc_profile.id)
            rx_rows.append({
                'id': rx.id,
                'consultation_date': rx.consultation_date.isoformat(),
                'doctor_name': doc_user.get_full_name() or doc_user.email,
                'status': rx.status,
                'version': rx.version,
                'valid_until': rx.valid_until.isoformat() if rx.valid_until else None,
                # Doctor private notes visible only to prescribing doctor
                'notes': rx.notes if is_author else '',
                'items': [{
                    'medicine_name': it.medicine.display_name,
                    'strength': it.strength,
                    'dosage_form': it.dosage_form,
                    'total_qty': it.total_qty,
                    'instructions': it.instructions,
                } for it in rx.items.all()],
            })

        # 3. MediRelay Purchases (Order Fulfillments)
        from orders.models import OrderFulfillment
        fulfillments = (OrderFulfillment.objects
                        .filter(order__prescription__patient=p)
                        .select_related('pharmacy', 'order'))
        purchase_rows = []
        for f in fulfillments:
            purchase_rows.append({
                'fulfillment_id': f.id,
                'order_id': f.order_id,
                'pharmacy_name': f.pharmacy.pharmacy_name,
                'status': f.status,
                'pickup_fee': str(f.pickup_fee),
                'date': f.created_at.isoformat(),
            })

        # 4. Build unified chronological timeline list
        timeline_events = []
        for v in visit_rows:
            timeline_events.append({
                'type': 'visit',
                'id': v['id'],
                'date': v['visited_at'],
                'doctor_name': v['doctor_name'],
                'title': f"Clinical Visit: {v['complaint']}",
                'description': f"Diagnosis: {v['diagnosis']}" + (f" | Notes: {v['private_notes']}" if v.get('private_notes') else ""),
                'details': v,
            })
        for rx in rx_rows:
            med_names = ", ".join([it['medicine_name'] for it in rx.get('items', [])]) or "No items listed"
            timeline_events.append({
                'type': 'prescription',
                'id': rx['id'],
                'date': rx['consultation_date'],
                'doctor_name': rx['doctor_name'],
                'title': f"Prescription #{rx['id']} (v{rx['version']})",
                'description': f"Medicines: {med_names}",
                'details': rx,
            })
        for pur in purchase_rows:
            timeline_events.append({
                'type': 'purchase',
                'id': pur['fulfillment_id'],
                'date': pur['date'],
                'pharmacy_name': pur['pharmacy_name'],
                'title': f"Pharmacy Dispensation - {pur['pharmacy_name']}",
                'description': f"Order #{pur['order_id']} fulfilled. Status: {pur['status']}",
                'details': pur,
            })
        timeline_events.sort(key=lambda x: str(x.get('date') or ''), reverse=True)

        record(request.user, 'patient.view_timeline', 'patient', p.id, {}, request)

        return Response({
            'patient_id': p.id,
            'patient_code': p.patient_code,
            'visits': visit_rows,
            'prescriptions': rx_rows,
            'purchases': purchase_rows,
            'timeline': timeline_events,
            'events': timeline_events,
        })


class VisitListCreateView(APIView):
    """Consultation visits for a patient."""

    permission_classes = [IsDoctor]

    def get(self, request, pk):
        try:
            p = PatientProfile.objects.get(pk=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if not active_access(request.user, p):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        from prescriptions.models import Visit
        visits = Visit.objects.filter(patient=p).select_related('doctor__user')
        doc_id = request.user.doctor_profile.id
        return Response([{
            'id': v.id,
            'visited_at': v.visited_at.isoformat(),
            'doctor_name': v.doctor.user.get_full_name() or v.doctor.user.email,
            'complaint': v.complaint,
            'diagnosis': v.diagnosis,
            'private_notes': v.private_notes if v.doctor_id == doc_id else '',
            'prescription_id': v.prescription_id,
        } for v in visits])

    def post(self, request, pk):
        try:
            p = PatientProfile.objects.get(pk=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if not active_access(request.user, p):
            return Response({'detail': 'Active care access required.', 'code': 'not_found'}, status=403)

        from prescriptions.models import Visit
        data = request.data
        visited_at = data.get('visited_at') or timezone.now().date().isoformat()
        try:
            v_date = date.fromisoformat(str(visited_at))
        except (ValueError, TypeError):
            return Response({'detail': 'visited_at must be YYYY-MM-DD.', 'code': 'validation_error'}, status=400)

        v = Visit.objects.create(
            patient=p,
            doctor=request.user.doctor_profile,
            visited_at=v_date,
            complaint=data.get('complaint', ''),
            diagnosis=data.get('diagnosis', ''),
            private_notes=data.get('private_notes', ''),
            prescription_id=data.get('prescription_id'),
        )
        return Response({
            'id': v.id,
            'visited_at': v.visited_at.isoformat(),
            'complaint': v.complaint,
            'diagnosis': v.diagnosis,
        }, status=status.HTTP_201_CREATED)


class CareAccessRequestView(APIView):
    """Doctor requests access to a patient; or lists outgoing/incoming requests."""

    def post(self, request):
        if not (request.user.is_authenticated and request.user.active_role == Role.DOCTOR and hasattr(request.user, 'doctor_profile')):
            return Response({'detail': 'Doctor profile required.', 'code': 'forbidden'}, status=403)

        doc = request.user.doctor_profile
        patient_id = request.data.get('patient_id')
        patient_code = request.data.get('patient_code')
        scope = request.data.get('scope', AccessScope.FULL)
        if scope not in (AccessScope.BASIC, AccessScope.FULL):
            scope = AccessScope.FULL

        p = None
        if patient_id:
            p = PatientProfile.objects.filter(pk=patient_id).first()
        elif patient_code:
            p = PatientProfile.objects.filter(patient_code__iexact=patient_code.strip()).first()

        if p is None:
            return Response({'detail': 'Patient not found.', 'code': 'patient_not_found'}, status=404)

        access, _ = CareAccess.objects.get_or_create(doctor=doc, patient=p)
        if access.status == AccessStatus.ACTIVE and access.expires_at and access.expires_at > timezone.now() and not access.revoked_at:
            return Response({'detail': 'Access already active.', 'status': 'active', 'expires_at': access.expires_at})

        if access.status != AccessStatus.PENDING:
            access.transition_to(AccessStatus.PENDING, actor=request.user, request=request, reason='Doctor requested access')
        access.scope = scope
        access.requested_at = timezone.now()
        access.save(update_fields=['scope', 'requested_at'])

        doc_name = request.user.get_full_name() or request.user.email
        notify(p.user, 'access_requested', 'Doctor Requested Access',
               f'Dr. {doc_name} has requested {scope} access to your medical records.')

        return Response({
            'id': access.id,
            'status': access.status,
            'scope': access.scope,
            'requested_at': access.requested_at.isoformat(),
        }, status=status.HTTP_201_CREATED)

    def get(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Not authenticated.'}, status=401)

        if user.active_role == Role.PATIENT and hasattr(user, 'patient_profile'):
            requests = (CareAccess.objects
                        .filter(patient=user.patient_profile, status=AccessStatus.PENDING)
                        .select_related('doctor__user'))
            return Response([{
                'id': r.id,
                'doctor_name': r.doctor.user.get_full_name() or r.doctor.user.email,
                'doctor_qualification': r.doctor.qualification,
                'scope': r.scope,
                'requested_at': r.requested_at.isoformat(),
            } for r in requests])

        elif user.active_role == Role.DOCTOR and hasattr(user, 'doctor_profile'):
            requests = (CareAccess.objects
                        .filter(doctor=user.doctor_profile, status=AccessStatus.PENDING)
                        .select_related('patient__user'))
            return Response([{
                'id': r.id,
                'patient_code': r.patient.patient_code,
                'patient_name': r.patient.user.get_full_name() or r.patient.user.email,
                'scope': r.scope,
                'requested_at': r.requested_at.isoformat(),
            } for r in requests])

        return Response([])


class CareAccessDecisionView(APIView):
    """Patient approves or denies a pending access request."""

    permission_classes = [IsPatient]

    def post(self, request, pk, action):
        try:
            access = CareAccess.objects.select_related('patient__user', 'doctor__user').get(pk=pk)
        except CareAccess.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        if access.patient != request.user.patient_profile:
            return Response({'detail': 'Not permitted.', 'code': 'forbidden'}, status=403)

        if action == 'approve':
            days = int(request.data.get('days') or 365)
            scope = request.data.get('scope') or access.scope
            access.grant(via=GrantedVia.PATIENT_APPROVED, days=days, scope=scope,
                         actor=request.user, request=request)
            notify(access.doctor.user, 'access_approved', 'Patient Approved Access',
                   f'{access.patient.user.get_full_name()} approved your care access request.')
            return Response({'status': access.status, 'scope': access.scope, 'expires_at': access.expires_at})

        elif action == 'deny':
            access.deny(actor=request.user, request=request)
            notify(access.doctor.user, 'access_denied', 'Access Request Denied',
                   f'{access.patient.user.get_full_name()} denied your care access request.')
            return Response({'status': access.status})

        return Response({'detail': 'Invalid action.', 'code': 'invalid_action'}, status=400)


class CareAccessCodeView(APIView):
    """Patient generates a single-use 6-digit in-person access code."""

    permission_classes = [IsPatient]

    def post(self, request):
        p = request.user.patient_profile
        scope = request.data.get('scope', AccessScope.FULL)
        if scope not in (AccessScope.BASIC, AccessScope.FULL):
            scope = AccessScope.FULL
        code = new_access_code(p)
        return Response({
            'code': code,
            'scope': scope,
            'duration_minutes': ACCESS_CODE_TTL_MINUTES,
            'expires_in_minutes': ACCESS_CODE_TTL_MINUTES,
        })


class CareAccessCodeRedeemView(APIView):
    """Doctor enters patient's 6-digit code to immediately activate CareAccess."""

    permission_classes = [IsDoctor]

    def post(self, request):
        doc = getattr(request.user, 'doctor_profile', None)
        if doc is None or doc.verification_status != VerificationStatus.VERIFIED:
            return Response({'detail': 'Only verified doctors can redeem access codes.', 'code': 'doctor_not_verified'}, status=403)

        patient_code = (request.data.get('patient_code') or '').strip().upper()
        patient_id = request.data.get('patient_id')
        code = (request.data.get('code') or '').strip()
        scope = request.data.get('scope', AccessScope.FULL)

        p = None
        if patient_code:
            p = PatientProfile.objects.filter(patient_code__iexact=patient_code).first()
        elif patient_id:
            p = PatientProfile.objects.filter(pk=patient_id).first()

        match = redeem_access_code(p, code)
        if not match:
            return Response({'detail': 'Invalid, expired, or locked access code.', 'code': 'invalid_code'}, status=400)

        # If p was not supplied, match is the resolved PatientProfile
        if p is None and isinstance(match, PatientProfile):
            p = match
        elif p is None:
            return Response({'detail': 'Patient could not be resolved.', 'code': 'patient_not_found'}, status=404)

        access, _ = CareAccess.objects.get_or_create(doctor=doc, patient=p)
        access.grant(via=GrantedVia.ONE_TIME_CODE, days=365, scope=scope,
                     actor=request.user, request=request)

        notify(p.user, 'access_granted', 'Access Granted via Code',
               f'Dr. {request.user.get_full_name()} accessed your profile via in-person code.')

        return Response({
            'detail': 'Access granted successfully.',
            'status': access.status,
            'scope': access.scope,
            'expires_at': access.expires_at.isoformat() if access.expires_at else None,
            'patient': {
                'id': p.id,
                'name': p.user.get_full_name() or p.user.first_name or p.user.email,
                'patient_code': p.patient_code,
            },
            'care_access_id': access.id,
        })


class CareAccessListView(APIView):
    """Patient: view and manage granted doctors. Doctor: view granted patients."""

    def get(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Not authenticated.'}, status=401)

        if user.active_role == Role.PATIENT and hasattr(user, 'patient_profile'):
            grants = (CareAccess.objects
                      .filter(patient=user.patient_profile, status=AccessStatus.ACTIVE)
                      .select_related('doctor__user'))
            return Response([{
                'id': g.id,
                'doctor_id': g.doctor.id,
                'doctor_name': g.doctor.user.get_full_name() or g.doctor.user.email,
                'doctor_qualification': g.doctor.qualification,
                'clinic_name': g.doctor.clinic_name,
                'scope': g.scope,
                'granted_via': g.granted_via,
                'granted_at': g.granted_at.isoformat() if g.granted_at else None,
                'expires_at': g.expires_at.isoformat() if g.expires_at else None,
            } for g in grants])

        elif user.active_role == Role.DOCTOR and hasattr(user, 'doctor_profile'):
            grants = active_access_rows(user.doctor_profile).select_related('patient__user')
            return Response([{
                'id': g.id,
                'patient_id': g.patient.id,
                'patient_code': g.patient.patient_code,
                'patient_name': g.patient.user.get_full_name() or g.patient.user.email,
                'scope': g.scope,
                'expires_at': g.expires_at.isoformat() if g.expires_at else None,
            } for g in grants])

        return Response([])

    def patch(self, request, pk):
        """Patient shortens expiry."""
        try:
            access = CareAccess.objects.get(pk=pk, patient=request.user.patient_profile)
        except (CareAccess.DoesNotExist, AttributeError):
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        days = request.data.get('days')
        if days:
            try:
                d = int(days)
                if d <= 0 or d > 365:
                    raise ValueError()
                access.expires_at = timezone.now() + timedelta(days=d)
                access.save(update_fields=['expires_at'])
            except ValueError:
                return Response({'detail': 'days must be between 1 and 365.', 'code': 'validation_error'}, status=400)
        return Response({'expires_at': access.expires_at.isoformat() if access.expires_at else None})


class CareAccessRevokeView(APIView):
    """Patient revokes doctor access immediately."""

    permission_classes = [IsPatient]

    def post(self, request, pk):
        try:
            access = CareAccess.objects.get(pk=pk, patient=request.user.patient_profile)
        except CareAccess.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        access.revoke(actor=request.user, request=request)
        return Response({'detail': 'Access revoked successfully.', 'status': access.status})


class CareAccessLogView(APIView):
    """Patient views audit logs of who viewed their medical record."""

    permission_classes = [IsPatient]

    def get(self, request):
        p = request.user.patient_profile
        logs = (AuditLog.objects
                .filter(object_type='patient', object_id=p.id)
                .select_related('user')
                .order_by('-created_at')[:50])

        return Response([{
            'id': l.id,
            'action': l.action,
            'actor_name': l.user.get_full_name() if l.user else 'System',
            'actor_email': l.user.email if l.user else '',
            'timestamp': l.created_at.isoformat(),
        } for l in logs])


class MePatientCodeView(APIView):
    """Returns the patient's own MR-XXXXXX code."""

    permission_classes = [IsPatient]

    def get(self, request):
        p = request.user.patient_profile
        return Response({
            'patient_code': p.patient_code,
            'is_claimed': p.is_claimed,
            'must_change_password': request.user.must_change_password,
            'allergies': p.allergies,
            'chronic_conditions': p.chronic_conditions,
        })


class ClaimProfileView(APIView):
    """Patient claims an existing doctor-created profile."""

    permission_classes = [AllowAny]

    def post(self, request):
        code = (request.data.get('patient_code') or '').strip().upper()
        temp_pwd = (request.data.get('temp_password') or '').strip()
        dob_raw = (request.data.get('date_of_birth') or '').strip()
        new_email = (request.data.get('email') or '').strip().lower()
        new_password = (request.data.get('new_password') or '').strip()

        if not code or not (temp_pwd or dob_raw) or not new_email or not new_password:
            return Response({'detail': 'patient_code, credentials, email and new_password are required.', 'code': 'validation_error'}, status=400)

        p = PatientProfile.objects.filter(patient_code__iexact=code).select_related('user').first()
        if p is None or p.is_claimed:
            return Response({'detail': 'Profile not found or already claimed.', 'code': 'not_found'}, status=404)

        u = p.user
        valid = False
        if temp_pwd and u.check_password(temp_pwd):
            valid = True
        elif dob_raw and p.date_of_birth and p.date_of_birth.isoformat() == dob_raw:
            valid = True

        if not valid:
            return Response({'detail': 'Incorrect verification credentials.', 'code': 'invalid_credentials'}, status=400)

        if User.objects.filter(email__iexact=new_email).exclude(pk=u.pk).exists():
            return Response({'detail': 'Email already registered.', 'code': 'email_taken'}, status=400)

        with transaction.atomic():
            u.email = new_email
            u.set_password(new_password)
            u.must_change_password = False
            u.save()

            p.is_claimed = True
            p.save(update_fields=['is_claimed'])

        record(u, 'patient.claim', 'patient', p.id, {'patient_code': p.patient_code}, request)
        login(request, u)
        return Response(UserSerializer(u).data)
