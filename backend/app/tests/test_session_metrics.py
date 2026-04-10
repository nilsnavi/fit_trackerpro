from app.application.session_metrics import build_session_insights, compute_session_metrics


def test_compute_session_metrics_handles_legacy_sets_without_rest_tracking() -> None:
    metrics = compute_session_metrics(
        [
            {
                "exercise_id": 1,
                "name": "Bench Press",
                "sets_completed": [
                    {"set_number": 1, "completed": True, "reps": 8, "weight": 80, "rpe": 7.5},
                    {"set_number": 2, "completed": True, "reps": 7, "weight": 80, "rpe": 8.5},
                ],
            }
        ],
        40,
    )

    assert metrics["completed_sets"] == 2
    assert metrics["avg_rpe"] == 8.0
    assert metrics["rest_tracked_sets"] == 0
    assert metrics["avg_rest_seconds"] is None
    assert metrics["fatigue_trend"]["delta"] == 1.0


def test_build_session_insights_returns_practical_recovery_and_rest_hints() -> None:
    metrics = compute_session_metrics(
        [
            {
                "exercise_id": 1,
                "name": "Squat",
                "sets_completed": [
                    {
                        "set_number": 1,
                        "completed": True,
                        "reps": 6,
                        "weight": 120,
                        "rpe": 7.5,
                    },
                    {
                        "set_number": 2,
                        "completed": True,
                        "reps": 5,
                        "weight": 120,
                        "rpe": 9.0,
                        "actual_rest_seconds": 95,
                    },
                    {
                        "set_number": 3,
                        "completed": True,
                        "reps": 5,
                        "weight": 120,
                        "rpe": 9.5,
                        "actual_rest_seconds": 160,
                    },
                ],
            }
        ],
        18,
    )

    insights = build_session_insights(metrics, 18)
    insight_codes = {item["code"] for item in insights}

    assert "fatigue_trend" in insight_codes
    assert "effort_distribution" in insight_codes or "recovery_hint" in insight_codes