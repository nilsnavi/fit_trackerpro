"""SPEC-006 unit tests: the pure progression engine.

Covers the mandatory policy matrix (SPEC §53) and the edge-case list (§54) at
the domain level. Persistence/API behaviour is covered in
``test_spec006_progression_api.py``.
"""
from __future__ import annotations

import pytest

from app.domain.progression.engine import evaluate_progression, failure_streak
from app.domain.progression.equipment import (
    advance_weight,
    resolve_increment_step,
    snap_to_equipment,
)
from app.domain.progression.types import (
    ExerciseProgressionSettings,
    ExerciseSessionRecord,
    PolicyVersion,
    ProgressionScope,
    ReasonCode,
    RecommendationStatus,
    SetRecord,
    TimePriority,
    normalize_sets,
)
from app.schemas.enums import ProgressionPolicy


def working(reps=None, weight=None, rpe=None, rir=None, duration=None, completed=True):
    return SetRecord(
        set_type="working",
        reps=reps,
        weight=weight,
        rpe=rpe,
        rir=rir,
        duration=duration,
        completed=completed,
    )


def session(session_id=1, sets=(), *, status="completed", skipped=False, template_id=None,
            template_exercise_id=None):
    return ExerciseSessionRecord(
        session_id=session_id,
        status=status,
        skipped=skipped,
        sets=tuple(sets),
        template_id=template_id,
        template_exercise_id=template_exercise_id,
    )


def evaluate(policy, current, *, previous=(), **settings_kwargs):
    return evaluate_progression(
        policy=policy,
        current_session=current,
        previous_sessions=list(previous),
        settings=ExerciseProgressionSettings(policy=policy, **settings_kwargs),
    )


@pytest.mark.unit
class TestManualPolicy:
    def test_manual_never_recommends_a_value(self):
        result = evaluate(
            ProgressionPolicy.MANUAL,
            session(sets=[working(reps=10, weight=80)]),
        )
        assert result.status is RecommendationStatus.MANUAL
        assert result.recommended_value is None
        assert result.reason_code == ReasonCode.MANUAL_POLICY.value
        # SPEC §11: previous performance is still reported separately.
        assert result.previous_value == 80

    def test_manual_without_history_still_manual(self):
        result = evaluate(ProgressionPolicy.MANUAL, session())
        assert result.status is RecommendationStatus.MANUAL
        assert result.previous_value is None


@pytest.mark.unit
class TestLinear:
    def test_all_sets_hit_target_increases(self):
        current = session(sets=[working(reps=5, weight=100)] * 5)
        result = evaluate(ProgressionPolicy.LINEAR, current, reps_min=5, reps_max=5)
        assert result.status is RecommendationStatus.INCREASE
        assert result.recommended_value == 102.5
        assert result.previous_value == 100
        assert result.difference == 2.5
        assert result.reason_code == ReasonCode.TARGET_COMPLETED.value
        assert result.confidence == "high"

    def test_missed_reps_keep_weight(self):
        current = session(
            sets=[
                working(reps=5, weight=100),
                working(reps=5, weight=100),
                working(reps=4, weight=100),
                working(reps=4, weight=100),
            ]
        )
        result = evaluate(ProgressionPolicy.LINEAR, current, reps_min=5, reps_max=5)
        assert result.status is RecommendationStatus.KEEP
        assert result.recommended_value == 100
        assert result.reason_code == ReasonCode.TARGET_NOT_COMPLETED.value

    def test_partial_target_sets_keep_weight(self):
        current = session(sets=[working(reps=5, weight=100)] * 2)
        result = evaluate(
            ProgressionPolicy.LINEAR, current, reps_min=5, reps_max=5, sets_target=5
        )
        assert result.status is RecommendationStatus.KEEP
        assert result.reason_code == ReasonCode.TARGET_SETS_INCOMPLETE.value
        assert result.confidence == "medium"


