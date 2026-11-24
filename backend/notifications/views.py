from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, NotificationStatus


class NotificationListView(APIView):
    def get(self, request):
        qs = request.user.notifications.all()
        unread = qs.filter(status=NotificationStatus.UNREAD, read_at__isnull=True).count()
        data = [{'id': n.id, 'type': n.notification_type, 'title': n.title,
                 'body': n.body, 'status': n.status, 'read': n.status == NotificationStatus.READ or n.read_at is not None,
                 'created_at': n.created_at.isoformat()} for n in qs[:50]]
        return Response({'unread': unread, 'notifications': data})


class NotificationReadView(APIView):
    def post(self, request, pk):
        try:
            notif = request.user.notifications.get(pk=pk)
        except Notification.DoesNotExist:
            return Response({'detail': 'Not found.', 'code': 'not_found'}, status=404)
        if notif.status == NotificationStatus.UNREAD:
            notif.mark_read(actor=request.user, request=request)
        return Response({'detail': 'ok'})


class NotificationReadAllView(APIView):
    def post(self, request):
        unread = request.user.notifications.filter(status=NotificationStatus.UNREAD)
        for notif in unread:
            notif.mark_read(actor=request.user, request=request)
        return Response({'detail': 'ok'})
