from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsVerifiedPharmacy
from audit.services import record

from .models import BatchStatus, InventoryItem, MedicineBatch, StockMovement
from .serializers import BatchSerializer, InventoryItemSerializer, StockMovementSerializer


class InventoryListCreateView(APIView):
    permission_classes = [IsVerifiedPharmacy]

    def get(self, request):
        qs = request.user.pharmacy_profile.inventory_items.select_related(
            'medicine').prefetch_related('batches')
        return Response(InventoryItemSerializer(qs, many=True).data)

    def post(self, request):
        medicine_id = request.data.get('medicine')
        price = request.data.get('selling_price')
        if not medicine_id or price is None:
            return Response({'detail': 'medicine and selling_price required.',
                             'code': 'validation_error'}, status=400)
        try:
            from decimal import Decimal
            price = Decimal(str(request.data.get('selling_price')))
            if price < 0:
                return Response({'detail': 'selling_price cannot be negative.', 'code': 'validation_error'}, status=400)
        except (ValueError, TypeError, ArithmeticError):
            return Response({'detail': 'selling_price must be a valid number.', 'code': 'validation_error'}, status=400)

        from catalog.models import Medicine
        if not Medicine.objects.filter(pk=medicine_id).exists():
            return Response({'detail': 'Medicine not found.', 'code': 'not_found'}, status=404)

        try:
            item = InventoryItem.objects.create(
                pharmacy=request.user.pharmacy_profile,
                medicine_id=medicine_id, selling_price=price)
        except Exception:
            return Response({'detail': 'This medicine is already in your inventory.',
                             'code': 'duplicate'}, status=400)
        record(request.user, 'inventory.add', 'inventory_item', item.id, {}, request)
        return Response(InventoryItemSerializer(item).data, status=201)


class InventoryDetailView(APIView):
    permission_classes = [IsVerifiedPharmacy]

    def get(self, request, pk):
        item = self._owned(request, pk)
        if item is None:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        return Response(InventoryItemSerializer(item).data)

    def delete(self, request, pk):
        item = self._owned(request, pk)
        if item is None:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if StockMovement.objects.filter(batch__inventory_item=item).exists():
            return Response({'detail': 'Item has stock history and cannot be deleted. '
                                       'Set selling_price to 0 or write off stock instead.',
                             'code': 'has_history'}, status=409)
        from quotations.models import QuotationItem, QuotationStatus
        from orders.models import OrderItem, FulfillmentStatus
        if QuotationItem.objects.filter(
            quotation__pharmacy=item.pharmacy,
            quotation__status__in=[QuotationStatus.DRAFT, QuotationStatus.SUBMITTED, QuotationStatus.SELECTED]
        ).filter(Q(prescription_item__medicine=item.medicine) | Q(offered_medicine=item.medicine)).exists():
            return Response({'detail': 'Item is referenced in active quotations and cannot be deleted.',
                             'code': 'referenced_in_quotation'}, status=409)
        if OrderItem.objects.filter(
            fulfillment__pharmacy=item.pharmacy,
            fulfillment__status=FulfillmentStatus.PENDING,
            medicine=item.medicine
        ).exists():
            return Response({'detail': 'Item is referenced in pending orders and cannot be deleted.',
                             'code': 'referenced_in_order'}, status=409)
        record(request.user, 'inventory.delete', 'inventory_item', item.id, {}, request)
        item.delete()
        return Response({'detail': 'deleted'})

    def _owned(self, request, pk):
        try:
            return request.user.pharmacy_profile.inventory_items.get(pk=pk)
        except InventoryItem.DoesNotExist:
            return None


class BatchCreateView(APIView):
    permission_classes = [IsVerifiedPharmacy]

    def post(self, request, item_id):
        try:
            item = request.user.pharmacy_profile.inventory_items.get(pk=item_id)
        except InventoryItem.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        fields = {k: request.data.get(k) for k in
                  ('batch_number', 'expiry_date', 'qty', 'mrp', 'purchase_price')}
        if not fields['batch_number'] or not fields['expiry_date']:
            return Response({'detail': 'batch_number and expiry_date required.',
                             'code': 'validation_error'}, status=400)
        try:
            qty = int(fields['qty'] or 0)
        except (TypeError, ValueError):
            return Response({'detail': 'qty must be an integer.',
                             'code': 'validation_error'}, status=400)
        if qty <= 0:
            return Response({'detail': 'qty must be positive.', 'code': 'validation_error'},
                            status=400)

        try:
            from datetime import date
            expiry = date.fromisoformat(str(fields['expiry_date']))
        except (ValueError, TypeError):
            return Response({'detail': 'expiry_date must be in YYYY-MM-DD format.', 'code': 'validation_error'}, status=400)
        if expiry < timezone.now().date():
            return Response({'detail': 'Expired stock cannot be added.',
                             'code': 'expired_stock'}, status=400)

        with transaction.atomic():
            batch, created = MedicineBatch.objects.update_or_create(
                inventory_item=item, batch_number=fields['batch_number'],
                defaults={'expiry_date': expiry, 'mrp': fields['mrp'] or 0,
                          'purchase_price': fields['purchase_price'] or 0})
            if not created:
                batch.qty += qty
                if batch.status != BatchStatus.ACTIVE:
                    batch.status = BatchStatus.ACTIVE
                    batch.save(update_fields=['qty', 'status'], bypass_transition_check=True)
                else:
                    batch.save(update_fields=['qty'])
            else:
                batch.qty = qty
                batch.status = BatchStatus.ACTIVE
                batch.save(update_fields=['qty', 'status'])
            StockMovement.objects.create(
                batch=batch, movement_type='in', quantity=qty,
                reason='stock entry', ref_type='manual', ref_id='',
                created_by=request.user)

        record(request.user, 'inventory.batch_add', 'batch', batch.id,
               {'qty': qty}, request)
        return Response(BatchSerializer(batch).data, status=201)


