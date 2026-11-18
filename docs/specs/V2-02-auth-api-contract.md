# V2-02A — Athlete + Coach Auth/API Contract Foundation

**Статус:** PR A / proposed. Основа: merged V2-01 (PR #271).

## Цель

Создать в независимом `apps/pwa-v2` типизированный адаптер существующей авторизации FastAPI без копирования legacy frontend, без обработки пользовательских данных в демо-экранах и без изменения backend.

## Подтверждённые FastAPI контракты

Из `backend/app/api/v1/auth.py`, `backend/app/schemas/email_auth.py`, `backend/app/schemas/auth.py`:

| Метод | Путь | Вход | Выход |
| --- | --- | --- | --- |
| POST | `/api/v1/users/auth/email/request` | `{email}` | `{challenge_id}` |
| POST | `/api/v1/users/auth/email/verify` | `{challenge_id,code}` | `access_token,refresh_token,token_type,expires_in` |
| POST | `/api/v1/users/auth/telegram` | `{init_data}` | `AuthResponse` (token/access_token optional, refresh optional) |
| POST | `/api/v1/users/auth/refresh` | `{refresh_token}` | новые access/refresh токены |
| GET | `/api/v1/users/auth/me` | Bearer | `UserProfileResponse` |

Ограничения: email 254 символа, challenge ID 32 lowercase hex, код ровно 6 цифр. Из-за различных полей Telegram/Web token response нельзя автоматически приравнивать весь `AuthResponse` к email response.

## Безопасность

1. В этом PR никакие токены не записываются в localStorage/sessionStorage/IndexedDB. Адаптер не управляет сессией.
2. Telegram initData только в теле POST и только после получения из реального Telegram runtime; никогда не доверять `initDataUnsafe`.
3. Браузерный login не требует Telegram SDK. Никакой mock token, auto-login или фиктивной роли.
4. UI-переключатель Athlete/Coach из V2-01 — **только переключение демонстрационного интерфейса**, без права читать Coach API.
5. В следующих PR ввести memory-only session, single-flight refresh, abort-on-logout, очистку Query cache и офлайн-персиста при смене пользователя.
6. Запросы coach доступны только после проверки серверной роли, feature flag, entitlements, связи coach–client и consent; UI-guard недостаточен.
7. При cross-origin публикации требуется согласованный CORS и origin-protection. По умолчанию в v2 используем same-origin `/api/v1`.

## Acceptance PR A

- `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` успешно выполняются.
- Unit-тесты покрывают email request, OTP validation, Telegram initData payload, bearer `/me`, refresh и HTTP errors.
- Никаких изменений backend/DB/production и никакого сохранения токенов.
- Не объявлять PR A работающей авторизацией — UI login и session/auth guard отдельный PR B.

## PR B и PR C (после A)

- **B:** email OTP screen, guarded routes, session memory + single-flight refresh, logout/expiry, browser E2E 200/401/403.
- **C:** Telegram runtime adapter/initData verification, user identity linking flow, server-role Coach access, no health data without explicit consent; security review + negative E2E.

Производственный релиз блокируется до завершения обоих PR и полного QA.
