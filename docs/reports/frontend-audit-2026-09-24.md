# Аудит frontend и связи с backend — 2026-09-24

**Область:** `frontend/` (React 18 + Vite 7 + TanStack Query + Zustand, Telegram Mini App, PWA/offline-first), сравнение с маршрутами FastAPI (`backend/app/api/v1/*`).
**Коммит:** `b60e161` (`main`).

## 1. Что проверено и как

| Проверка | Команда | Результат |
|---|---|---|
| Typecheck | `tsc --noEmit` | ✅ 0 ошибок |
| Lint | `eslint . --max-warnings 0` | ✅ 0 ошибок |
| Unit/integration | `jest --ci` | ✅ 551 passed, 4 skipped (78 suites) |
| Production build | `BUNDLE_STATS=1 vite build` + `bundle:check` | ✅ бюджет бандла соблюдён |
| OpenAPI-контракт | свежий экспорт `backend/tools/export_openapi.py` vs `src/shared/api/generated/openapi.json` | ✅ совпадают полностью (пути и схемы) |
| Маршруты фронта ↔ бэка | скрипт: все вызовы `api.get/post/put/patch/delete` и прямые `fetch` сопоставлены со 166 операциями OpenAPI | см. ниже |
| Dev-режим | `vite` + `curl /health/ready` | ❌ 404 (см. P0-1) |

## 2. Связь с backend: итог

**Фронтенд подключён почти ко всему API, которое нужно для продукта.** Все основные домены работают через канонические пути `/api/v1/...`; на устаревшие алиасы (`/auth`, `/achievements`, `/challenges`, `/emergency`, срок удаления которых — 2026-06-30 — уже прошёл) фронт не ходит.

| Домен | Покрытие фронтом | Комментарий |
|---|---|---|
| Auth `/users/auth/*` | 8/8 | ОК. Логика продублирована в 3 местах (см. P2-3) |
| Users `/users/*` | 2/11 | `stats`, `export`. Нет удаления аккаунта (P0-3). `coach-access` на бэке — заглушки |
| Workouts `/workouts/*` | 22/26 | Нет `smart-rest`, `plate-calculator`, `start/from-template`, `PATCH …/exercises/{id}` — фронт считает это локально |
| Exercises `/exercises/*` | 11/11 | Модерация сделана на этапе 3 (P1-4) |
| Health `/health-metrics/*` | почти всё | Замеры тела ходят через алиас `/health/*` (P2-4); нет удаления глюкозы |
| Analytics `/analytics/*` | 15/17 | Нет `export` (используется `/users/export`) |
| Progression `/progression/*` | 14/14 | ОК |
| Achievements | 4/5 | ОК |
| Challenges | 1/7 | Этап 3: участие на бэке — заглушка, отвечает 501; блок во фронте скрыт (P1-3) |
| Emergency `/system/emergency/*` | 8/12 | Этап 3: редактирование контакта; уведомления о тренировке шлёт сервер сам, ручные `notify/workout-*` фронту не нужны (P1-2) |
| System | `/health/ready` | Через прямой `fetch`, не через API-клиент |

### Вызовы с фронта, которых НЕТ на бэке

| Вызов | Где | Статус |
|---|---|---|
| `GET /analytics` | `shared/api/domains/analyticsApi.ts` → `getDashboard` | мёртвый код, нигде не вызывается |
| `POST /workouts/{id}/complete` | `features/workouts/api/workouts.api.ts` | весь файл — мёртвый дубликат `shared/api/domains/workoutsApi.ts` |
| `PUT /workouts/{id}/session` | там же | там же |
| `POST /client/workout-sync-events` | `app/workoutSyncTelemetryBootstrap.ts` | включается `VITE_WORKOUT_SYNC_TELEMETRY_API=1` → на бэке эндпоинта нет, будет 404 |

## 3. Найденные проблемы и план

### P0 — баги, которые ломают пользовательский сценарий

