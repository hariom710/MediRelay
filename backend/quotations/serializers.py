from rest_framework import serializers

from .models import Quotation, QuotationItem


class QuotationItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.SerializerMethodField()
    offered_medicine_name = serializers.SerializerMethodField()

    class Meta:
        model = QuotationItem
        fields = ['id', 'prescription_item', 'medicine_name', 'offered_medicine',
                  'offered_medicine_name', 'available', 'qty_offered', 'unit_price',
                  'batch_number', 'note']

    def get_medicine_name(self, obj):
        return obj.prescription_item.medicine.display_name

    def get_offered_medicine_name(self, obj):
        return obj.offered_medicine.display_name if obj.offered_medicine_id else None


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, read_only=True)
    pharmacy_name = serializers.CharField(source='pharmacy.pharmacy_name', read_only=True)

    class Meta:
        model = Quotation
        fields = ['id', 'prescription', 'pharmacy', 'pharmacy_name', 'share',
                  'status', 'revision', 'pickup_fee', 'total', 'valid_until',
                  'created_at', 'updated_at', 'submitted_at', 'items']
