from django.db.models import Q
from django.contrib.auth import get_user_model
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.services import record

from .models import PatientProfile, Role
from .permissions import IsDoctor
from .serializers import PatientProfileSerializer

User = get_user_model()


class PatientListCreateView(APIView):
    """Doctor portal: search own patients, or register one with consent."""

    permission_classes = [IsDoctor]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        # a doctor's patients = ones they created + ones they prescribed to
        qs = PatientProfile.objects.filter(
            Q(created_by=request.user) |
            Q(prescriptions__doctor=request.user.doctor_profile)
        ).distinct().select_related('user')
        if q:
            qs = qs.filter(Q(user__first_name__icontains=q) |
                           Q(user__last_name__icontains=q) |
                           Q(user__email__icontains=q))
        rows = [{
            'id': p.id,
            'name': p.user.get_full_name() or p.user.email,
            'email': p.user.email,
            'date_of_birth': p.date_of_birth.isoformat() if p.date_of_birth else None,
            'allergies': p.allergies,
            'has_account': True,
        } for p in qs[:100]]
        return Response(rows)

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'detail': 'name is required.', 'code': 'validation_error'},
                            status=400)
        # v1: doctor-created patient gets a placeholder account they can claim later
        import secrets
        from django.contrib.auth import get_user_model
        User = get_user_model()
        placeholder_email = f'patient-{secrets.token_hex(6)}@medirelay.local'
        user = User.objects.create_user(
            email=placeholder_email, password=secrets.token_urlsafe(24),
            first_name=name)
        user.roles.add(Role.objects.get(name=Role.PATIENT))
        user.active_role = Role.PATIENT
        user.save()
        profile = PatientProfile.objects.create(
            user=user, created_by=request.user,
            date_of_birth=request.data.get('date_of_birth') or None,
            gender=request.data.get('gender', ''),
            allergies=request.data.get('allergies', ''))
        record(request.user, 'patient.create', 'patient', profile.id, {}, request)
        data = PatientProfileSerializer(profile).data
        data['name'] = name
        data['placeholder_email'] = placeholder_email
        return Response(data, status=201)


class PatientDetailView(APIView):
    permission_classes = [IsDoctor]

    def get(self, request, pk):
        try:
            p = PatientProfile.objects.get(pk=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        allowed = (p.created_by_id == request.user.id or
                   p.prescriptions.filter(doctor=request.user.doctor_profile).exists())
        if not allowed:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        data = PatientProfileSerializer(p).data
        data['name'] = p.user.get_full_name() or p.user.email
        return Response(data)

    def delete(self, request, pk):
        try:
            p = PatientProfile.objects.get(pk=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        allowed = (p.created_by_id == request.user.id or
                   p.prescriptions.filter(doctor=request.user.doctor_profile).exists())
        if not allowed:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if p.prescriptions.exists():
            return Response({'detail': 'Patient has prescription history and cannot be deleted.',
                             'code': 'patient_has_prescriptions'}, status=409)
        if hasattr(p, 'orders') and p.orders.exists():
            return Response({'detail': 'Patient has order history and cannot be deleted.',
                             'code': 'patient_has_orders'}, status=409)
        user = p.user
        record(request.user, 'patient.delete', 'patient', p.id, {}, request)
        p.delete()
        if user and user.email.startswith('patient-') and user.email.endswith('@medirelay.local'):
            user.delete()
        return Response({'detail': 'deleted'})

    def patch(self, request, pk):
        try:
            p = PatientProfile.objects.get(pk=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        allowed = (p.created_by_id == request.user.id or
                   p.prescriptions.filter(doctor=request.user.doctor_profile).exists())
        if not allowed:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        data = request.data
        user = p.user
        user_dirty = False
        if 'name' in data and data['name']:
            user.first_name = str(data['name']).strip()
            user_dirty = True
        if 'phone' in data:
            user.phone = data['phone'] or ''
            user_dirty = True
        if user_dirty:
            user.save()
        profile_dirty = False
        for f in ('date_of_birth', 'gender', 'blood_group', 'allergies'):
            if f in data:
                setattr(p, f, data[f] or '')
                profile_dirty = True
        if profile_dirty:
            p.save(update_fields=[f for f in ('date_of_birth', 'gender', 'blood_group',
                                              'allergies') if f in data])
        record(request.user, 'patient.update', 'patient', p.id, {}, request)
        resp = PatientProfileSerializer(p).data
        resp['name'] = user.get_full_name() or user.email
        resp['phone'] = user.phone
        return Response(resp)
