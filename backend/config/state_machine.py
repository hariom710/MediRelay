"""
Base State Machine utilities for MediRelay.
Provides clean declarative transition validation, guard hooks, and uniform exceptions.
"""

from django.core.exceptions import ValidationError


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

    def transition_to(self, target_state: str, save: bool = True, update_fields: list = None):
        current_state = getattr(self, self.status_field_name)
        allowed = self.TRANSITIONS.get(current_state, [])
        if target_state not in allowed:
            raise InvalidStateTransitionError(
                model_name=self.__class__.__name__,
                current_state=current_state,
                target_state=target_state,
                allowed=allowed
            )

        setattr(self, self.status_field_name, target_state)
        if save:
            fields = update_fields or [self.status_field_name]
            if hasattr(self, 'updated_at') and 'updated_at' not in fields:
                fields.append('updated_at')
            self.save(update_fields=fields)
