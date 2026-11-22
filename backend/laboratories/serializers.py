from rest_framework import serializers
from .models import LaboratoryProfile, DiagnosticTest, LabBooking


class DiagnosticTestSerializer(serializers.ModelSerializer):
    laboratory_name = serializers.CharField(source='laboratory.lab_name', read_only=True)
    city = serializers.CharField(source='laboratory.city', read_only=True)
    offers_home_collection = serializers.BooleanField(source='laboratory.offers_home_collection', read_only=True)

    class Meta:
        model = DiagnosticTest
        fields = ['id', 'laboratory', 'laboratory_name', 'city', 'offers_home_collection',
                  'test_name', 'test_code', 'description', 'price', 'turnaround_hours', 'is_available']


class LabBookingSerializer(serializers.ModelSerializer):
    test_details = DiagnosticTestSerializer(source='test', read_only=True)

    class Meta:
        model = LabBooking
        fields = ['id', 'test', 'test_details', 'scheduled_date', 'scheduled_time',
                  'home_collection', 'address', 'status', 'report_file_url', 'report_summary', 'created_at']
        read_only_fields = ['id', 'status', 'report_file_url', 'report_summary', 'created_at']
