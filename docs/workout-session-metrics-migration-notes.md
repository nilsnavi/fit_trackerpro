# Workout Session Metrics Migration Notes

## Что меняется

- В `workout_logs` добавлено nullable-поле `session_metrics` для агрегированных метрик сессии.
- В `workout_sets` добавлены nullable-поля `planned_rest_seconds` и `actual_rest_seconds`.
- API history/detail/complete теперь может возвращать `session_metrics` вместе с существующими данными тренировки.
- Analytics workout summary теперь дополняется `session_metrics` и `insights`.

## Backward Compatibility

- Миграция не требует backfill и не переписывает исторические записи.
- Все новые поля nullable, поэтому старые записи остаются валидными и читаемыми.
- Если в старой тренировке `session_metrics` отсутствует, backend вычисляет fallback на чтении из `workout_logs.exercises`.
- Если в старой тренировке нет `actual_rest_seconds`, rest insights деградируют мягко: пользователь видит `Нет данных` или частичные выводы вместо ошибки.

## Rollout Safety

- Порядок rollout: сначала миграция БД, затем backend, затем frontend.
- Даже если frontend ещё не отправляет `planned_rest_seconds` и `actual_rest_seconds`, backend продолжает принимать старый payload.
- Даже если backend ещё не успел заполнить `session_metrics`, frontend продолжает отображать базовые summary-блоки.

## Prod Rollout Checklist (коротко)

1. Alembic / БД:
  - Применить миграцию `1c2e4d6f8a9b_add_session_metrics_and_rest_tracking`.
  - Проверить наличие колонок `workout_logs.session_metrics`, `workout_sets.planned_rest_seconds`, `workout_sets.actual_rest_seconds`.
  - Проверить check constraints на неотрицательные rest-поля.

2. Backend smoke API:
  - `POST /api/v1/workouts/start` и `POST /api/v1/workouts/complete` с `rpe` и `actual_rest_seconds` в нескольких сетах.
  - Убедиться, что в ответе complete есть `session_metrics`.
  - `GET /api/v1/workouts/history/{id}` для новой и старой тренировки: обе читаются, у legacy есть fallback-метрики.
  - `GET /api/v1/analytics/workouts/{id}/summary`: возвращает `session_metrics` и `insights`.

3. Frontend UI sanity:
  - Active workout: completion set не сломан, таймер отдыха работает как раньше.
  - Workout detail: отображаются метрики и блок «Практические инсайты» без ошибок рендера.
  - Analytics / Progress: виден компактный график fatigue/rest trend (или корректный empty state).

4. Operational checks:
  - Проверить логи backend на ошибки сериализации `session_metrics`.
  - Проверить, что p95 latency по history/analytics endpoints не ухудшилась заметно после релиза.
  - Подготовить rollback: откат backend/frontend бинарей и alembic downgrade при необходимости.

## Новая модель данных

- `CompletedSet` / `WorkoutSet`:
  - `planned_rest_seconds?: int`
  - `actual_rest_seconds?: int`
  - уже существующие `rpe` и `rir` остаются основой effort/intensity логики
- `WorkoutLog`:
  - `session_metrics?: json`
  - внутри агрегаты вроде `avg_rpe`, `avg_rest_seconds`, `rest_consistency_score`, `fatigue_trend`, `effort_distribution`, `volume_per_minute`

## Что не делаем специально

- Нет обязательного backfill исторических workouts.
- Нет перегрузки active workout screen новыми обязательными контролами.
- Нет жёсткой привязки analytics к наличию rest tracking: данные остаются полезными и без него.