from django.db.models import Q
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole

from audit.services import record

from .models import Medicine
from .serializers import MedicineSerializer


class MedicineSearchView(APIView):
    def get(self, request):
        qs = Medicine.objects.filter(is_active=True)
        q = request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(Q(generic_name__icontains=q) | Q(brand_name__icontains=q)
                           | Q(manufacturer__icontains=q))
        form = request.query_params.get('form')
        if form:
            qs = qs.filter(dosage_form=form)
        return Response(MedicineSerializer(qs[:30], many=True).data)


class MedicineDetailView(APIView):
    def get(self, request, pk):
        try:
            med = Medicine.objects.get(pk=pk, is_active=True)
        except Medicine.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        return Response(MedicineSerializer(med).data)

    def delete(self, request, pk):
        if not (request.user and request.user.is_authenticated and request.user.active_role == 'admin'):
            return Response({'detail': 'Admin role required.', 'code': 'forbidden'}, status=403)
        try:
            med = Medicine.objects.get(pk=pk)
        except Medicine.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)

        from prescriptions.models import PrescriptionItem
        from inventory.models import InventoryItem
        from quotations.models import QuotationItem
        from orders.models import OrderItem

        is_referenced = (
            PrescriptionItem.objects.filter(medicine=med).exists() or
            InventoryItem.objects.filter(medicine=med).exists() or
            QuotationItem.objects.filter(Q(prescription_item__medicine=med) | Q(offered_medicine=med)).exists() or
            OrderItem.objects.filter(medicine=med).exists()
        )
        if is_referenced:
            return Response({'detail': 'Medicine is referenced in prescriptions, inventory, quotations, or orders and cannot be deleted. Deactivate instead.',
                             'code': 'medicine_referenced'}, status=409)

        record(request.user, 'medicine.delete', 'medicine', med.id, {'name': med.display_name}, request)
        med.delete()
        return Response({'detail': 'deleted'})


class MedicineCreateView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        ser = MedicineSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        med = ser.save()
        record(request.user, 'medicine.create', 'medicine', med.id,
               {'name': med.display_name}, request)
        return Response(ser.data, status=201)