1. **Dev-режим всегда показывает «Техническое обслуживание».**
   `useBackendHealth` делает `fetch('/health/ready')` на origin фронта. В `vite.config.ts` нет `server.proxy`, а `Caddyfile.dev` проксирует только точный путь `/health`, не `/health/ready` → 404 → `HealthCheckGate` показывает `MaintenanceScreen` (воспроизведено: `curl -H 'Accept: application/json' :5173/health/ready` → 404). В проде работает только благодаря `location = /health/ready` в `frontend/nginx.conf`.
   Также проверка игнорирует `API_URL`: если API на другом домене, проверяется не тот сервер.
   **Сделать:** добавить `server.proxy` для `/api` и `/health` в Vite (и сменить дефолт `VITE_API_URL` на относительный `/api/v1`); в Caddy — `/health/*`; строить URL health-проверки из `getPublicApiBaseUrl()` (или ходить на `/api/v1/system/ready`).

2. **Офлайн блокирует приложение, хотя оно offline-first.**
   Если сети нет, `useBackendHealth` падает с ошибкой → `HealthCheckGate` показывает экран обслуживания и размонтирует всё дерево, включая активную тренировку, очередь синхронизации и persisted-кэш. Это противоречит `docs/roadmap/offline-first` и `SyncQueueRunner`.
   **Сделать:** при `navigator.onLine === false` / сетевой ошибке не блокировать UI (показывать `OfflineBanner`); maintenance-экран — только при явном ответе `status: not_ready` / 503; после первого успешного старта не размонтировать дерево.

3. **Экспорт данных в профиле падает.**
   `usersApi.exportData()` вызывает `api.get<Blob>('/users/export')` без `responseType: 'blob'`. Бэк отдаёт `application/json` → axios парсит его в объект → `URL.createObjectURL(object)` выбрасывает `TypeError`. Кроме того, в Telegram WebView `a.click()` с `download` обычно не работает.
   **Сделать:** передавать `responseType: 'blob'` (добавить параметр в `ApiService.get`); в Telegram использовать `WebApp.downloadFile` (Bot API 8.0+) или отправку файла через бота; добавить тест.

4. **Нет удаления аккаунта, хотя юридические тексты его обещают.**
   `features/legal/content.ts` ссылается на «Профиль → Удалить аккаунт», бэк поддерживает `DELETE /users/me`, но в UI этого нет. Это риск по 152-ФЗ / GDPR.
   **Сделать:** кнопка в профиле → модальное окно с подтверждением → `DELETE /users/me` → очистить authStore, кэш Query, IndexedDB и черновики → экран приветствия.

### P1 — функциональность есть на бэке, но не доведена на фронте

1. **Мёртвый и сломанный код API.** Удалить `features/workouts/api/workouts.api.ts` (неверные пути, импортов нет) и `analyticsApi.getDashboard`. Для телеметрии синхронизации: либо сделать на бэке `POST /api/v1/client/workout-sync-events`, либо убрать ветку `VITE_WORKOUT_SYNC_TELEMETRY_API`.
2. **Emergency: уведомления о начале/конце тренировки не работают.** На бэке есть `notify/workout-start|end` и флаги `notify_on_workout_start|end` у контакта, но их никто не вызывает: ни фронт, ни сервис тренировок. В форме контакта этих флагов нет, редактирования (`PUT /contact/{id}`) тоже нет.
   **Сделать:** решить, где триггер (лучше на сервере в `start`/`complete`, с идемпотентностью); добавить в UI редактирование контакта и эти переключатели; использовать `GET /settings`.
3. **Челленджи — только список.** Добавить экран/шит челленджа: `GET /{id}`, `join`, `leave`, `leaderboard`, `my/active`. Либо спрятать блок до реализации.
4. **Модерация упражнений.** Кастомные упражнения не от админа создаются со статусом `pending`, но UI для `POST /exercises/{id}/approve` нет — одобрить их можно только вручную в БД. Плюс права админа на фронте берутся из env и `localStorage` (`fittracker_admin_user_ids`) — это только косметика, бэк проверяет права сам. Лучше отдавать `is_admin` в `/users/auth/me`.
5. **Типы API пишутся вручную.** Сгенерированный `openapi.d.ts` использует только `hooks/analytics/types.ts`; всё остальное (`features/*/types`) описано руками, а `analyticsApi` возвращает `unknown`. Контракт-чек в CI ловит только изменения бэка, но не расхождение ручных типов со схемой.
   **Сделать:** постепенно перевести доменные API на `components['schemas'][...]` (или `openapi-fetch`), начав с workouts/analytics.

