from rest_framework import serializers
from .models import MedicalDocument, FamilyMember, MedicationReminder


class MedicalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalDocument
        fields = ['id', 'title', 'document_type', 'file_url', 'file_name', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']


class FamilyMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyMember
        fields = ['id', 'full_name', 'relationship', 'date_of_birth', 'blood_group', 'allergies', 'created_at']
        read_only_fields = ['id', 'created_at']


class MedicationReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationReminder
        fields = ['id', 'medicine_name', 'dosage', 'timing', 'meal_relation', 'is_active', 'last_taken_at', 'created_at']
        read_only_fields = ['id', 'created_at']
