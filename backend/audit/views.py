from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole

from .models import AuditLog
from .services import GENESIS_HASH, compute_entry_hash


class AuditLogListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = AuditLog.objects.select_related('user').all()
        for param, field in (('user', 'user_id'), ('action', 'action'),
                             ('object_type', 'object_type'), ('object_id', 'object_id')):
            if request.query_params.get(param):
                qs = qs.filter(**{field: request.query_params[param]})
        page = qs[:300]
        return Response([{
            'id': r.id,
            'user_id': r.user_id,
            'user_email': r.user.email if r.user else 'System / Unauthenticated',
            'user_name': r.user.get_full_name() or r.user.first_name or '' if r.user else '',
            'role': r.role,
            'action': r.action,
            'object_type': r.object_type,
            'object_id': r.object_id,
            'metadata': r.metadata,
            'ip_address': r.ip_address,
            'prev_hash': r.prev_hash,
            'entry_hash': r.entry_hash,
            'created_at': r.created_at.isoformat(),
        } for r in page])


class AuditLogVerifyView(APIView):
    """Cryptographically verifies the append-only SHA-256 Merkle chain."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        records = list(AuditLog.objects.order_by('id'))
        expected_prev = GENESIS_HASH
        tampered_id = None
        failure_reason = None

        for rec in records:
            if rec.prev_hash and rec.prev_hash != expected_prev:
                tampered_id = rec.id
                failure_reason = f'Broken chain link at log #{rec.id}: expected prev_hash {expected_prev[:12]}..., found {rec.prev_hash[:12]}...'
                break

            expected_hash = compute_entry_hash(
                rec.prev_hash or expected_prev,
                rec.id,
                rec.user_id,
                rec.role,
                rec.action,
                rec.object_type,
                rec.object_id,
                rec.metadata,
                rec.ip_address,
            )

            if rec.entry_hash and rec.entry_hash != expected_hash:
                tampered_id = rec.id
                failure_reason = f'Hash mismatch at log #{rec.id}: block data was altered'
                break

            expected_prev = rec.entry_hash or expected_hash

        is_valid = tampered_id is None
        return Response({
            'valid': is_valid,
            'tampered': not is_valid,
            'total_blocks': len(records),
            'genesis_hash': GENESIS_HASH,
            'latest_hash': expected_prev if records else GENESIS_HASH,
            'verified_at': timezone.now().isoformat(),
            'algorithm': 'SHA-256 (Merkle Hash Chained)',
            'tampered_id': tampered_id,
            'failure_reason': failure_reason,
            'status': 'SECURE_AND_VERIFIED' if is_valid else 'COMPROMISED',
        })