### P2 — техдолг и качество

1. **Дубликаты и сироты:**
   - страницы без маршрутов: `WorkoutDashboardPage`, `WorkoutEditPage`, `WorkoutProgressPage`, `AnalyticsPage` (однострочный реэкспорт);
   - дубли `features/analytics/components/{ExerciseMetrics,ExerciseSelector,ExerciseSetHistory,ExerciseProgressSkeleton}.tsx` и `…/exercise-progress/*` (файлы разошлись);
   - два `useWorkoutModeEditorStore` (`model/` и `stores/`), два `useAchievements` (`features/achievements/hooks` и `hooks/analytics`), верхнеуровневые `src/hooks/*` вне feature-структуры.
2. **Coverage-гейт пустой:** в `coverage.baseline.json` `"baseline": {}` и `minFloor` = 0, поэтому `coverage:baseline:check` ничего не проверяет (по отчёту 2026-09-18 покрытие строк ~21%). Нужно зафиксировать baseline и поднять floor для `shared/offline`, `shared/api`, auth.
3. **Auth-запросы в трёх местах:** `LoginPage` (свой `getApiBaseUrl` + `fetch`), `hooks/useTelegramAuth.ts` (`fetch`), `features/profile/api/authApi.ts` (axios). Свести в `authApi` + один хук, чтобы ошибки везде нормализовались через `AppHttpError`.
4. **Замеры тела через алиас `/health/*`,** а остальные метрики — через `/health-metrics/*`. Перевести на `/health-metrics/body-measurements`; после этого можно убрать двойной маунт роутера на бэке.
5. **Мелочи:** таймаут axios 10 с одинаковый для всего (экспорт и тяжёлая аналитика могут упираться); `console.error` на каждую ошибку API в проде; устарели `docs/reports/FRONTEND_BACKEND_API_AUDIT.md` (пишет, что water API нет) и комментарий в `client.ts` про удаление алиасов «в v1.2.0 (2026-06-30)».

## 4. Статус этапа 1 (выполнено)

| Пункт | Что сделано |
|---|---|
| P0-1 | `vite.config.ts`: `server.proxy` для `/api` и `^/health/(ready\|live)$` (цель — `VITE_DEV_BACKEND_URL`, в `docker-compose.dev.yml` → `http://backend:8000`); дефолтный `API_URL` → `/api/v1`; `Caddyfile.dev` пропускает `/health/ready`, `/health/live`; URL проверки строится из `API_URL` (`shared/config/readinessUrl.ts`) |
| P0-1+ | `public/config.js` содержал **прод-URL** `https://fittrackpro.ru/api/v1`, который перекрывает `VITE_API_URL`: локальный `npm run dev` и dev-сервер Playwright ходили в прод. Значения очищены |
| P0-1+ | Тип ответа readiness на фронте не совпадал с бэком (`ready\|not_ready` + `dependencies` вместо `ready\|degraded` + `checks`) → теперь берётся из `openapi.d.ts` |
| P0-2 | `useBackendHealth` различает `ready / not_ready / offline / unreachable / unknown`, таймаут 5 с, перепроверка по `online` и возврату во вкладку, опрос 30 с после готовности. `HealthCheckGate`: экран обслуживания только при явном отказе бэка **до** старта; позже — неблокирующий баннер, дерево не размонтируется. Экран обслуживания переведён на русский |
| P0-3 | `api.get(..., { responseType: 'blob', timeout })`; `shared/lib/saveBlobAsFile.ts` (share sheet в Telegram iOS/Android, иначе `<a download>` с отложенным `revokeObjectURL`); тост об успехе/ошибке и спиннер на кнопке |
| P1-1 | Удалены `features/workouts/api/workouts.api.ts`, `analyticsApi.getDashboard`, ветка `VITE_WORKOUT_SYNC_TELEMETRY_API` |

Новые тесты: `readinessUrl`, `useBackendHealth`, `HealthCheckGate` (переписан), `saveBlobAsFile`, `usersApi.exportData`.

