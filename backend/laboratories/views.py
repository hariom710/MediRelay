from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from accounts.permissions import IsPatient
from .models import LaboratoryProfile, DiagnosticTest, LabBooking
from .serializers import DiagnosticTestSerializer, LabBookingSerializer


class DiagnosticTestSearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = DiagnosticTest.objects.select_related('laboratory').filter(is_available=True)
        q = request.query_params.get('q')
        if q:
            qs = qs.filter(test_name__icontains=q)
        city = request.query_params.get('city')
        if city:
            qs = qs.filter(laboratory__city__icontains=city)
        return Response(DiagnosticTestSerializer(qs[:50], many=True).data)


class LabBookingListCreateView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        bookings = LabBooking.objects.filter(patient=request.user.patient_profile).select_related('test__laboratory')
        return Response(LabBookingSerializer(bookings, many=True).data)

    def post(self, request):
        ser = LabBookingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        booking = ser.save(patient=request.user.patient_profile)
        return Response(LabBookingSerializer(booking).data, status=status.HTTP_201_CREATED)
