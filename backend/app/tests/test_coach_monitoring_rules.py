from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from app.application.coach_monitoring_service import AttentionRuleEngine, MonitoringContext
from app.domain.coach_client import CoachClientStatus


def _context(*, last_completed_at=None, relationship_status=CoachClientStatus.ACTIVE, assignment=None,
             program=None, template_versions_match=None, active_workout=None, now=None):
    return MonitoringContext(
        relationship=SimpleNamespace(id=1, status=relationship_status, updated_at=datetime(2026, 1, 1, tzinfo=UTC)),
        client=SimpleNamespace(id=2, first_name="Client", username=None), assignment=assignment,
        program=program, template_versions_match=template_versions_match,
        last_completed_at=last_completed_at, active_workout=active_workout,
        last_program_activity_at=None,
        now=now or datetime(2026, 1, 10, tzinfo=UTC), no_workout_days=7,
    )


def test_no_recent_workout_uses_elapsed_utc_days_and_exact_threshold():
    rules = AttentionRuleEngine()
    assert [s.code for s in rules.evaluate(_context(last_completed_at=datetime(2026, 1, 3, tzinfo=UTC)))] == ["NO_RECENT_WORKOUT"]
    assert rules.evaluate(_context(last_completed_at=datetime(2026, 1, 3, 1, tzinfo=UTC))) == []


def test_paused_relationship_and_assignment_are_explained_notice_signals():
    assignment = SimpleNamespace(id=7, status="PAUSED", paused_at=None, updated_at=datetime(2026, 1, 2, tzinfo=UTC))
    signals = AttentionRuleEngine().evaluate(_context(
        last_completed_at=datetime(2026, 1, 9, tzinfo=UTC), relationship_status=CoachClientStatus.PAUSED,
        assignment=assignment,
    ))
    assert {signal.code for signal in signals} == {"ASSIGNMENT_PAUSED", "RELATIONSHIP_PAUSED"}
    assert all(signal.severity.value == "NOTICE" for signal in signals)


def test_blocked_program_version_and_stale_active_workout_are_separate_signals():
    assignment = SimpleNamespace(id=7, status="ACTIVE", program_version=1, start_date=None,
        created_at=datetime(2026, 1, 9, tzinfo=UTC))
    program = SimpleNamespace(version=2, updated_at=datetime(2026, 1, 5, tzinfo=UTC))
    workout = SimpleNamespace(id=10, status="active", started_at=datetime(2026, 1, 1, tzinfo=UTC), created_at=datetime(2026, 1, 1, tzinfo=UTC))
    signals = AttentionRuleEngine().evaluate(_context(
        last_completed_at=datetime(2026, 1, 9, tzinfo=UTC), assignment=assignment,
        program=program, template_versions_match=True, active_workout=workout,
    ))
    assert {signal.code for signal in signals} == {"PROGRAM_VERSION_BLOCKED", "ACTIVE_WORKOUT_STALE"}


def test_recent_completion_suppresses_no_recent_signal():
    signals = AttentionRuleEngine().evaluate(_context(last_completed_at=datetime.now(UTC) - timedelta(days=1)))
    assert "NO_RECENT_WORKOUT" not in {signal.code for signal in signals}


def test_program_activity_rule_uses_assignment_window_without_weekday_claims():
    assignment = SimpleNamespace(id=7, status="ACTIVE", start_date=None,
        created_at=datetime(2026, 1, 1, tzinfo=UTC))
    context = _context(last_completed_at=datetime(2026, 1, 9, tzinfo=UTC), assignment=assignment)
    signals = AttentionRuleEngine().evaluate(context)
    program_signal = next(signal for signal in signals if signal.code == "MISSED_PROGRAM_ACTIVITY")
    assert "дней" in program_signal.description
    context = MonitoringContext(**{**context.__dict__, "last_program_activity_at": datetime(2026, 1, 9, tzinfo=UTC)})
    assert "MISSED_PROGRAM_ACTIVITY" not in {signal.code for signal in AttentionRuleEngine().evaluate(context)}
