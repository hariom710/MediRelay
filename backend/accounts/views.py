from django.contrib.auth import login, logout, update_session_auth_hash
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.services import record
from config.throttles import LoginEmailThrottle, LoginThrottle, RegisterThrottle

from .models import DoctorProfile, PatientProfile, PharmacyProfile, Role, User
from .permissions import IsAdminRole, IsDoctor, IsPatient, IsPharmacy
from .serializers import (DoctorProfileSerializer, PatientProfileSerializer,
                          PharmacyProfileSerializer, RegisterSerializer, UserSerializer, ChangePasswordSerializer)
from prescriptions.models import Prescription, PrescriptionStatus, PrescriptionShare
from prescriptions.serializers import PrescriptionSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        role = d['role']
        if role == Role.ADMIN:
            return Response({'detail': 'Admin accounts are seeded, not self-registered.',
                             'code': 'registration_forbidden'}, status=400)

        with transaction.atomic():
            user = User.objects.create_user(
                email=d['email'], password=d['password'],
                phone=d.get('phone', ''),
                first_name=d.get('full_name', ''),
            )
            role_obj, _ = Role.objects.get_or_create(name=role)
            user.roles.add(role_obj)
            user.active_role = role
            user.save()

            if role == Role.DOCTOR:
                DoctorProfile.objects.get_or_create(
                    user=user, defaults={
                        'qualification': d.get('qualification', ''),
                        'registration_number': d.get('registration_number', ''),
                        'clinic_name': d.get('clinic_name', '')})
            elif role == Role.PATIENT:
                PatientProfile.objects.get_or_create(user=user)
            elif role == Role.PHARMACY:
                PharmacyProfile.objects.get_or_create(
                    user=user, defaults={
                        'pharmacy_name': d['pharmacy_name'],
                        'license_number': d.get('license_number', ''),
                        'address': d.get('address', ''), 'city': d.get('city', '')})

        record(request.user if request.user.is_authenticated else user,
               'user.register', 'user', user.id, {'role': role}, request)
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle, LoginEmailThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').lower().strip()
        password = request.data.get('password') or ''
        user = request.user if request.user.is_authenticated else None
        from django.contrib.auth import authenticate
        user = authenticate(request, email=email, password=password)
        if user is None:
            # Audit log failed login attempt without storing raw email
            import hashlib
            email_hash = hashlib.sha256(email.encode('utf-8')).hexdigest()[:16]
            parts = email.split('@')
            masked = f"{parts[0][:2]}***@{parts[1]}" if len(parts) == 2 and len(parts[0]) >= 2 else "***"
            record(None, 'user.login_failed', 'user', 0, {
                'email_hash': email_hash,
                'email_masked': masked,
            }, request)

            # Progressive delay on consecutive failed logins for this client IP/email
            from django.core.cache import cache
            ident = request.META.get('REMOTE_ADDR', '')
            fail_key = f'fail_delay_{email_hash}_{ident}'
            consec_fails = cache.get(fail_key, 0) + 1
            cache.set(fail_key, consec_fails, timeout=300)
            if consec_fails >= 3:
                import time
                delay = min(0.2 * (2 ** (consec_fails - 3)), 1.5)
                time.sleep(delay)

            return Response({'detail': 'Invalid email or password.', 'code': 'invalid_credentials'},
                            status=400)
        if not user.is_active:
            return Response({'detail': 'This account is disabled.', 'code': 'account_disabled'},
                            status=403)
        # Clear consecutive failure delay on successful authentication
        from django.core.cache import cache
        import hashlib
        email_hash = hashlib.sha256(email.encode('utf-8')).hexdigest()[:16]
        ident = request.META.get('REMOTE_ADDR', '')
        cache.delete(f'fail_delay_{email_hash}_{ident}')

        login(request, user)
        if not user.active_role:
            user.active_role = user.role_names[0] if user.role_names else ''
            user.save(update_fields=['active_role'])
        record(user, 'user.login', 'user', user.id, {}, request)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    def post(self, request):
        if request.user.is_authenticated:
            record(request.user, 'user.logout', 'user', request.user.id, {}, request)
        logout(request)
        return Response({'detail': 'Logged out.'})


