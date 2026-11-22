from django.db.models import Q
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.services import record

from .models import PatientProfile, Role
from .permissions import IsDoctor
from .serializers import PatientProfileSerializer


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
