from django.contrib.auth import login, logout
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.services import record

from .models import DoctorProfile, PatientProfile, PharmacyProfile, Role, User
from .permissions import IsAdminRole, IsDoctor, IsPatient, IsPharmacy
from .serializers import (DoctorProfileSerializer, PatientProfileSerializer,
                          PharmacyProfileSerializer, RegisterSerializer, UserSerializer)


class RegisterView(APIView):
    permission_classes = [AllowAny]

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

    def post(self, request):
        email = (request.data.get('email') or '').lower().strip()
        password = request.data.get('password') or ''
        user = request.user if request.user.is_authenticated else None
        from django.contrib.auth import authenticate
        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response({'detail': 'Invalid email or password.', 'code': 'invalid_credentials'},
                            status=400)
        if not user.is_active:
            return Response({'detail': 'This account is disabled.', 'code': 'account_disabled'},
                            status=403)
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


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class SwitchRoleView(APIView):
    def post(self, request):
        role = request.data.get('role')
        if role not in request.user.role_names:
            return Response({'detail': 'You do not hold that role.', 'code': 'role_not_held'},
                            status=403)
        request.user.active_role = role
        request.user.save(update_fields=['active_role'])
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
        st = request.query_params.get('status', 'pending')
        doctors = DoctorProfile.objects.filter(verification_status=st)
        pharmacies = PharmacyProfile.objects.filter(verification_status=st)
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
        try:
            profile.transition_to(target_status, save=True,
                                  update_fields=['verification_status', 'verification_note'])
        except Exception:
            return Response(
                {'detail': f'Cannot transition verification status from {profile.verification_status} to {target_status}.',
                 'code': 'invalid_transition'}, status=400)
        record(request.user, 'account.verify', profile_type, profile.id,
               {'decision': decision}, request)
        return Response({'id': profile.id, 'verification_status': profile.verification_status})
