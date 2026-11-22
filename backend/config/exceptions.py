"""Uniform error shape: {"detail": str, "code": str} for every API error."""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoPermissionDenied):
        return Response({'detail': 'You do not have permission to perform this action.',
                         'code': 'permission_denied'},
                        status=status.HTTP_403_FORBIDDEN)
    if isinstance(exc, Http404):
        return Response({'detail': 'Not found.', 'code': 'not_found'},
                        status=status.HTTP_404_NOT_FOUND)

    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(response.data, dict) and 'detail' in response.data and len(response.data) == 1:
        code = getattr(exc, 'default_code', 'error')
        response.data = {'detail': response.data['detail'], 'code': code}
    elif isinstance(response.data, dict):
        # field errors: {"field": ["msg"]} -> keep detail shape with first error
        first_key = next(iter(response.data))
        msgs = response.data[first_key]
        detail = msgs[0] if isinstance(msgs, list) and msgs else str(msgs)
        response.data = {'detail': f'{first_key}: {detail}' if first_key != 'detail' else detail,
                         'code': getattr(exc, 'default_code', 'validation_error')}
    return response