**Находка `/health` — исправлено:** `frontend/nginx.conf`, шлюз `nginx/nginx.conf`, `Caddyfile`/`Caddyfile.dev` и `docs/self-hosting/nginx.conf` отдавали точный путь `/health` бэкенду, хотя это SPA-маршрут экрана «Здоровье»: прямой заход или перезагрузка без service worker показывали JSON. Проксирование `/health` убрано; мониторинг переведён на `GET /api/v1/system/health` (healthcheck шлюза в `docker-compose.prod.yml`, `deploy-environment.yml`, `rollback-production.yml`, runbook'и). В пост-деплой смоук добавлена проверка, что `GET /health` отдаёт `index.html`. Алиас `GET /health` на самом бэкенде (`:8000`) оставлен для внутренних проб.

## 4a. Статус этапа 2 (выполнено)

| Что | Как сделано |
|---|---|
| Кнопка удаления | Профиль → «Удалить аккаунт» (под «Выйти») → модалка: что удалится навсегда, предупреждение о неотправленных изменениях из очереди синхронизации, кнопка «Сначала скачать мои данные», подтверждение вводом слова `УДАЛИТЬ` (без учёта регистра). Без сети кнопка неактивна, ошибка сервера показывается в модалке, сессия при этом не сбрасывается (`features/profile/components/DeleteAccountSection.tsx`, `hooks/useDeleteAccount.ts`, `usersApi.deleteAccount` → `DELETE /users/me`) |
| Терминальное состояние | После 204 выставляется `appTerminationStore` → `app/AppRoot.tsx` размонтирует **всё** дерево (оба auth-гейта, QueryProvider, SyncQueueRunner) и показывает `AccountDeletedScreen`. Перезагрузки нет намеренно: в Telegram перезагрузка сразу вызвала бы `/users/auth/telegram` и создала бы новый аккаунт. `client.ts` в этом состоянии не делает refresh/редирект/`auth:session-expired` для запоздавших ответов |
| Очистка устройства | `shared/lib/wipeLocalUserData.ts` запускается уже после размонтирования (persist-сторы zustand и персистер React Query не успеют записать данные обратно): очередь синхронизации (`clearSyncQueue`), токены, `localStorage`, `sessionStorage`, IndexedDB `fittracker_offline` (`deleteIndexedDbKV` сначала закрывает закешированное соединение, иначе удаление блокируется), все ключи Telegram CloudStorage (таймаут 3 с). Кэш service worker не трогается — там только статика |

Новые тесты: `wipeLocalUserData`, `DeleteAccountSection`, `AppRoot`/`AccountDeletedScreen`, `usersApi.deleteAccount`, `client.terminated` (86 наборов, 592 теста).

**Попутно исправлено:** если `POST /users/auth/refresh` отвечал 401 (просроченный refresh-токен), перехватчик `client.ts` ждал собственный `refreshPromise` — все запросы зависали навсегда. Теперь 401 от auth-эндпоинтов не запускает refresh.

**Находки для backend (не исправлены, проверено тестом на API):**
- после удаления старый access-токен получает **404 «User not found»**, а не 401 (`middleware/auth.py:get_current_user`): другие открытые сессии пользователя не уходят на повторный вход, а просто видят ошибки;
- `POST /users/auth/refresh` выдаёт новые токены удалённому пользователю (проверяется только подпись, наличие пользователя — нет);
- повторное открытие Mini App после удаления создаёт новый пустой аккаунт (`_get_or_create_user`), онбординг заново спрашивает согласие — это ожидаемо, текст на экране об этом предупреждает;
- кастомные упражнения пользователя остаются с `author_user_id = NULL` (`ON DELETE SET NULL`) — названия переживают удаление аккаунта; стоит решить, удалять ли их (или неодобренные `pending`) вместе с автором.

## 4b. Статус этапа 3 (выполнено)

| Пункт | Что сделано |
|---|---|
| P1-2 уведомления о тренировке | Триггер **на сервере**. `application/workout_contact_notifier.py` планирует сообщения в `create_workout_session` (все пути старта: `/start`, сессия, старт из шаблона) и в `complete`/`cancel`, отправка — `BackgroundTasks` после коммита. Идемпотентно: повторный `/complete` (ретрай офлайн-очереди) и повторная отмена ничего не шлют. Адресаты — активные контакты с `notify_on_workout_start/end`, **подключённые к боту**. Сбой доставки только логируется и не ломает запрос тренировки. Если у контакта включён только старт, в сообщении не обещаем «сообщим, когда закончится» |
| P1-2 редактирование | `emergencyApi.updateContact` → `PUT /system/emergency/contact/{id}` (отправляются только изменённые поля, пустой username/телефон → `null`). Карандаш у контакта открывает модалку с той же формой (`EmergencyContactForm`) плюс «Контакт активен». В строке контакта видно, на что он подписан. Если контакт уже подключён, форма предупреждает: смена username не меняет получателя |
| P1-2 форма создания | Переключатели «Мне плохо» / «Начало тренировки» / «Окончание тренировки» (по умолчанию: да / нет / нет, как на бэке) |
| P1-2 дубликаты | Раньше повтор username/телефона падал с **500** (IntegrityError). Теперь **409** `emergency_contact_conflict` с русским текстом; ошибка показывается в форме, введённые данные не теряются |
| P1-4 `is_admin` | Единственный источник — backend `ADMIN_USER_IDS` (`core/permissions.py`). Поле `is_admin` есть в `/users/me` и `/users/auth/me`. Фронтовое определение админа (env `VITE_ADMIN_USER_IDS`, runtime-config, `localStorage`) удалено вместе с обвязкой деплоя (`startup.sh`, `config.template.js`, compose, self-hosting) |
| P1-4 модерация | `GET /exercises?status=pending`: админ видит всю очередь, остальные — только свои заявки (раньше очередь была видна всем). В каталоге блок `ExerciseModerationSection`: админ одобряет (`POST /{id}/approve`) или отклоняет (`DELETE`, с подтверждением); автор видит свои упражнения с бейджем «На проверке», и они больше не «пропадают» после отправки |
| P1-3 челленджи | Скрыты. Участие было фикцией: `join` отвечал «успешно» с захардкоженным `participant_count=46` и ничего не сохранял, `leave` ничего не делал, таблицы участников нет. Теперь `join`/`leave`/`leaderboard`/`my/active` честно отвечают **501** (как coach-access), блок удалён со страницы аналитики вместе с `useChallenges` и ключами кэша. Список/карточка/создание оставлены |

Тесты: backend — `test_workout_contact_notifications` (8), `test_exercise_moderation` (3), `test_challenges_honest_501` (оба префикса); весь набор — 555 passed, покрытие 78%. Frontend — `EmergencyContactsSection` (+4), `contactForm`, `ExerciseModerationSection` (6); итого 88 наборов, 606 тестов. OpenAPI и `openapi.d.ts` перегенерированы.

**Известные ограничения уведомлений о тренировке (осознанно):**
- офлайн-старт, синхронизированный позже, всё равно шлёт «начал(а) тренировку» в момент синхронизации: клиент не передаёт время старта, опоздание не распознать;
- брошенная тренировка (не завершена и не отменена) никогда не пришлёт сообщение об окончании;
- если отменить тренировку, а потом всё же завершить её, контакт получит два сообщения об окончании;
- если запрос упадёт уже после коммита, фоновые задачи Starlette не выполнятся — сообщение потеряется (очереди с ретраями нет);
- попутно замечено: `cancel` может отменить уже завершённую тренировку (так было и раньше, не менялось).

## 5. Предлагаемый порядок работ

| Этап | Задачи | Оценка |
|---|---|---|
| 1. Быстрые фиксы ✅ | P0-1 (Vite proxy + health URL), P0-2 (офлайн в HealthCheckGate), P0-3 (экспорт), P1-1 (удалить мёртвый API) | ~1 день |
| 2. Комплаенс ✅ | P0-4 (удаление аккаунта + очистка локальных данных) | ~0.5–1 день |
| 3. Доделать фичи ✅ | P1-2 (emergency workout notify + редактирование), P1-4 (модерация / `is_admin`), P1-3 (челленджи или скрыть) | 3–5 дней |
| 4. Контракт и качество | P1-5 (типы из OpenAPI), P2-2 (coverage baseline), P2-3 (auth), P2-4 (алиасы) | 3–4 дня |
| 5. Чистка | P2-1 (дубли/сироты), P2-5 | ~1 день |
