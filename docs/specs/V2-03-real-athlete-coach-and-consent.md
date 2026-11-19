# V2-03 — реальный кабинет Athlete / Coach и разрешения клиентов

## Концепция и границы

V2-03 вводит *реальные данные* из защищённых FastAPI-контрактов, не смешивая интерфейс с фиктивной статистикой. Работа делится на атомарные PR:

- **V2-03A:** Athlete dashboard (профиль из проверенной `/users/auth/me` сессии, `GET /api/v1/users/me/stats`, `GET /api/v1/workouts/history?page=1&page_size=5`). Только персональные данные текущего пользователя. Обновление, ошибки, пустые состояния, без синтетических чисел.
- **V2-03B:** Coach dashboard (профиль/подписка, фактические счётчики из разрешённых ACTIVE-связей), серверные guards Coach, отдельное состояние запросов 401/403/404, запросы без клиента при отказе.
- **V2-03C:** серверная модель grants/consent для конкретного `coach_id`, `client_id`, `scope`, `granted_at`, `revoked_at`, `version`; миграция, аудит доступа, deny-by-default. Backend подтверждает каждое чтение данных, UI не определяет права.
- **V2-03D:** полноценный кабинет клиента, управление согласиями, отзыв доступа, E2E двух тренеров и двух клиентов, Telegram staging.

## Подтверждённые источники

- `backend/app/api/v1/users.py`: `GET /users/me` + `GET /users/me/stats` (30 дней; active_days/total_workouts/current_streak/longest_streak/total_duration).
- `backend/app/api/v1/workouts.py`: `GET /workouts/history` (page/page_size, собственный пользователь, `WorkoutHistoryResponse`).
- `backend/app/api/deps/coach.py`: require_coach_feature, require_coach, require_active_coach_client.
- `backend/app/domain/coach_client.py`: ACTIVE, PAUSED, ARCHIVED, REVOKED; permissions JSON по умолчанию пуст.
- `backend/app/schemas/coach.py`: `CoachClientPermissions` пустой строгий DTO — **не подтверждает** доступ к медицинским данным.
- `backend/app/api/v1/users.py`: legacy /users/coach-access отвечает 501; нельзя использовать как grant.

## Требования безопасности

1. Обзор Athlete не использует `coach_id` или `user_id` из URL для запросов. Только серверно определённый текущий пользователь.
2. Серверный ответ workout history может включать `glucose_before/glucose_after`. В V2-03A они отбрасываются клиентским DTO по allowlist; медицинские данные не отображаются.
3. Query keys привязаны к `profile.id`; logout и смена аккаунта очищают React Query cache (V2-02B).
4. `CoachClient.status === ACTIVE` — это связь, а не consent. Запрещено читать профиль, health и monitoring другого пользователя без отдельного scope и проверки backend.
5. В V2-03C требуется server-side проверка гранта на каждый вызов, аудит, отказ 403 на отсутствии или отзыве согласия, ограничение по тренеру и клиенту, отсутствие утечек существования чужого клиента.
6. Ни один экран не содержит вымышленных результатов. Loading/error/empty всегда имеют разные состояния.
7. Production неизменён; нет массового включения Coach feature flag.

## Acceptance V2-03A

- Contract test возвращает точные user stats и корректный Bearer; возвращаемые единицы (duration) подтверждаются до release.
- History ответ проецируется в whitelist id/date/status/duration/tags, не тащит glucose и упражнения в dashboard.
- Запросы запрещены без access token; 403/невалидный JSON приводит к отказу, не к sample numbers.
- Typecheck, lint, unit, build и responsive Chromium проходят, как и существующие регрессии.
- E2E authenticated Athlete с моделируемыми user stats/history добавить до merge.