@pytest.mark.unit
class TestDoubleProgression:
    def test_partial_range_keeps_weight(self):
        current = session(
            sets=[working(reps=10, weight=80), working(reps=10, weight=80),
                  working(reps=9, weight=80)]
        )
        result = evaluate(ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3)
        assert result.status is RecommendationStatus.KEEP
        assert result.recommended_value == 80
        assert result.reason_code == ReasonCode.TARGET_NOT_COMPLETED.value

    def test_almost_complete_range_keeps_weight(self):
        current = session(
            sets=[working(reps=12, weight=80), working(reps=12, weight=80),
                  working(reps=11, weight=80)]
        )
        result = evaluate(ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3)
        assert result.status is RecommendationStatus.KEEP
        assert result.recommended_value == 80

    def test_upper_bound_reached_increases_and_keeps_range(self):
        current = session(sets=[working(reps=12, weight=80)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.status is RecommendationStatus.INCREASE
        assert result.recommended_value == 82.5
        assert result.reason_code == ReasonCode.REP_RANGE_COMPLETED.value
        assert "8–12" in result.reason_text
        assert result.recommended_reps == 12

    def test_extra_working_set_does_not_cancel_success(self):
        current = session(
            sets=[working(reps=12, weight=80)] * 3 + [working(reps=8, weight=80)]
        )
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.status is RecommendationStatus.INCREASE
        assert result.recommended_value == 82.5

    def test_extra_set_cannot_rescue_a_failed_target(self):
        current = session(
            sets=[working(reps=12, weight=80), working(reps=12, weight=80),
                  working(reps=11, weight=80), working(reps=12, weight=80)]
        )
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.status is RecommendationStatus.KEEP


@pytest.mark.unit
class TestSetFiltering:
    def test_warmup_sets_are_ignored(self):
        current = session(
            sets=[
                SetRecord(set_type="warmup", reps=20, weight=40, completed=True),
                working(reps=12, weight=80),
                working(reps=12, weight=80),
                working(reps=12, weight=80),
            ]
        )
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.status is RecommendationStatus.INCREASE
        assert result.previous_value == 80
        assert result.recommended_value == 82.5

    def test_warmup_heavier_than_working_set_is_ignored(self):
        current = session(
            sets=[
                SetRecord(set_type="warmup", reps=12, weight=200, completed=True),
                working(reps=12, weight=80),
                working(reps=12, weight=80),
                working(reps=12, weight=80),
            ]
        )
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.previous_value == 80
        assert result.recommended_value == 82.5

    def test_dropset_never_drives_the_target(self):
        current = session(
            sets=[
                working(reps=12, weight=80),
                working(reps=12, weight=80),
                working(reps=12, weight=80),
                SetRecord(set_type="dropset", reps=20, weight=40, completed=True),
            ]
        )
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.recommended_value == 82.5
        assert result.previous_value == 80

    def test_failure_set_is_excluded_from_target_evaluation(self):
        current = session(
            sets=[
                working(reps=12, weight=80),
                working(reps=12, weight=80),
                SetRecord(set_type="failure", reps=12, weight=80, completed=True),
            ]
        )
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=2, increment=2.5
        )
        assert result.status is RecommendationStatus.INCREASE

    def test_uncompleted_sets_are_ignored(self):
        current = session(
            sets=[
                working(reps=12, weight=80),
                working(reps=12, weight=80),
                working(reps=12, weight=80, completed=False),
            ]
        )
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.status is RecommendationStatus.KEEP
        assert result.reason_code == ReasonCode.TARGET_SETS_INCOMPLETE.value

    def test_warmup_only_session_has_no_data(self):
        current = session(
            sets=[SetRecord(set_type="warmup", reps=10, weight=40, completed=True)]
        )
        result = evaluate(ProgressionPolicy.DOUBLE_PROGRESSION, current)
        assert result.status is RecommendationStatus.INSUFFICIENT_DATA
        assert result.reason_code == ReasonCode.NO_PREVIOUS_HISTORY.value


@pytest.mark.unit
class TestRpeBased:
    def test_rpe_at_or_below_target_increases(self):
        current = session(
            sets=[working(reps=8, weight=80, rpe=7.5), working(reps=8, weight=80, rpe=8),
                  working(reps=8, weight=80, rpe=8)]
        )
        result = evaluate(
            ProgressionPolicy.RPE_BASED, current, sets_target=3, target_rpe=8, increment=2.5
        )
        assert result.status is RecommendationStatus.INCREASE
        assert result.recommended_value == 82.5
        assert result.reason_code == ReasonCode.TARGET_RPE_MET.value
        assert result.confidence == "high"

    def test_rpe_above_target_keeps_weight(self):
        current = session(
            sets=[working(reps=8, weight=80, rpe=8), working(reps=8, weight=80, rpe=8.5),
                  working(reps=8, weight=80, rpe=9)]
        )
        result = evaluate(
            ProgressionPolicy.RPE_BASED, current, sets_target=3, target_rpe=8, increment=2.5
        )
        assert result.status is RecommendationStatus.KEEP
        assert result.recommended_value == 80
        assert result.reason_code == ReasonCode.TARGET_RPE_EXCEEDED.value

    def test_missing_rpe_is_never_guessed(self):
        current = session(sets=[working(reps=8, weight=80)] * 3)
        result = evaluate(
            ProgressionPolicy.RPE_BASED, current, sets_target=3, target_rpe=8
        )
        assert result.status is RecommendationStatus.INSUFFICIENT_DATA
        assert result.recommended_value is None
        assert result.reason_code == ReasonCode.INSUFFICIENT_RPE_DATA.value
        assert result.confidence == "low"

    def test_partially_missing_rpe_is_insufficient(self):
        current = session(
            sets=[working(reps=8, weight=80, rpe=7), working(reps=8, weight=80, rpe=7),
                  working(reps=8, weight=80)]
        )
        result = evaluate(
            ProgressionPolicy.RPE_BASED, current, sets_target=3, target_rpe=8
        )
        assert result.status is RecommendationStatus.INSUFFICIENT_DATA
        assert result.reason_code == ReasonCode.INSUFFICIENT_RPE_DATA.value


@pytest.mark.unit
class TestRirBased:
    def test_rir_at_or_above_target_increases(self):
        current = session(
            sets=[working(reps=8, weight=80, rir=3), working(reps=8, weight=80, rir=2),
                  working(reps=8, weight=80, rir=2)]
        )
        result = evaluate(
            ProgressionPolicy.RIR_BASED, current, sets_target=3, target_rir=2, increment=2.5
        )
        assert result.status is RecommendationStatus.INCREASE
        assert result.recommended_value == 82.5
        assert result.reason_code == ReasonCode.TARGET_RIR_MET.value

    def test_rir_below_target_keeps_weight(self):
        current = session(
            sets=[working(reps=8, weight=80, rir=1), working(reps=8, weight=80, rir=0),
                  working(reps=7, weight=80, rir=0)]
        )
        result = evaluate(
            ProgressionPolicy.RIR_BASED, current, sets_target=3, target_rir=2, increment=2.5
        )
        assert result.status is RecommendationStatus.KEEP
        assert result.recommended_value == 80
        assert result.reason_code == ReasonCode.TARGET_RIR_EXCEEDED.value

    def test_missing_rir_is_never_guessed(self):
        current = session(sets=[working(reps=8, weight=80)] * 3)
        result = evaluate(ProgressionPolicy.RIR_BASED, current, sets_target=3, target_rir=2)
        assert result.status is RecommendationStatus.INSUFFICIENT_DATA
        assert result.reason_code == ReasonCode.INSUFFICIENT_RIR_DATA.value


@pytest.mark.unit
class TestE1rmAndPercent:
    def test_percent_1rm_target(self):
        current = session(sets=[working(reps=5, weight=100)] * 3)
        # e1RM(100x5) = 116.67; 75% = 87.5 (nearest 2.5 step). The target is
        # below the last working weight, so the status reports a decrease.
        result = evaluate(
            ProgressionPolicy.PERCENT_1RM, current, percent_1rm=75, sets_target=3
        )
        assert result.status is RecommendationStatus.DECREASE
        assert result.recommended_value == 87.5
        assert result.previous_value == 100
        assert result.reason_code == ReasonCode.TARGET_COMPLETED.value

    def test_percent_1rm_above_last_weight_increases(self):
        current = session(sets=[working(reps=3, weight=90)] * 3)
        # e1RM(90x3) = 99 -> 95% = 94.05 -> 95 kg
        result = evaluate(
            ProgressionPolicy.PERCENT_1RM, current, percent_1rm=95, sets_target=3
        )
        assert result.status is RecommendationStatus.INCREASE
        assert result.recommended_value == 95

    def test_percent_1rm_uses_best_set(self):
        current = session(
            sets=[working(reps=3, weight=100), working(reps=5, weight=110),
                  working(reps=5, weight=100)]
        )
        result = evaluate(
            ProgressionPolicy.PERCENT_1RM, current, percent_1rm=80, sets_target=3
        )
        # best e1RM = 110 * (1 + 5/30) = 128.33 -> 80% = 102.5
        assert result.recommended_value == 102.5

    def test_percent_1rm_requires_a_valid_rep_window(self):
        current = session(sets=[working(reps=15, weight=100)] * 3)
        result = evaluate(
            ProgressionPolicy.PERCENT_1RM, current, percent_1rm=75, sets_target=3
        )
        assert result.status is RecommendationStatus.INSUFFICIENT_DATA
        assert result.reason_code == ReasonCode.NO_PREVIOUS_HISTORY.value

    def test_e1rm_window_is_configurable(self):
        current = session(sets=[working(reps=15, weight=100)] * 3)
        result = evaluate(
            ProgressionPolicy.PERCENT_1RM,
            current,
            percent_1rm=75,
            sets_target=3,
            e1rm_max_reps=20,
        )
        # e1RM(100x15) = 150 -> 75% = 112.5
        assert result.recommended_value == 112.5


@pytest.mark.unit
class TestEquipmentAndOffset:
    def test_offset_is_preserved_on_increase(self):
        assert advance_weight(81, 2.5, 2.5) == 83.5

    def test_equipment_step_quantizes_the_delta(self):
        assert advance_weight(80, 2.5, 2.0) == 82.0
        assert advance_weight(80, 5.0, 2.5) == 85.0

    def test_snap_to_equipment_for_absolute_targets(self):
        assert snap_to_equipment(87.4, 2.5) == 87.5
        assert snap_to_equipment(89.9, 5.0) == 90.0

    def test_increment_step_resolution(self):
        assert resolve_increment_step(equipment_codes=["dumbbells"]) == 2.0
        assert resolve_increment_step(equipment_codes=["leg_press"]) == 5.0
        assert resolve_increment_step(equipment_codes=["barbell"]) == 2.5
        # Never larger than the policy increment.
        assert resolve_increment_step(
            equipment_codes=["dumbbells"], policy_increment=1.0
        ) == 1.0
        assert resolve_increment_step(explicit_step=0.5) == 0.5
        assert resolve_increment_step(equipment_codes=["unknown_gear"]) == 2.5

    def test_dumbbell_policy_uses_two_kg_step_end_to_end(self):
        current = session(sets=[working(reps=12, weight=80)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION,
            current,
            sets_target=3,
            increment=2.5,
            increment_step=2.0,
        )
        assert result.recommended_value == 82.0


@pytest.mark.unit
class TestTimeProgression:
    def test_time_target_completed_increments_duration(self):
        current = session(sets=[working(duration=60)] * 3)
        result = evaluate(
            ProgressionPolicy.TIME_PROGRESSION,
            current,
            sets_target=3,
            time_increment_seconds=5,
            time_target_seconds=60,
        )
        assert result.status is RecommendationStatus.INCREASE
        assert result.recommended_value == 65
        assert result.recommended_duration == 65
        assert result.reason_code == ReasonCode.TIME_TARGET_COMPLETED.value

    def test_time_target_not_completed_keeps_duration(self):
        current = session(sets=[working(duration=60), working(duration=45),
                                working(duration=30)])
        result = evaluate(
            ProgressionPolicy.TIME_PROGRESSION,
            current,
            sets_target=3,
            time_increment_seconds=5,
            time_target_seconds=60,
        )
        assert result.status is RecommendationStatus.KEEP
        assert result.recommended_value == 60
        assert result.reason_code == ReasonCode.TARGET_NOT_COMPLETED_TIME.value

    def test_weight_first_priority_moves_load_not_time(self):
        current = session(
            sets=[working(duration=60, weight=20, reps=10)] * 3
        )
        result = evaluate(
            ProgressionPolicy.TIME_PROGRESSION,
            current,
            sets_target=3,
            increment=2.5,
            time_priority=TimePriority.WEIGHT_FIRST,
        )
        assert result.recommended_value == 22.5
        assert result.reason_code == ReasonCode.TARGET_COMPLETED.value


@pytest.mark.unit
class TestFailureStreakAndDeload:
    def _failed(self, session_id, weight=100):
        return session(session_id=session_id, sets=[working(reps=4, weight=weight)] * 3)

    def test_failure_streak_counts_consecutive_failures(self):
        settings = ExerciseProgressionSettings(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION, sets_target=3, reps_min=8
        )
        ordered = [self._failed(4), self._failed(3), self._failed(2),
                   session(session_id=1, sets=[working(reps=12, weight=100)] * 3)]
        assert failure_streak(ordered, settings) == 3

    def test_deload_after_threshold(self):
        current = self._failed(3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION,
            current,
            previous=[self._failed(2), self._failed(1)],
            sets_target=3,
            reps_min=8,
            reps_max=12,
            failure_threshold=3,
        )
        assert result.status is RecommendationStatus.DELOAD
        assert result.recommended_value == 90
        assert result.reason_code == ReasonCode.FAILURE_THRESHOLD_REACHED.value
        assert result.failure_streak == 3

    def test_deload_percent_is_configurable(self):
        current = self._failed(3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION,
            current,
            previous=[self._failed(2), self._failed(1)],
            sets_target=3,
            reps_min=8,
            failure_threshold=3,
            deload_percent=20,
        )
        assert result.recommended_value == 80

    def test_no_deload_before_threshold(self):
        current = self._failed(2)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION,
            current,
            previous=[self._failed(1)],
            sets_target=3,
            reps_min=8,
            failure_threshold=3,
        )
        assert result.status is not RecommendationStatus.DELOAD

    def test_success_breaks_the_failure_streak(self):
        settings = ExerciseProgressionSettings(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION, sets_target=3, reps_min=8
        )
        ordered = [
            self._failed(3),
            session(session_id=2, sets=[working(reps=8, weight=100)] * 3),
            self._failed(1),
        ]
        assert failure_streak(ordered, settings) == 1

    def test_warmup_only_sessions_break_the_streak_without_counting(self):
        settings = ExerciseProgressionSettings(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION, sets_target=3, reps_min=8
        )
        ordered = [
            self._failed(3),
            session(
                session_id=2,
                sets=[SetRecord(set_type="warmup", reps=10, weight=40, completed=True)],
            ),
            self._failed(1),
        ]
        assert failure_streak(ordered, settings) == 1

    def test_time_progression_never_deloads(self):
        current = session(sets=[working(duration=30)] * 3)
        result = evaluate(
            ProgressionPolicy.TIME_PROGRESSION,
            current,
            previous=[session(session_id=2, sets=[working(duration=30)] * 3)] * 3,
            sets_target=3,
            failure_threshold=3,
        )
        assert result.status is not RecommendationStatus.DELOAD


@pytest.mark.unit
class TestExclusionsAndHistory:
    def test_cancelled_session_is_excluded(self):
        current = session(sets=[working(reps=12, weight=80)] * 3, status="cancelled")
        result = evaluate(ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3)
        assert result.status is RecommendationStatus.INSUFFICIENT_DATA

    def test_cancelled_sessions_do_not_count_as_failures(self):
        settings = ExerciseProgressionSettings(
            policy=ProgressionPolicy.DOUBLE_PROGRESSION, sets_target=3, reps_min=8
        )
        cancelled = session(session_id=2, sets=(), status="cancelled")
        ordered = [cancelled, cancelled, cancelled]
        assert failure_streak(ordered, settings) == 0

    def test_skipped_exercise_is_excluded(self):
        current = session(
            sets=[working(reps=12, weight=80)] * 3, skipped=True
        )
        result = evaluate(ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3)
        assert result.status is RecommendationStatus.INSUFFICIENT_DATA
        assert result.reason_code == ReasonCode.NO_PREVIOUS_HISTORY.value

    def test_no_history_returns_no_invented_weight(self):
        result = evaluate(ProgressionPolicy.DOUBLE_PROGRESSION, session())
        assert result.status is RecommendationStatus.INSUFFICIENT_DATA
        assert result.recommended_value is None
        assert result.reason_code == ReasonCode.NO_PREVIOUS_HISTORY.value
        assert result.confidence == "low"

    def test_previous_session_is_used_when_current_has_no_sets(self):
        previous = session(session_id=9, sets=[working(reps=12, weight=80)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION,
            session(session_id=10),
            previous=[previous],
            sets_target=3,
            increment=2.5,
        )
        assert result.recommended_value == 82.5
        assert result.source_session_id == 9


@pytest.mark.unit
class TestNumericEdgeCases:
    def test_zero_weight_never_increases(self):
        current = session(sets=[working(reps=12, weight=0)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.status is RecommendationStatus.KEEP
        assert result.recommended_value in (None, 0)

    def test_zero_reps_do_not_complete_the_range(self):
        current = session(sets=[working(reps=0, weight=80)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.status is RecommendationStatus.KEEP
        assert result.recommended_value == 80

    def test_bounds_are_applied(self):
        current = session(sets=[working(reps=12, weight=200)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION,
            current,
            sets_target=3,
            increment=2.5,
            max_value=201,
        )
        assert result.recommended_value == 201

    def test_min_bound_is_applied_to_deload(self):
        current = session(sets=[working(reps=4, weight=100)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION,
            current,
            previous=[session(session_id=2, sets=[working(reps=4, weight=100)] * 3)] * 3,
            sets_target=3,
            reps_min=8,
            failure_threshold=3,
            min_value=95,
        )
        assert result.status is RecommendationStatus.DELOAD
        assert result.recommended_value == 95

    def test_null_reps_in_target_sets_never_increase(self):
        current = session(sets=[working(reps=None, weight=80)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, increment=2.5
        )
        assert result.status is RecommendationStatus.KEEP


@pytest.mark.unit
class TestScopePolicyVersionAndDeterminism:
    def test_scope_keys_separate_templates_and_slots(self):
        monday = ProgressionScope(
            user_id=1, exercise_id=10, template_id=100, template_exercise_id=1000
        )
        friday = ProgressionScope(
            user_id=1, exercise_id=10, template_id=100, template_exercise_id=1001
        )
        second_program = ProgressionScope(
            user_id=1, exercise_id=10, template_id=200, template_exercise_id=2000
        )
        ad_hoc = ProgressionScope(user_id=1, exercise_id=10)
        assert len({monday.key, friday.key, second_program.key, ad_hoc.key}) == 4
        assert monday.key == "u1:t100:te1000:e10"
        assert ad_hoc.key == "u1:e10"

    def test_policy_version_is_pinned_per_policy(self):
        assert PolicyVersion.for_policy(
            ProgressionPolicy.DOUBLE_PROGRESSION
        ) == PolicyVersion.DOUBLE_PROGRESSION_V1
        current = session(sets=[working(reps=12, weight=80)] * 3)
        result = evaluate(ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3)
        assert result.policy_version == "DOUBLE_PROGRESSION_V1"

    def test_explicit_policy_version_is_preserved(self):
        current = session(sets=[working(reps=12, weight=80)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION,
            current,
            sets_target=3,
            policy_version="DOUBLE_PROGRESSION_V1",
        )
        assert result.policy_version == "DOUBLE_PROGRESSION_V1"

    def test_evaluation_is_deterministic(self):
        current = session(
            sets=[working(reps=12, weight=81), working(reps=12, weight=81),
                  working(reps=11, weight=81)]
        )
        kwargs = dict(sets_target=3, increment=2.5)
        first = evaluate(ProgressionPolicy.DOUBLE_PROGRESSION, current, **kwargs)
        second = evaluate(ProgressionPolicy.DOUBLE_PROGRESSION, current, **kwargs)
        assert first == second

    def test_manual_policy_version(self):
        result = evaluate(ProgressionPolicy.MANUAL, session(sets=[working(reps=5, weight=50)]))
        assert result.policy_version == "MANUAL_V1"

    def test_disabled_policy_reports_insufficient(self):
        current = session(sets=[working(reps=12, weight=80)] * 3)
        result = evaluate(
            ProgressionPolicy.DOUBLE_PROGRESSION, current, sets_target=3, enabled=False
        )
        assert result.status is RecommendationStatus.INSUFFICIENT_DATA
        assert result.reason_code == ReasonCode.POLICY_DISABLED.value


@pytest.mark.unit
class TestNormalizeSets:
    def test_normalizes_dict_payloads(self):
        records = normalize_sets(
            [
                {"set_type": "warmup", "reps": 10, "weight": 40, "completed": True},
                {"set_type": "working", "reps": "8", "weight": "82.5", "rpe": "8.0"},
                {"reps": 8, "weight": 82.5, "completed": False},
            ]
        )
        assert records[0].set_type == "warmup"
        assert records[1].reps == 8
        assert records[1].weight == 82.5
        assert records[1].rpe == 8.0
        assert records[2].completed is False
        assert records[2].set_type == "working"

    def test_tolerates_junk_values(self):
        records = normalize_sets([{"reps": "abc", "weight": None}])
        assert records[0].reps is None
        assert records[0].weight is None

    def test_accepts_existing_records(self):
        record = working(reps=5, weight=50)
        assert normalize_sets([record])[0] is record
