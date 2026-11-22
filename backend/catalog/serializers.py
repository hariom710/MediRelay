from rest_framework import serializers

from .models import Medicine


class MedicineSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Medicine
        fields = ['id', 'generic_name', 'brand_name', 'manufacturer', 'strength',
                  'dosage_form', 'pack_size', 'pack_unit', 'is_active', 'display_name']
