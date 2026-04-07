"""Domain / application-level errors (no HTTP). Mapped by global FastAPI exception handlers."""

from __future__ import annotations

from typing import Any, ClassVar


class DomainError(Exception):
    """Base for domain errors; API maps ``code`` to HTTP status via ``http_status``."""

    code: ClassVar[str] = "domain_error"
    http_status: ClassVar[int] = 400
    default_message: ClassVar[str] = "Request failed"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: list[dict[str, Any]] | dict[str, Any] | None = None,
    ) -> None:
        self.message = message if message is not None else self.default_message
        self.details = details
        super().__init__(self.message)


class AuthenticationError(DomainError):
    """Invalid credentials, token, or Telegram initData."""

    code = "authentication_failed"
    http_status = 401
    default_message = "Authentication failed"


class WorkoutNotFoundError(DomainError):
    code = "workout_not_found"
    http_status = 404
    default_message = "Workout not found"


class WorkoutConflictError(DomainError):
    code = "workout_conflict"
    http_status = 409
    default_message = "Workout resource conflict"


class HealthNotFoundError(DomainError):
    code = "health_not_found"
    http_status = 404
    default_message = "Resource not found"


class AnalyticsValidationError(DomainError):
    code = "analytics_validation"
    http_status = 400
    default_message = "Invalid analytics request"


class AnalyticsNotFoundError(DomainError):
    code = "analytics_not_found"
    http_status = 404
    default_message = "Resource not found"


class AnalyticsUnavailableError(DomainError):
    code = "analytics_unavailable"
    http_status = 503
    default_message = "Analytics temporarily unavailable"


class EmergencyNotFoundError(DomainError):
    code = "emergency_not_found"
    http_status = 404
    default_message = "Emergency contact not found"


class EmergencyValidationError(DomainError):
    code = "emergency_validation"
    http_status = 400
    default_message = "Invalid emergency request"


class AchievementNotFoundError(DomainError):
    code = "achievement_not_found"
    http_status = 404
    default_message = "Achievement not found"


class ExerciseNotFoundError(DomainError):
    code = "exercise_not_found"
    http_status = 404
    default_message = "Exercise not found"


class ChallengeNotFoundError(DomainError):
    code = "challenge_not_found"
    http_status = 404
    default_message = "Challenge not found"


class ChallengeValidationError(DomainError):
    code = "challenge_validation"
    http_status = 400
    default_message = "Invalid challenge request"


class ChallengeForbiddenError(DomainError):
    code = "challenge_forbidden"
    http_status = 403
    default_message = "Forbidden"


class NotImplementedFeatureError(DomainError):
    """Feature exists in API but is not implemented yet."""

    code = "not_implemented"
    http_status = 501
    default_message = "This feature is not implemented yet"


class IdempotencyKeyInvalidError(DomainError):
    """Malformed or oversized ``Idempotency-Key`` header."""

    code = "idempotency_key_invalid"
    http_status = 400
    default_message = "Invalid Idempotency-Key"
