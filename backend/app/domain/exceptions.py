"""Domain / application-level errors (no HTTP). API maps these to status codes."""


class AuthenticationError(Exception):
    """Invalid credentials, token, or Telegram initData."""

    def __init__(self, message: str = "Authentication failed") -> None:
        self.message = message
        super().__init__(message)


class WorkoutNotFoundError(Exception):
    pass


class HealthNotFoundError(Exception):
    pass


class AnalyticsValidationError(Exception):
    pass


class AnalyticsNotFoundError(Exception):
    pass


class AnalyticsUnavailableError(Exception):
    pass


class EmergencyNotFoundError(Exception):
    pass


class EmergencyValidationError(Exception):
    pass


class AchievementNotFoundError(Exception):
    pass


class ExerciseNotFoundError(Exception):
    pass


class ChallengeNotFoundError(Exception):
    pass


class ChallengeValidationError(Exception):
    pass


class ChallengeForbiddenError(Exception):
    pass
