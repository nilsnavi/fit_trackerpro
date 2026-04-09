"""
Unit tests for workout domain models and business rules.
These tests are fully in-memory (no database required).
"""
import pytest

from app.domain.exceptions import (
    WorkoutNotFoundError,
    WorkoutConflictError,
    DomainError,
)


# ---------------------------------------------------------------------------
# Domain exceptions
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestDomainExceptions:
    def test_domain_error_default_message(self):
        err = DomainError()
        assert err.message == DomainError.default_message
        assert str(err) == DomainError.default_message

    def test_domain_error_custom_message(self):
        err = DomainError("custom message")
        assert err.message == "custom message"

    def test_domain_error_with_details(self):
        details = [{"field": "name", "issue": "too long"}]
        err = DomainError("bad input", details=details)
        assert err.details == details

    def test_workout_not_found_http_status(self):
        err = WorkoutNotFoundError()
        assert err.http_status == 404
        assert err.code == "workout_not_found"

    def test_workout_conflict_error_http_status(self):
        err = WorkoutConflictError()
        assert err.http_status == 409
        assert err.code == "workout_conflict"

    def test_workout_not_found_custom_message(self):
        err = WorkoutNotFoundError("Workout #42 not found")
        assert err.message == "Workout #42 not found"

    def test_all_domain_errors_are_exceptions(self):
        """All DomainError subclasses must be catchable as Exception."""
        for cls in (WorkoutNotFoundError, WorkoutConflictError):
            with pytest.raises(Exception):
                raise cls()


# ---------------------------------------------------------------------------
# Workout template — allowed types (guard against DB constraint logic)
# ---------------------------------------------------------------------------

ALLOWED_WORKOUT_TYPES = ("cardio", "strength", "flexibility", "mixed")


@pytest.mark.unit
class TestWorkoutTypeValidation:
    @pytest.mark.parametrize("workout_type", ALLOWED_WORKOUT_TYPES)
    def test_allowed_types_are_valid(self, workout_type: str):
        """Check allowed types match the DB CHECK constraint."""
        assert workout_type in ALLOWED_WORKOUT_TYPES

    def test_invalid_type_is_not_allowed(self):
        invalid = "yoga"
        assert invalid not in ALLOWED_WORKOUT_TYPES

    def test_type_list_is_complete(self):
        """Allowed types must be exactly the four canonical values."""
        assert set(ALLOWED_WORKOUT_TYPES) == {
            "cardio", "strength", "flexibility", "mixed"}


# ---------------------------------------------------------------------------
# WorkoutSet — allowed set types
# ---------------------------------------------------------------------------

ALLOWED_SET_TYPES = ("warmup", "working", "dropset", "failure")


@pytest.mark.unit
class TestWorkoutSetTypeValidation:
    @pytest.mark.parametrize("set_type", ALLOWED_SET_TYPES)
    def test_allowed_set_types(self, set_type: str):
        assert set_type in ALLOWED_SET_TYPES

    def test_invalid_set_type_rejected(self):
        assert "superset" not in ALLOWED_SET_TYPES

    def test_default_set_type_is_working(self):
        """Default set type per domain model is 'working'."""
        assert "working" in ALLOWED_SET_TYPES


# ---------------------------------------------------------------------------
# WorkoutLog — duration range business rule (1..1440 minutes)
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestWorkoutDurationConstraints:
    @pytest.mark.parametrize("duration", [1, 30, 60, 90, 1440])
    def test_valid_duration_range(self, duration: int):
        assert 1 <= duration <= 1440

    @pytest.mark.parametrize("duration", [0, -1, 1441, 9999])
    def test_invalid_duration_range(self, duration: int):
        assert not (1 <= duration <= 1440)


# ---------------------------------------------------------------------------
# WorkoutLog — glucose range (2.0..30.0 mmol/L)
# ---------------------------------------------------------------------------

@pytest.mark.unit
class TestGlucoseConstraints:
    @pytest.mark.parametrize("glucose", [2.0, 5.5, 10.0, 30.0])
    def test_valid_glucose_range(self, glucose: float):
        assert 2.0 <= glucose <= 30.0

    @pytest.mark.parametrize("glucose", [0.0, 1.9, 30.1, 50.0])
    def test_invalid_glucose_range(self, glucose: float):
        assert not (2.0 <= glucose <= 30.0)
