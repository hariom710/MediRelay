path = 'backend/accounts/views.py'
with open(path, 'r', newline='') as f:
    content = f.read()

# Normalize anchor matching for CRLF
anchor = ("from .serializers import (DoctorProfileSerializer, PatientProfileSerializer,\n"
          "                          PharmacyProfileSerializer, RegisterSerializer, UserSerializer, ChangePasswordSerializer)\n")
# The file may have \r\n; replace \r\n with \n for matching then write back preserving
lines = content.split('\n')
new_lines = []
inserted = False
for line in lines:
    new_lines.append(line)
    # detect the serializers import continuation line
    if (not inserted and 'ChangePasswordSerializer)' in line
            and 'from .serializers import' in content):
        # insert prescription imports after this line
        new_lines.append('from prescriptions.models import Prescription, PrescriptionStatus, PrescriptionShare')
        new_lines.append('from prescriptions.serializers import PrescriptionSerializer')
        inserted = True

content = '\n'.join(new_lines)

dashboard_view = '''

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
'''
content = content.rstrip('\n') + dashboard_view + '\n'
with open(path, 'w', newline='') as f:
    f.write(content)
print("done")
