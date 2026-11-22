from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.permissions import IsPatient
from .models import MedicalDocument, FamilyMember, MedicationReminder
from .serializers import (MedicalDocumentSerializer, FamilyMemberSerializer,
                          MedicationReminderSerializer)


class MedicalDocumentListCreateView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        docs = MedicalDocument.objects.filter(patient=request.user.patient_profile)
        doc_type = request.query_params.get('type')
        if doc_type:
            docs = docs.filter(document_type=doc_type)
        return Response(MedicalDocumentSerializer(docs, many=True).data)

    def post(self, request):
        ser = MedicalDocumentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        doc = ser.save(patient=request.user.patient_profile)
        return Response(MedicalDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class MedicalDocumentDetailView(APIView):
    permission_classes = [IsPatient]

    def delete(self, request, pk):
        try:
            doc = MedicalDocument.objects.get(pk=pk, patient=request.user.patient_profile)
            doc.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except MedicalDocument.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=status.HTTP_404_NOT_FOUND)


class FamilyMemberListCreateView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        members = FamilyMember.objects.filter(primary_patient=request.user.patient_profile)
        return Response(FamilyMemberSerializer(members, many=True).data)

    def post(self, request):
        ser = FamilyMemberSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        member = ser.save(primary_patient=request.user.patient_profile)
        return Response(FamilyMemberSerializer(member).data, status=status.HTTP_201_CREATED)


class MedicationReminderListCreateView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        reminders = MedicationReminder.objects.filter(patient=request.user.patient_profile)
        return Response(MedicationReminderSerializer(reminders, many=True).data)

    def post(self, request):
        ser = MedicationReminderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        rem = ser.save(patient=request.user.patient_profile)
        return Response(MedicationReminderSerializer(rem).data, status=status.HTTP_201_CREATED)


class MedicationReminderToggleView(APIView):
    permission_classes = [IsPatient]

    def post(self, request, pk):
        try:
            rem = MedicationReminder.objects.get(pk=pk, patient=request.user.patient_profile)
            rem.last_taken_at = timezone.now()
            rem.save(update_fields=['last_taken_at'])
            return Response(MedicationReminderSerializer(rem).data)
        except MedicationReminder.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=status.HTTP_404_NOT_FOUND)
