from rest_framework import serializers

from .models import InventoryItem, MedicineBatch, StockMovement


class BatchSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = MedicineBatch
        fields = ['id', 'batch_number', 'expiry_date', 'qty', 'mrp',
                  'purchase_price', 'is_expired']


class InventoryItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.display_name', read_only=True)
    available_qty = serializers.IntegerField(read_only=True)
    batches = BatchSerializer(many=True, read_only=True)

    class Meta:
        model = InventoryItem
        fields = ['id', 'medicine', 'medicine_name', 'selling_price',
                  'available_qty', 'batches']


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = ['id', 'batch', 'movement_type', 'quantity', 'reason',
                  'ref_type', 'ref_id', 'created_at']