class StockAdjustmentView(APIView):
    """Adjust stock quantity with a required reason (damage, count correction, etc.)."""
    permission_classes = [IsVerifiedPharmacy]

    def post(self, request, item_id, batch_id):
        try:
            item = request.user.pharmacy_profile.inventory_items.get(pk=item_id)
        except InventoryItem.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        try:
            batch = item.batches.get(pk=batch_id)
        except MedicineBatch.DoesNotExist:
            return Response({'detail': 'Batch not found.', 'code': 'not_found'}, status=404)

        reason = str(request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': 'reason is required.', 'code': 'validation_error'}, status=400)
        note = request.data.get('note', '')
        try:
            qty = int(request.data.get('quantity', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'quantity must be an integer.', 'code': 'validation_error'}, status=400)

        if batch.qty + qty < 0:
            return Response({'detail': 'Stock cannot go negative.', 'code': 'insufficient_stock'}, status=409)

        with transaction.atomic():
            new_qty = batch.qty + qty
            batch.qty = new_qty
            batch.save(update_fields=['qty'], bypass_transition_check=True)
            if new_qty == 0 and batch.status == BatchStatus.ACTIVE:
                batch.deplete(actor=request.user, request=request, reason=reason)
            elif new_qty > 0 and batch.status == BatchStatus.DEPLETED:
                batch.reactivate(actor=request.user, request=request, reason=reason)
            StockMovement.objects.create(
                batch=batch, movement_type='adjust', quantity=qty,
                reason=reason, ref_type='manual', ref_id=note,
                created_by=request.user)
            record(request.user, 'inventory.adjust', 'batch', batch.id,
                   {'qty': qty, 'reason': reason}, request)
        return Response(BatchSerializer(batch).data)


class StockLedgerView(APIView):
    """Read-only append-only stock ledger for an inventory item."""
    permission_classes = [IsVerifiedPharmacy]

    def get(self, request, item_id):
        try:
            item = request.user.pharmacy_profile.inventory_items.get(pk=item_id)
        except InventoryItem.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        movements = (StockMovement.objects
                     .filter(batch__inventory_item=item)
                     .select_related('batch', 'created_by')
                     .order_by('-created_at')[:100])
        return Response(StockMovementSerializer(movements, many=True).data)


class ExpireBatchView(APIView):
    """Write off an expired batch."""
    permission_classes = [IsVerifiedPharmacy]

    def post(self, request, item_id, batch_id):
        try:
            item = request.user.pharmacy_profile.inventory_items.get(pk=item_id)
        except InventoryItem.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        try:
            batch = item.batches.get(pk=batch_id)
        except MedicineBatch.DoesNotExist:
            return Response({'detail': 'Batch not found.', 'code': 'not_found'}, status=404)
        if not batch.is_expired:
            return Response({'detail': 'Batch is not expired.', 'code': 'validation_error'}, status=400)
        if batch.qty <= 0:
            return Response({'detail': 'Batch already empty.', 'code': 'validation_error'}, status=400)

        qty_written_off = batch.qty
        with transaction.atomic():
            StockMovement.objects.create(
                batch=batch, movement_type='expire', quantity=-qty_written_off,
                reason='expiry write-off', ref_type='manual', ref_id='',
                created_by=request.user)
            batch.qty = 0
            batch.save(update_fields=['qty'], bypass_transition_check=True)
            batch.write_off(actor=request.user, request=request, reason='Expiry write-off')
            record(request.user, 'inventory.expire', 'batch', batch.id,
                   {'qty': qty_written_off}, request)
        return Response(BatchSerializer(batch).data)


class ExpiryAlertView(APIView):
    """Low stock + expiry alerts for the pharmacy dashboard."""

    permission_classes = [IsVerifiedPharmacy]

    def get(self, request):
        profile = request.user.pharmacy_profile
        today = timezone.now().date()
        soon = today + timezone.timedelta(days=90)
        items = profile.inventory_items.select_related('medicine').prefetch_related('batches')

        low_stock, expiring, expired = [], [], []
        for item in items:
            if item.available_qty == 0:
                low_stock.append({'id': item.id, 'medicine': item.medicine.display_name,
                                  'qty': 0})
            for b in item.batches.all():
                row = {'batch_id': b.id, 'batch_number': b.batch_number,
                       'medicine': item.medicine.display_name,
                       'expiry_date': b.expiry_date.isoformat(), 'qty': b.qty}
                if b.expiry_date < today:
                    expired.append(row)
                elif b.expiry_date <= soon:
                    expiring.append(row)
        return Response({'low_stock': low_stock, 'expiring_soon': expiring,
                         'expired': expired})
