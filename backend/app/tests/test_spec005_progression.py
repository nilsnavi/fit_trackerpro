"""SPEC-005 unit tests: progression engine, PR detection, strength math."""
from __future__ import annotations

import pytest

from app.application.progression_service import (
    DELOAD_FAILED_SESSIONS,
    deload_recommendation,
    recommend,
)
from app.application.records_service import evaluate_set_records, is_working_set
from app.application.strength_math import calculate_plates, estimate_1rm
from app.domain.progression.types import ReasonCode
from app.schemas.enums import ProgressionPolicy


@pytest.mark.unit
class TestEstimated1RM:
    def test_epley_formula(self):
        # 100 x 5 -> 100 * (1 + 5/30) = 116.67
        assert estimate_1rm(100, 5) == pytest.approx(116.67, abs=0.01)

    def test_single_rep(self):
        # Epley: 120 * (1 + 1/30) = 124.0 — one rep already estimates above the weight.
        assert estimate_1rm(120, 1) == pytest.approx(124.0)

    def test_high_reps_return_none(self):
        assert estimate_1rm(50, 20) is None

    def test_zero_values_return_none(self):
        assert estimate_1rm(0, 5) is None
        assert estimate_1rm(100, 0) is None


@pytest.mark.unit
class TestPlateCalculator:
    def test_exact_combination(self):
        result = calculate_plates(target_weight=100, bar_weight=20)
        assert result["achievable"] is True
        assert result["plates_per_side"] == [25, 15]
        assert result["nearest_weight"] == 100

    def test_fractional_plates(self):
        result = calculate_plates(target_weight=107.5, bar_weight=20)
        assert result["achievable"] is True
        # (107.5 - 20) / 2 = 43.75 -> 25 + 15 + 2.5 + 1.25
        assert result["plates_per_side"] == [25, 15, 2.5, 1.25]

    def test_impossible_shows_nearest(self):
        result = calculate_plates(target_weight=81, bar_weight=20, available_plates=[25, 10, 5])
        assert result["achievable"] is False
        # 30.5 per side -> 25 + 5 = 30 -> 80 kg
        assert result["nearest_weight"] == 80

    def test_target_below_bar(self):
        result = calculate_plates(target_weight=10, bar_weight=20)
        assert result["achievable"] is False
        assert result["plates_per_side"] == []


