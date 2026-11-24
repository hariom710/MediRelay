from decimal import Decimal

from rest_framework import serializers

from catalog.models import Medicine

from .models import Prescription, PrescriptionItem, PrescriptionShare
from .services import computed_total


class PrescriptionItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.display_name', read_only=True)
    calculated_qty = serializers.SerializerMethodField()

    class Meta:
        model = PrescriptionItem
        fields = ['id', 'medicine', 'medicine_name', 'strength', 'dosage_form',
                  'qty_per_dose', 'morning', 'afternoon', 'night', 'meal_timing',
                  'duration_days', 'total_qty', 'calculated_qty', 'instructions',
                  'sort_order']

    def get_calculated_qty(self, obj):
        return str(computed_total(obj))


class ItemWriteSerializer(serializers.Serializer):
    medicine = serializers.IntegerField()
    strength = serializers.CharField(required=False, allow_blank=True, default='')
    dosage_form = serializers.CharField(required=False, allow_blank=True, default='')
    qty_per_dose = serializers.DecimalField(max_digits=8, decimal_places=2, default=1,
                                            min_value=Decimal('0.01'))
    morning = serializers.IntegerField(min_value=0, max_value=20, default=0)
    afternoon = serializers.IntegerField(min_value=0, max_value=20, default=0)
    night = serializers.IntegerField(min_value=0, max_value=20, default=0)
    meal_timing = serializers.CharField(required=False, default='after_food')
    duration_days = serializers.IntegerField(min_value=1, max_value=365, default=1)
    instructions = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_medicine(self, value):
        if not Medicine.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError('Medicine not found.')
        return value

    def validate(self, attrs):
        if attrs['morning'] + attrs['afternoon'] + attrs['night'] == 0:
            raise serializers.ValidationError(
                'At least one dose time must be set (morning/afternoon/night).')
        return attrs


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True, read_only=True)
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = ['id', 'status', 'version', 'previous_version', 'consultation_date',
                  'valid_until', 'is_expired',
                  'notes', 'revision_reason', 'signed_at', 'created_at', 'updated_at',
                  'patient', 'patient_name', 'doctor', 'doctor_name', 'items']

    def get_patient_name(self, obj):
        u = obj.patient.user
        return u.get_full_name() or u.email

    def get_doctor_name(self, obj):
        u = obj.doctor.user
        return u.get_full_name() or u.email


class PharmacyRxSerializer(serializers.ModelSerializer):
    """Fulfillment-scoped view: items + what's needed to dispense. No history,
    no contact details, no documents."""

    items = PrescriptionItemSerializer(many=True, read_only=True)
    patient_display = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()
    allergy_flag = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = ['id', 'consultation_date', 'status', 'version',
                  'patient_display', 'age', 'allergy_flag', 'items']

    def get_patient_display(self, obj):
        u = obj.patient.user
        return u.get_full_name() or 'Patient'

    def get_age(self, obj):
        dob = obj.patient.date_of_birth
        if not dob:
            return None
        from datetime import date
        today = date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    def get_allergy_flag(self, obj):
        return bool(obj.patient.allergies.strip())


class ShareSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = PrescriptionShare
        fields = ['id', 'prescription', 'pharmacy', 'status', 'is_active', 'expires_at', 'revoked_at', 'created_at']
