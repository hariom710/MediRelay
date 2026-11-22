from rest_framework import serializers

from .models import Invoice, Order, OrderFulfillment, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.display_name', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'prescription_item', 'medicine', 'medicine_name',
                  'qty', 'unit_price']


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ['id', 'invoice_number', 'payment_status', 'issued_at']


class FulfillmentSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    pharmacy_name = serializers.CharField(source='pharmacy.pharmacy_name', read_only=True)
    invoice = InvoiceSerializer(read_only=True)

    class Meta:
        model = OrderFulfillment
        fields = ['id', 'pharmacy', 'pharmacy_name', 'status', 'pickup_fee',
                  'subtotal', 'items', 'invoice']


class OrderSerializer(serializers.ModelSerializer):
    fulfillments = FulfillmentSerializer(many=True, read_only=True)
    prescription_id = serializers.IntegerField(source='prescription.id', read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'prescription_id', 'status', 'total',
                  'created_at', 'updated_at', 'fulfillments']
