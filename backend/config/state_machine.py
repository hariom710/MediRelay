"""
Base State Machine utilities for MediRelay.
Provides clean declarative transition validation, guard hooks, uniform exceptions,
atomic conditional UPDATE to eliminate race conditions, and transactional audit logging.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone


class InvalidStateTransitionError(ValidationError):
    def __init__(self, model_name: str, current_state: str, target_state: str, allowed: list):
        message = (
            f"Cannot transition {model_name} from '{current_state}' to '{target_state}'. "
            f"Allowed next states: {allowed}."
        )
        super().__init__(message, code='invalid_state_transition')
        self.model_name = model_name
        self.current_state = current_state
        self.target_state = target_state
        self.allowed = allowed


class StateMachineMixin:
    """
    Mixin for models that have a state/status machine.
    Requires TRANSITIONS dict: { current_state: [allowed_next_states] }
    """
    status_field_name = 'status'
    TRANSITIONS = {}

    def can_transition_to(self, target_state: str) -> bool:
        current_state = getattr(self, self.status_field_name)
        allowed = self.TRANSITIONS.get(current_state, [])
        return target_state in allowed

    def transition_to(
        self,
        target_state: str,
        actor=None,
        reason: str = None,
        save: bool = True,
        update_fields: list = None,
        request=None
    ):
        current_state = getattr(self, self.status_field_name)
        allowed = self.TRANSITIONS.get(current_state, [])
        if target_state not in allowed:
            raise InvalidStateTransitionError(
                model_name=self.__class__.__name__,
                current_state=current_state,
                target_state=target_state,
                allowed=allowed
            )

        if not self.pk or not save:
            setattr(self, self.status_field_name, target_state)
            return

        with transaction.atomic():
            now = timezone.now()
            update_kwargs = {self.status_field_name: target_state}
            if hasattr(self, 'updated_at'):
                update_kwargs['updated_at'] = now
                self.updated_at = now

            if update_fields:
                for f in update_fields:
                    if f not in (self.status_field_name, 'updated_at'):
                        update_kwargs[f] = getattr(self, f)

            # Atomic conditional UPDATE: updates row only if current_state still matches in DB
            rows_updated = self.__class__.objects.filter(
                pk=self.pk,
                **{self.status_field_name: current_state}
            ).update(**update_kwargs)

            if rows_updated == 0:
                # Concurrent transition or status change occurred!
                db_record = self.__class__.objects.filter(pk=self.pk).values(self.status_field_name).first()
                actual_state = db_record[self.status_field_name] if db_record else 'UNKNOWN'
                raise InvalidStateTransitionError(
                    model_name=self.__class__.__name__,
                    current_state=actual_state,
                    target_state=target_state,
                    allowed=self.TRANSITIONS.get(actual_state, [])
                )

            setattr(self, self.status_field_name, target_state)

            # Transactional audit logging inside the exact same atomic block
            from audit.models import AuditLog
            ip = ''
            if request is not None:
                ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
            AuditLog.objects.create(
                user=actor if getattr(actor, 'is_authenticated', False) else None,
                role=getattr(actor, 'active_role', '') or '',
                action=f"{self.__class__.__name__.lower()}.transition",
                object_type=self.__class__.__name__.lower(),
                object_id=str(self.pk),
                metadata={
                    'from': current_state,
                    'to': target_state,
                    'when': now.isoformat(),
                    'reason': reason or ''
                },
                ip_address=ip
            )