class ChangePasswordView(APIView):
    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(ser.validated_data['old_password']):
            return Response({'detail': 'Current password is incorrect.',
                             'code': 'invalid_password'}, status=400)
        user.set_password(ser.validated_data['new_password'])
        user.must_change_password = False
        user.save()
        # Keep this session valid; Django invalidates all other sessions on password change.
        update_session_auth_hash(request, user)
        record(request.user, 'user.change_password', 'user', user.id, {}, request)
        return Response({'detail': 'Password changed.'})


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class SwitchRoleView(APIView):
    def post(self, request):
        role = request.data.get('role')
        if role not in request.user.role_names:
            return Response({'detail': 'You do not hold that role.', 'code': 'role_not_held'},
                            status=403)
        old_role = request.user.active_role
        # Fix (i): Cycle session key to prevent session fixation across role/privilege changes
        request.session.cycle_key()
        request.user.active_role = role
        request.user.save(update_fields=['active_role'])
        from audit.services import record
        record(request.user, 'auth.switch_role', 'user', request.user.id,
               {'old_role': old_role, 'new_role': role}, request)
        return Response(UserSerializer(request.user).data)


class DoctorProfileView(APIView):
    permission_classes = [IsDoctor]

    def get(self, request):
        return Response(DoctorProfileSerializer(request.user.doctor_profile).data)

    def put(self, request):
        ser = DoctorProfileSerializer(request.user.doctor_profile, data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class PatientProfileView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        return Response(PatientProfileSerializer(request.user.patient_profile).data)

    def put(self, request):
        ser = PatientProfileSerializer(request.user.patient_profile, data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class PharmacyProfileView(APIView):
    permission_classes = [IsPharmacy]

    def get(self, request):
        return Response(PharmacyProfileSerializer(request.user.pharmacy_profile).data)

    def put(self, request):
        ser = PharmacyProfileSerializer(request.user.pharmacy_profile, data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class VerificationQueueView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        st = request.query_params.get('status', 'all')
        if st and st != 'all':
            doctors = DoctorProfile.objects.filter(verification_status=st).select_related('user').order_by('-id')
            pharmacies = PharmacyProfile.objects.filter(verification_status=st).select_related('user').order_by('-id')
        else:
            doctors = DoctorProfile.objects.all().select_related('user').order_by('-id')
            pharmacies = PharmacyProfile.objects.all().select_related('user').order_by('-id')
        return Response({
            'doctors': DoctorProfileSerializer(doctors, many=True).data,
            'pharmacies': PharmacyProfileSerializer(pharmacies, many=True).data,
        })


class VerificationDecisionView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, profile_type, pk):
        if profile_type not in ('doctor', 'pharmacy'):
            return Response({'detail': 'profile_type must be doctor|pharmacy',
                             'code': 'invalid_profile_type'}, status=400)
        model = DoctorProfile if profile_type == 'doctor' else PharmacyProfile
        try:
            profile = model.objects.get(pk=pk)
        except model.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        decision = request.data.get('decision')
        allowed = {'approve': 'verified', 'reject': 'rejected', 'suspend': 'suspended',
                   'review': 'under_review'}
        if decision not in allowed:
            return Response({'detail': 'decision must be approve|reject|suspend|review',
                             'code': 'invalid_decision'}, status=400)

        target_status = allowed[decision]
        profile.verification_note = request.data.get('note', '')
        profile.transition_to(target_status, actor=request.user, request=request, reason=f'Admin decision: {decision}', save=True,
                              update_fields=['verification_status', 'verification_note'])
        record(request.user, 'account.verify', profile_type, profile.id,
               {'decision': decision}, request)
        return Response({'id': profile.id, 'verification_status': profile.verification_status})

class DoctorDashboardView(APIView):
    permission_classes = [IsDoctor]

    def get(self, request):
        doctor = request.user.doctor_profile
        rx_qs = Prescription.objects.filter(doctor=doctor)
        today = timezone.now().date()
        seven_days = today + timedelta(days=7)
        drafts = rx_qs.filter(status=PrescriptionStatus.DRAFT).count()
        finalized_not_shared = (rx_qs.filter(status=PrescriptionStatus.FINALIZED)
                                .exclude(shares__isnull=False).distinct().count())
        active_shares = (PrescriptionShare.objects
                         .filter(prescription__doctor=doctor, revoked_at__isnull=True,
                                 expires_at__gte=timezone.now())
                         .count())
        expiring_soon = (rx_qs.filter(status=PrescriptionStatus.FINALIZED,
                                      valid_until__lte=seven_days,
                                      valid_until__gte=today).count())
        recent_rx = PrescriptionSerializer(rx_qs.order_by('-created_at')[:5], many=True).data
        patient_ids = rx_qs.values_list('patient_id', flat=True).distinct()[:5]
        recent_patients = []
        from accounts.models import PatientProfile
        for p in PatientProfile.objects.filter(pk__in=patient_ids):
            recent_patients.append({
                'id': p.id,
                'name': p.user.get_full_name() or p.user.email,
                'allergies': p.allergies,
            })
        return Response({
            'drafts': drafts,
            'finalized_not_shared': finalized_not_shared,
            'active_shares': active_shares,
            'expiring_soon': expiring_soon,
            'recent_prescriptions': recent_rx,
            'recent_patients': recent_patients,
        })
class PharmacyDashboardView(APIView):
    permission_classes = [IsPharmacy]

    def get(self, request):
        profile = request.user.pharmacy_profile
        now = timezone.now()
        today = now.date()
        soon = today + timedelta(days=30)

        # New requests: shares not yet quoted
        from prescriptions.models import PrescriptionShare, PrescriptionStatus
        from quotations.models import Quotation, QuotationStatus
        shares = (PrescriptionShare.objects
                  .filter(revoked_at__isnull=True, expires_at__gt=now)
                  .filter(pharmacy=profile) | PrescriptionShare.objects
                  .filter(revoked_at__isnull=True, expires_at__gt=now,
                          pharmacy__isnull=True))
        shares = shares.distinct()
        from audit.models import PrescriptionAccessLog
        valid_shares = [
            s for s in shares.select_related('prescription')
            if s.prescription.status == PrescriptionStatus.FINALIZED
            and not s.prescription.is_expired
            and s.is_active
        ]
        new_requests = 0
        recent_requests = []
        for share in valid_shares:
            rx = share.prescription
            existing = Quotation.objects.filter(prescription=rx, pharmacy=profile).first()
            if existing is None:
                new_requests += 1
            if len(recent_requests) < 10:
                has_accessed = PrescriptionAccessLog.objects.filter(share=share, user=request.user).exists()
                recent_requests.append({
                    'share_id': share.id,
                    'prescription_id': rx.id,
                    'opened': has_accessed,
                    'expires_at': share.expires_at.isoformat(),
                })

        # Quotations awaiting decision (excluding expired)
        awaiting = Quotation.objects.filter(
            pharmacy=profile,
            status__in=[QuotationStatus.SUBMITTED, QuotationStatus.VIEWED],
            valid_until__gte=timezone.now()
        ).count()

        # Pending fulfillments
        from orders.models import OrderFulfillment, FulfillmentStatus
        pending_fulfillments = OrderFulfillment.objects.filter(
            pharmacy=profile,
            status__in=[FulfillmentStatus.PENDING, FulfillmentStatus.IN_PROGRESS,
                        FulfillmentStatus.READY_FOR_PICKUP]).count()

        # Low stock
        from inventory.models import InventoryItem
        low_stock = 0
        for item in profile.inventory_items.select_related('medicine').all():
            if item.available_qty < 10:
                low_stock += 1

        # Expiring in 30 days
        expiring = 0
        for item in profile.inventory_items.prefetch_related('batches').all():
            for b in item.batches:  # use prefetched cache; .all() triggers a new query
                if b.qty > 0 and b.status == 'active' and today <= b.expiry_date <= soon:
                    expiring += 1

        # Recent orders
        recent_orders = []
        for f in OrderFulfillment.objects.filter(pharmacy=profile).order_by('-created_at')[:5]:
            recent_orders.append({
                'id': f.order_id,
                'status': f.status,
                'subtotal': str(f.subtotal),
                'created_at': f.created_at.isoformat(),
            })

        return Response({
            'new_requests': new_requests,
            'quotations_awaiting': awaiting,
            'orders_to_fulfill': pending_fulfillments,
            'low_stock': low_stock,
            'expiring_soon': expiring,
            'recent_requests': recent_requests[:5],
            'recent_orders': recent_orders,
        })


