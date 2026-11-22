from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification


class NotificationListView(APIView):
    def get(self, request):
        qs = request.user.notifications.all()
        unread = qs.filter(read_at__isnull=True).count()
        data = [{'id': n.id, 'type': n.notification_type, 'title': n.title,
                 'body': n.body, 'read': n.read_at is not None,
                 'created_at': n.created_at.isoformat()} for n in qs[:50]]
        return Response({'unread': unread, 'notifications': data})


class NotificationReadView(APIView):
    def post(self, request, pk):
        count = request.user.notifications.filter(pk=pk, read_at__isnull=True) \
            .update(read_at=timezone.now())
        if not count:
            # already read or not yours — idempotent either way
            if not request.user.notifications.filter(pk=pk).exists():
                return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        return Response({'detail': 'ok'})


class NotificationReadAllView(APIView):
    def post(self, request):
        request.user.notifications.filter(read_at__isnull=True) \
            .update(read_at=timezone.now())
        return Response({'detail': 'ok'})
