import pytest

from app.bot.main import _build_stats_text


@pytest.mark.unit
def test_build_stats_text_with_real_aggregates():
    sent_text = _build_stats_text({"total_workouts": 7, "total_duration": 195})
    assert "Всего тренировок: 7" in sent_text
    assert "3 ч 15 мин" in sent_text


@pytest.mark.unit
def test_build_stats_text_handles_no_data_gracefully():
    sent_text = _build_stats_text(None)
    assert "недостаточно данных" in sent_text
