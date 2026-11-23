from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import DoctorProfile, PatientProfile, PharmacyProfile, Role, User


class RegisterSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.ALL)
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, default='')
    password = serializers.CharField(write_only=True)
    # profile fields (role-dependent, all optional at register time)
    full_name = serializers.CharField(required=False, allow_blank=True, default='')
    qualification = serializers.CharField(required=False, allow_blank=True, default='')
    registration_number = serializers.CharField(required=False, allow_blank=True, default='')
    clinic_name = serializers.CharField(required=False, allow_blank=True, default='')
    pharmacy_name = serializers.CharField(required=False, allow_blank=True, default='')
    license_number = serializers.CharField(required=False, allow_blank=True, default='')
    address = serializers.CharField(required=False, allow_blank=True, default='')
    city = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Registration could not be completed.')
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        role = attrs['role']
        if role in (Role.DOCTOR,) and not attrs.get('registration_number'):
            raise serializers.ValidationError({'registration_number': 'Required for doctors.'})
        if role == Role.PHARMACY and not attrs.get('pharmacy_name'):
            raise serializers.ValidationError({'pharmacy_name': 'Required for pharmacies.'})
        return attrs


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    verification_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'phone', 'roles', 'active_role', 'verification_status']

    def get_roles(self, obj):
        return obj.role_names

    def get_verification_status(self, obj):
        role = obj.active_role
        if role == Role.DOCTOR and hasattr(obj, 'doctor_profile'):
            return obj.doctor_profile.verification_status
        if role == Role.PHARMACY and hasattr(obj, 'pharmacy_profile'):
            return obj.pharmacy_profile.verification_status
        return 'verified' if role == Role.PATIENT else None


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class DoctorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorProfile
        fields = ['id', 'qualification', 'registration_number', 'clinic_name',
                  'verification_status', 'verification_note']
        read_only_fields = ['verification_status', 'verification_note']


class PatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = ['id', 'date_of_birth', 'gender', 'blood_group', 'allergies']


class PharmacyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PharmacyProfile
        fields = ['id', 'pharmacy_name', 'license_number', 'address', 'city',
                  'verification_status', 'verification_note']
        read_only_fields = ['verification_status', 'verification_note']
