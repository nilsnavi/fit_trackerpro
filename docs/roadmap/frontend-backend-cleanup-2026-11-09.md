# Чистка фронт↔бэкенд (2026-11-09)

**Приоритет:** P2 · **Тип:** frontend/backend hygiene
**Статус:** ✅ выполнено (2026-11-09)
**Источник:** аудит связки фронтенд↔бэкенд 2026-11-09

## Что сделано

1. **Убран мёртвый `authApi.refreshToken()`** (`frontend/src/features/profile/api/authApi.ts`).
   Метод слал `POST /users/auth/refresh` без тела (`refresh_token`), т.е. был нерабочим,
   и нигде не вызывался. Реальный refresh живёт в перехватчике `shared/api/client.ts`
   (шлёт `{ refresh_token }`).

2. **Восстановлена связка logout фронт→бэк.** `ProfilePage.handleLogout` только чистил
   локальный `authStore` и редиректил — серверный `POST /users/auth/logout` не вызывался,
   поэтому в аудите не было события `AUTH_LOGOUT`. Теперь выход делает best-effort вызов
   `authApi.logout()` (с ограничением ожидания 2 c и `catch`), затем чистит стор и редиректит.
   Сам метод `authApi.logout()` сохранён и теперь используется.

## Что проверено и осознанно оставлено

- **`GET /users/me`, `PATCH /users/me`** (`backend/app/api/v1/users.py`) — не «дубли»: используются бэкенд-тестами (`test_users.py`, `test_auth.py`, `test_health_data_consent.py`, `test_request_logging.py`, `conftest.py`) и политикой `quality_gate` (`test_quality_gate_coverage.py`). Оставлены как поддерживаемый контракт.
- **`exercisesApi.getBySlugs()`** (`/exercises/by-slugs`) — НЕ мёртвый: используется в `features/workouts/hooks/useGoalPrograms.ts`.
- **`/users/stats` + `/users/me/stats`** — алиасы; фронт использует `/users/stats`, тесты бэка — `/users/me/stats`.
- **`auth` в трёх местах (P2-3)** — `features/profile/api/authApi.ts`, перехватчик `shared/api/client.ts`, fetch-fallback в `hooks/useTelegramAuth.ts` (нужен для тест-моков). Полная консолидация — отдельный рефактор с риском для auth-тестов; не входит в эту задачу.

## Проверка

```bash
cd frontend
npm run typecheck && npm run lint && npm run test:ci
```

Результат: ✅ typecheck, ✅ lint (max-warnings 0), ✅ 96 suites / 640 tests passed.