@pytest.mark.unit
class TestProgressionEngine:
    def _exercise(self, sets: list[dict]) -> dict:
        return {"exercise_id": 1, "name": "Bench Press", "sets_completed": sets}

    def test_double_progression_increases_after_upper_bound(self):
        exercise = self._exercise(
            [
                {"set_number": 1, "weight": 80, "reps": 12, "completed": True},
                {"set_number": 2, "weight": 80, "reps": 12, "completed": True},
                {"set_number": 3, "weight": 80, "reps": 12, "completed": True},
            ]
        )
        result = recommend(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION,
            current_exercise=exercise,
        )
        assert result["recommended_value"] == 82.5
        assert result["previous_value"] == 80
        assert result["difference"] == 2.5
        assert result["reason_code"] == "REP_RANGE_COMPLETED"
        assert result["reason_text"]
        assert result["confidence"] == "high"

    def test_double_progression_keeps_weight_when_range_not_reached(self):
        exercise = self._exercise(
            [
                {"set_number": 1, "weight": 80, "reps": 10, "completed": True},
                {"set_number": 2, "weight": 80, "reps": 9, "completed": True},
                {"set_number": 3, "weight": 80, "reps": 8, "completed": True},
            ]
        )
        result = recommend(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION,
            current_exercise=exercise,
        )
        assert result["recommended_value"] == 80
        assert result["reason_code"] == ReasonCode.TARGET_NOT_COMPLETED.value

    def test_warmup_sets_do_not_drive_progression(self):
        exercise = self._exercise(
            [
                {"set_number": 1, "weight": 40, "reps": 12, "completed": True, "set_type": "warmup"},
                {"set_number": 2, "weight": 80, "reps": 8, "completed": True},
            ]
        )
        result = recommend(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION,
            current_exercise=exercise,
        )
        assert result["previous_value"] == 80
        assert result["recommended_value"] == 80
        assert result["reason_code"] == ReasonCode.TARGET_NOT_COMPLETED.value

    def test_linear_progression(self):
        exercise = self._exercise(
            [
                {"set_number": 1, "weight": 100, "reps": 5, "completed": True},
                {"set_number": 2, "weight": 100, "reps": 5, "completed": True},
            ]
        )
        result = recommend(
            policy=ProgressionPolicy.LINEAR,
            current_exercise=exercise,
            rep_range=(5, 5),
            increment=2.5,
        )
        assert result["recommended_value"] == 102.5

    def test_manual_policy_has_no_recommended_value(self):
        exercise = self._exercise([{"set_number": 1, "weight": 80, "reps": 10, "completed": True}])
        result = recommend(policy=ProgressionPolicy.MANUAL, current_exercise=exercise)
        assert result["recommended_value"] is None
        assert result["policy"] == "MANUAL"

    def test_rpe_based_increase(self):
        exercise = self._exercise(
            [
                {"set_number": 1, "weight": 80, "reps": 8, "rpe": 7, "completed": True},
                {"set_number": 2, "weight": 80, "reps": 8, "rpe": 7.5, "completed": True},
            ]
        )
        result = recommend(
            policy=ProgressionPolicy.RPE_BASED,
            current_exercise=exercise,
            target_rpe=8,
        )
        assert result["recommended_value"] == 82.5
        assert result["reason_code"] == ReasonCode.TARGET_RPE_MET.value

    def test_rpe_above_target_keeps_weight(self):
        """SPEC-006 §16/§17 supersedes the old "-10% on high RPE" preview."""
        exercise = self._exercise(
            [
                {"set_number": 1, "weight": 80, "reps": 8, "rpe": 8, "completed": True},
                {"set_number": 2, "weight": 80, "reps": 8, "rpe": 8.5, "completed": True},
                {"set_number": 3, "weight": 80, "reps": 8, "rpe": 9, "completed": True},
            ]
        )
        result = recommend(
            policy=ProgressionPolicy.RPE_BASED,
            current_exercise=exercise,
            target_rpe=8,
        )
        assert result["reason_code"] == ReasonCode.TARGET_RPE_EXCEEDED.value
        assert result["recommended_value"] == 80

    def test_rir_based_increase(self):
        exercise = self._exercise(
            [
                {"set_number": 1, "weight": 80, "reps": 8, "rir": 3, "completed": True},
                {"set_number": 2, "weight": 80, "reps": 8, "rir": 2, "completed": True},
                {"set_number": 3, "weight": 80, "reps": 8, "rir": 2, "completed": True},
            ]
        )
        result = recommend(
            policy=ProgressionPolicy.RIR_BASED,
            current_exercise=exercise,
            target_rir=2,
        )
        assert result["recommended_value"] == 82.5
        assert result["reason_code"] == ReasonCode.TARGET_RIR_MET.value

    def test_percent_1rm(self):
        exercise = self._exercise(
            [{"set_number": 1, "weight": 100, "reps": 1, "completed": True}]
        )
        result = recommend(
            policy=ProgressionPolicy.PERCENT_1RM,
            current_exercise=exercise,
            percent_1rm=75,
        )
        # e1RM(100x1) = 100 * (1 + 1/30) = 103.33 -> 75% = 77.5 (exact 2.5 step)
        assert result["recommended_value"] == 77.5
        assert result["reason_code"] == ReasonCode.TARGET_COMPLETED.value

    def test_time_progression(self):
        exercise = self._exercise(
            [{"set_number": 1, "duration": 60, "completed": True}]
        )
        result = recommend(
            policy=ProgressionPolicy.TIME_PROGRESSION,
            current_exercise=exercise,
            time_increment_seconds=5,
        )
        assert result["recommended_value"] == 65
        assert result["reason_code"] == ReasonCode.TIME_TARGET_COMPLETED.value

    def test_no_history(self):
        result = recommend(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION,
            current_exercise={"exercise_id": 1, "name": "X", "sets_completed": []},
        )
        assert result["recommended_value"] is None
        assert result["reason_code"] == ReasonCode.NO_PREVIOUS_HISTORY.value

    def test_deload_after_three_failures(self):
        history = [
            {"session_id": 3, "completed": False, "sets_completed": []},
            {"session_id": 2, "completed": False, "sets_completed": []},
            {"session_id": 1, "completed": False, "sets_completed": []},
        ]
        result = deload_recommendation(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION,
            current_weight=100,
            history=history,
        )
        assert result is not None
        assert result["reason_code"] == ReasonCode.FAILURE_THRESHOLD_REACHED.value
        assert result["recommended_value"] == 90

    def test_no_deload_before_threshold(self):
        history = [{"session_id": 1, "completed": False, "sets_completed": []}]
        result = deload_recommendation(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION,
            current_weight=100,
            history=history,
        )
        assert result is None

    def test_deload_threshold_constant(self):
        assert DELOAD_FAILED_SESSIONS == 3


@pytest.mark.unit
class TestRecordsService:
    def test_warmup_never_creates_pr(self):
        assert is_working_set({"set_type": "warmup", "completed": True}) is False
        assert is_working_set({"set_type": "working", "completed": True}) is True
        assert is_working_set({"set_type": "working", "completed": False}) is False

    def test_max_weight_pr(self):
        records = evaluate_set_records(
            exercise_id=1,
            exercise_name="Bench Press",
            set_item={"set_number": 2, "weight": 100, "reps": 5, "completed": True},
            previous_bests={"MAX_WEIGHT": 95},
        )
        by_type = {r["record_type"]: r for r in records}
        assert by_type["MAX_WEIGHT"]["value"] == 100
        assert by_type["MAX_WEIGHT"]["previous_value"] == 95

    def test_no_pr_when_below_previous(self):
        records = evaluate_set_records(
            exercise_id=1,
            exercise_name="Bench Press",
            set_item={"set_number": 2, "weight": 90, "reps": 5, "completed": True},
            previous_bests={"MAX_WEIGHT": 95},
        )
        assert all(r["record_type"] != "MAX_WEIGHT" for r in records)

    def test_warmup_set_skipped(self):
        records = evaluate_set_records(
            exercise_id=1,
            exercise_name="Bench Press",
            set_item={"set_number": 1, "weight": 500, "reps": 1, "set_type": "warmup", "completed": True},
            previous_bests={"MAX_WEIGHT": 95},
        )
        assert records == []

    def test_e1rm_record(self):
        records = evaluate_set_records(
            exercise_id=1,
            exercise_name="Bench Press",
            set_item={"set_number": 1, "weight": 100, "reps": 5, "completed": True},
            previous_bests={},
        )
        by_type = {r["record_type"]: r for r in records}
        assert "ESTIMATED_1RM" in by_type
        assert by_type["ESTIMATED_1RM"]["value"] == pytest.approx(116.67, abs=0.01)
