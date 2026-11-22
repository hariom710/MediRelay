from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole

from .models import AuditLog


class AuditLogListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = AuditLog.objects.all()
        for param, field in (('user', 'user_id'), ('action', 'action'),
                             ('object_type', 'object_type'), ('object_id', 'object_id')):
            if request.query_params.get(param):
                qs = qs.filter(**{field: request.query_params[param]})
        page = qs[:200]
        return Response([{
            'id': r.id, 'user_id': r.user_id, 'role': r.role, 'action': r.action,
            'object_type': r.object_type, 'object_id': r.object_id,
            'metadata': r.metadata, 'ip_address': r.ip_address,
            'created_at': r.created_at.isoformat(),
        } for r in page])
