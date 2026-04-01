# FitTracker Pro — MVP flow gap analysis (E2E)

Цель: проверить, что продукт покрывает **end-to-end MVP сценарии**, а не только набор экранов. Ниже для каждого user flow указана цепочка: **UI entry → route → FE state → API → backend service/use case → DB entities → tests**, затем разрывы и приоритетный backlog.

Дата: 2026-03-31

---

## Top user flows (MVP)

### 1) Onboarding / Auth

- **UI entry point**
  - `Navigation` ведёт в `/profile`, где используются серверные данные профиля; при отсутствии токена поведение зависит от реализации `useProfile`/API ошибок.
  - Отдельный экран: `LoginPage` — **заглушка** (явно написано “в разработке”).
- **Route**
  - `/login` (`features/auth/pages/LoginPage.tsx`)
  - косвенно: `/profile` (`features/profile/pages/ProfilePage.tsx`)
- **Frontend state/store**
  - Авторизационный токен берётся из `localStorage['auth_token']` в `shared/api/client.ts` (axios interceptor).
  - `stores/sessionStore.ts` существует, но **зарезервирован** и не является источником истины; профиль берётся через TanStack Query.
- **API endpoints**
  - FE сейчас использует legacy-эндпоинты:
    - `GET /auth/me`, `PUT /auth/me`, `POST /auth/refresh`, `POST /auth/logout` (`features/profile/api/authApi.ts`)
  - На BE канонический mount:
    - `POST /api/v1/users/auth/telegram`
    - `POST /api/v1/users/auth/refresh`
    - `GET/PUT /api/v1/users/auth/me`
    - `POST /api/v1/users/auth/logout`
  - Legacy алиас также есть:
    - `/api/v1/auth/*` (см. `registration.py`)
- **Backend services / use cases**
  - `app.application.auth_service.AuthService` (telegram auth, refresh, profile, update, logout)
- **DB entities**
  - `app.domain.user.User` (+ связанные таблицы профиля/настроек через schema/поле user, см. доменные файлы)
- **Тесты**
  - `backend/app/tests/test_auth.py`: покрывает telegram auth, refresh boundary, protected `/users/me`.
  - `frontend/src/__tests__/smoke/routing.smoke.test.tsx`: проверяет, что `/login` открывается без краша (но не реальный вход).

**Gap summary**
- Экран логина есть, но **нет реального onboarding/auth UX** (нет Telegram initData flow, нет формы, нет обработки 401/redirect guard).
- FE хранит `auth_token`, но **нет явной точки, где он устанавливается** (в UI нет вызова `/users/auth/telegram`).

---

### 2) Exercise catalog browsing

- **UI entry point**
  - Bottom nav: `Navigation` → “Каталог” → `/exercises`
  - Кнопка “Добавить упражнение” → `/exercises/add`
- **Route**
  - `/exercises` (`features/exercises/pages/Catalog.tsx`)
  - `/exercises/add` (`features/exercises/pages/AddExercise.tsx`)
- **Frontend state/store**
  - TanStack Query:
    - `useExercisesCatalogQuery` (`exercisesApi.list` → map)
    - `useExerciseCategoriesQuery`, `useExerciseEquipmentQuery` (reference lists)
  - UI state: локальные `useState` фильтры/модалки; skeleton/empty/error state присутствуют.
- **API endpoints**
  - FE:
    - `GET /exercises` (list)
    - `GET /exercises/categories/list`
    - `GET /exercises/equipment/list`
    - `GET /exercises/muscle-groups/list`
    - `POST /api/v1/exercises/custom` (multipart) — **важно** (на фронте вызывается как `POST /exercises/custom` при `API_URL=.../api/v1`)
  - BE (`api/v1/exercises.py`):
    - `GET /api/v1/exercises/`
    - `GET /api/v1/exercises/{exercise_id}`
    - `POST /api/v1/exercises/`
    - `PUT/DELETE/approve` (admin)
    - `GET /api/v1/exercises/categories/list`
    - `GET /api/v1/exercises/equipment/list`
    - `GET /api/v1/exercises/muscle-groups/list`
  - **Статус**: в BE v1 **реализовано** `POST /api/v1/exercises/custom` (multipart) как совместимый эндпоинт для формы `AddExercise`.
- **Backend services / use cases**
  - `app.application.exercises_service.ExercisesService`
- **DB entities**
  - `app.domain.exercise.Exercise`
  - справочники: `app.domain.reference_data.RefExerciseCategory / RefEquipment / RefMuscleGroup`
- **Тесты**
  - Прямых интеграционных тестов упражнений в списке найденных тестов не видно (есть `test_workouts`, `test_analytics`, `test_auth`, `test_users` и т.д.).
  - FE: есть smoke routing для `/exercises` и `/exercises/add`, но это mount test.

**Gap summary**
- Browsing каталога в целом подключён к API (React Query), есть loading/empty/error UX.
- “Add custom exercise” flow на фронте ожидает `POST /exercises/custom` (при базовом URL `.../api/v1` это превращается в `POST /api/v1/exercises/custom`) → E2E должен работать при корректной конфигурации `API_URL` и наличии JWT.
- В `Catalog` кнопка “В мою тренировку” — **TODO** (лог только в консоль) → browsing не интегрирован с созданием тренировки/шаблона.

---

### 3) Create workout template

- **UI entry point**
  - `/workouts` → кнопка “Новая тренировка” → `/workouts/builder`
  - Empty state “Нет сохранённых шаблонов” → “Открыть конструктор”
- **Route**
  - `/workouts/builder` (`features/workouts/pages/WorkoutBuilder.tsx` via `WorkoutBuilderPage.tsx`)
- **Frontend state/store**
  - Локальный state конструктора (blocks/types/name), autosave в `localStorage` (`workout_builder_draft`)
  - TanStack Query:
    - prefetch `GET /workouts/templates`
    - mutation `useCreateWorkoutTemplateMutation` (optimistic + offline queue)
  - Важное: выбор упражнений в билдере сейчас из `mockExercises` (не из каталога/BE).
- **API endpoints**
  - `POST /workouts/templates`
  - `GET /workouts/templates`
- **Backend services / use cases**
  - `app.application.workouts_service.WorkoutsService.create_template / get_templates`
  - repository: `app.infrastructure.repositories.workouts_repository.WorkoutsRepository`
- **DB entities**
  - `app.domain.workout_template.WorkoutTemplate` (exercises JSON)
- **Тесты**
  - `backend/app/tests/test_workouts.py`: CRUD шаблонов (happy path), auth boundary.
  - FE: отдельного теста конструктора нет; smoke routing покрывает открытие.

**Gap summary**
- Шаблон реально создаётся через API и тестируется на бэке.
- Но FE “конструктор” не использует реальный каталог упражнений → пользователь не может гарантированно построить шаблон из реальных `Exercise.id` и muscle groups (важно для аналитики).

---

### 4) Start workout

- **UI entry point**
  - `/workouts`:
    - старт по шаблону (кнопка play на шаблоне)
    - старт по “режиму” (`/workouts/mode/:mode`)
  - `/workouts/mode/:mode` → кнопка “Start”
- **Route**
  - `/workouts/mode/:mode` (`WorkoutModePage.tsx`)
  - переход после старта: `/workouts/:id` (`WorkoutDetailPage.tsx`)
- **Frontend state/store**
  - mutation `useStartWorkoutMutation` (optimistic list/calendar, offline enqueue при recoverable error)
  - `useWorkoutSessionDraftStore` (zustand) хранит draft workout id + title для resume
- **API endpoints**
  - `POST /workouts/start`
- **Backend services / use cases**
  - `WorkoutsService.start_workout`
- **DB entities**
  - `WorkoutLog` создаётся в статусе “in_progress” через `duration = NULL` (семантика draft)
- **Тесты**
  - `backend/app/tests/test_workouts.py`: start from template + complete w/ idempotency.
  - FE: прямых интеграционных тестов старта нет.

**Gap summary**
- Старт тренировки end-to-end в целом реализован.
- Ошибки старта в `WorkoutModePage` логируются в console; явного UI error state/тоста на странице нет (в отличие от некоторых других экранов).

---

### 5) Add sets/reps/weight/rest (во время тренировки)

- **UI entry point**
  - `/workouts/:id` при активном draft (duration отсутствует или \( \le 0 \))
- **Route**
  - `/workouts/:id` (`WorkoutDetailPage.tsx`)
- **Frontend state/store**
  - `useWorkoutHistoryItemQuery(workoutId, enabled, { staleWhileEditing })`
  - `useOptimisticWorkoutSession` (локально патчит query cache: изменение `sets_completed`, `comments`, и т.д.)
  - Draft guard: если тренировка активная, UI позволяет редактировать и отмечать выполненные подходы.
- **API endpoints**
  - Сеты/повторы/вес **не отправляются по одному**; они уходят пачкой при завершении:
    - `POST /workouts/complete?workout_id=...`
- **Backend services / use cases**
  - `WorkoutsService.complete_workout` (idempotency optional)
  - внутри: upsert training load / muscle load / recovery state
- **DB entities**
  - `WorkoutLog.exercises` (JSON)
  - агрегации:
    - `TrainingLoadDaily`
    - `MuscleLoad`
    - `RecoveryState`
- **Тесты**
  - BE: start+complete покрыто интеграционным тестом.
  - FE: `WorkoutDetailPage.test.tsx` сейчас **skeleton TODO**, не проверяет реальное поведение.

**Gap summary**
- Пользователь может вводить reps/weight и отмечать completed, но **rest таймер как часть сессии** не сохранён в выполнении (в payload поле `rest_seconds` внутри `sets_completed` не видно; на странице тоже не редактируется).
- UI показывает RPE/RIR/Duration только в read-only режиме (если приходит с бэка), но в draft режиме редактируются только reps/weight/completed.

---

### 6) Finish workout

- **UI entry point**
  - `/workouts/:id` → кнопка “Завершить тренировку” (только для draft)
- **Route**
  - `/workouts/:id`
- **Frontend state/store**
  - валидации на клиенте:
    - duration 1..1440
    - есть упражнения
    - есть хотя бы 1 completed set
  - mutation `useCompleteWorkoutMutation`:
    - optimistic patch detail + list + calendar
    - offline enqueue при recoverable error
    - idempotency header поддержан на BE, но FE сейчас не видно генерации/проброса Idempotency-Key
- **API endpoints**
  - `POST /workouts/complete?workout_id=...`
- **Backend services / use cases**
  - `WorkoutsService.complete_workout` (+ idempotency)
- **DB entities**
  - `WorkoutLog.duration` становится not-null (completed marker)
  - агрегаты аналитики как выше
- **Тесты**
  - BE: есть тест на idempotency.
  - FE: skeleton TODO.

**Gap summary**
- E2E завершение реализовано, но UX ошибок неполный:
  - на странице есть `completeMutation.isError` и client-side validation — это хорошо;
  - однако “recoverable/offline queued” путь не отображается пользователю как явный статус (есть общая offline инфраструктура, но нужен UI feedback).

---

### 7) View history

- **UI entry point**
  - `/workouts` → блок “История” (list) → клик по тренировке → `/workouts/:id`
  - Draft resume card → `/workouts/:id`
- **Route**
  - `/workouts` (list + templates + history summary)
  - `/workouts/:id` (detail)
- **Frontend state/store**
  - TanStack Query: `useWorkoutHistoryQuery`, `useWorkoutHistoryItemQuery`
  - zustand: `useWorkoutSessionDraftStore` для resume/cleanup draft
  - Есть empty states по фильтрам и при пустой истории.
- **API endpoints**
  - `GET /workouts/history`
  - `GET /workouts/history/{workout_id}`
- **Backend services / use cases**
  - `WorkoutsService.get_history`, `WorkoutsService.get_workout_detail`
- **DB entities**
  - `WorkoutLog`
- **Тесты**
  - `backend/app/tests/test_workouts.py`: pagination contract + detail after complete.
  - `frontend/src/__tests__/workouts/WorkoutsPage.test.tsx` существует (нужно отдельно проверить покрытие, но файл присутствует).

**Gap summary**
- История закрыта end-to-end достаточно хорошо.
- Потенциальный gap: календарь в UI должен опираться на **канонический** эндпоинт `GET /api/v1/analytics/calendar`. Ранее фронт дергал `GET /workouts/calendar`, что расходилось с архитектурной логикой (calendar view живёт в analytics). Решение: фронт использует `GET /analytics/calendar` (относительно `API_URL=.../api/v1`).

---

### 8) Basic analytics

- **UI entry point**
  - Bottom nav → “Статистика” → `/analytics`
- **Route**
  - `/analytics` (`features/analytics/pages/Analytics.tsx`)
- **Frontend state/store**
  - **Mock-only** data via `useQuery({ queryFn: generateMockWorkouts })`
  - Реальные API клиенты существуют (`shared/api/domains/analyticsApi.ts`), но страница их не использует.
  - Empty states есть (selectedExercises empty / chartData empty).
- **API endpoints**
  - BE имеет богатый набор:
    - `GET /api/v1/analytics/summary`
    - `GET /api/v1/analytics/progress`
    - `GET /api/v1/analytics/training-load/daily`
    - `GET /api/v1/analytics/muscle-load`
    - `GET /api/v1/analytics/calendar`
    - и др.
  - FE `analyticsApi` пока предоставляет лишь часть:
    - `/analytics/summary`, `/analytics/progress`, `/analytics/calendar`, `/analytics/muscle-load`
- **Backend services / use cases**
  - `AnalyticsService` (+ `AnalyticsRepository`, cache layer)
- **DB entities**
  - агрегаты: `TrainingLoadDaily`, `MuscleLoad`, `RecoveryState`
  - источники: `WorkoutLog` + `Exercise` (для muscle groups) + wellness (если включено)
- **Тесты**
  - `backend/app/tests/test_analytics.py`: auth boundary и контракты empty states.
  - FE: нет тестов на реальную интеграцию с analytics API (страница на mock).

**Gap summary**
- Экран аналитики есть и UX богатый, но **не подключён к реальным данным** → это “screen-only” сценарий.
- Есть потенциальная несогласованность контрактов (FE types внутри Analytics не совпадают со схемами BE `analytics/progress` и `analytics/summary`).

---

## Cross-cutting: offline / sync / resilience

По git status видно активную работу в `shared/offline/syncQueue/*`, `workoutOfflineEnqueue.ts`, `ConnectivitySyncBar.tsx`.

- **Плюс**: для start/complete/template create/update есть recoverable/offline enqueue + optimistic updates.
- **Минус**: пользователю не везде показан понятный статус “изменения сохранены локально и будут синхронизированы” (частично решается `ConnectivitySyncBar`, но нужно сверить, какие flows реально его отображают в критических точках).

---

## Разрывы (gaps) — что именно не сходится E2E

### Экран есть, API нет
- **Custom exercise upload**
  - FE ожидает `POST /exercises/custom` (multipart) (`exercisesApi.createCustom`, `AddExercise`), а BE v1 предоставляет `POST /api/v1/exercises/custom` (multipart). Нужно держать этот путь как совместимый контракт и прикрыть тестами.
- **User stats / coach access / export**
  - FE `usersApi` вызывает:
    - `GET /users/stats`
    - `GET/POST/DELETE /users/coach-access*`
    - `GET /users/export`
  - В BE `api/v1/users.py` этих эндпоинтов нет → части `ProfilePage` не будут работать без моков/фолбеков.
- **Workouts calendar**
  - FE `workoutsApi.getCalendarMonth` использует `GET /workouts/calendar`
  - BE календарь находится в `GET /analytics/calendar`, а в `workouts.py` календарного эндпоинта нет.

### API есть, UI нет (или не подключён)
- **Telegram login**
  - BE: `POST /users/auth/telegram` есть + тестируется
  - FE: нет UI, который формирует `init_data` и вызывает этот endpoint; `/login` — заглушка.
- **Analytics API**
  - BE: полноценные `/analytics/*` endpoints + тесты
  - FE: `/analytics` страница работает на mock data
- **Exercise detail**
  - BE: `GET /exercises/{id}` есть
  - FE: каталог использует собственную модель + modal без запроса detail (может быть ок для MVP, но функциональность API не используется).

### Сценарий неполный
- **Browse catalog → add to workout/template**
  - В `Catalog` кнопка “В мою тренировку” не соединена ни с `WorkoutBuilder`, ни со стартом сессии → нет “замыкания” flow.
- **WorkoutBuilder → real exercises**
  - Конструктор использует mock упражнения; маппинг `exercise_id` для template строится из string/id с fallback → это риск неконсистентности с BE `Exercise.id`.

### Нет/неполные error/loading/empty state
- **Workout start (mode page)**
  - Ошибка старта логируется, но UI состояния ошибки/ретрая нет.
- **Auth boundary UX**
  - Нет route guards/redirect UX при 401 (кроме ручного logout, который просто чистит localStorage и кидает на `/login`).

---

## Prioritized backlog

### Must-have before beta (закрыть базовый E2E)
- **Auth/onboarding E2E**
  - Реализовать `Login` через Telegram WebApp initData: получить `init_data` → `POST /users/auth/telegram` → сохранить `auth_token` → redirect назад.
  - Добавить базовые route guards: при 401 на `/profile`, `/workouts`, `/exercises`, `/analytics` → redirect to `/login` + сохранение returnUrl.
- **Fix broken endpoints mismatches**
  - Рекомендация: canonical creation остаётся `POST /api/v1/exercises/` (JSON), а `POST /api/v1/exercises/custom` (multipart) — compatibility endpoint для UI формы; поддерживать до миграции UI на JSON (если/когда понадобится).
  - Привести календарь к одному контракту: либо FE использовать `GET /analytics/calendar`, либо BE добавить alias `GET /workouts/calendar`.
- **Catalog → workout integration**
  - Сделать “В мою тренировку”:
    - вариант A: добавлять в draft конструктора (`workout_builder_draft`) и вести в `/workouts/builder`
    - вариант B: создавать шаблон/сессию напрямую (минимально: добавить упражнение в builder state и открыть builder)
- **WorkoutBuilder uses real exercises**
  - Подключить selector к `exercisesApi.list` + search/filter + стабильные `exercise_id`.
- **FE tests for critical workout completion**
  - Заполнить `WorkoutDetailPage.test.tsx` (сейчас skeleton) минимум: валидации + вызов complete mutation payload.

### Should-have before launch (качество и продуктовые ожидания)
- **Analytics подключить к реальному API**
  - Минимально: summary (`/analytics/summary`) + progress (`/analytics/progress`) + muscle load (`/analytics/muscle-load`) с корректными типами и empty state.
  - Удалить/ограничить mock data.
- **Profile endpoints alignment**
  - Либо реализовать на BE `users/stats`, `users/export`, `coach-access*`, либо убрать эти секции из UI/заменить на доступный функционал (например analytics export уже есть в BE).
- **Offline UX**
  - В явном виде показывать “сохранено локально / в очереди синка / синк выполнен / конфликт” для start/complete/template ops.

### Later (расширения)
- **Granular per-set fields**
  - UI редактирования RPE/RIR/rest_seconds/duration per set (и соответствующая схема payload).
- **Workout edit**
  - `/workouts/:id/edit` сейчас есть как route; нужен реальный API/сценарий редактирования completed workout или убрать/скрыть до реализации.
- **Data export полноценный**
  - Использовать `POST /analytics/export` + polling `GET /analytics/export/{id}` и UI статуса/скачивания.

---

## Итоговая оценка MVP E2E

- **Сильная часть (почти E2E готово)**: тренировки (templates → start → draft edit → complete → history) с offline/optimistic и backend тестами.
- **Слабые/разорванные части**:
  - auth/onboarding (UI заглушка)
  - analytics (UI на mock, хотя API готов)
  - catalog → add to workout (нет замыкания)
  - profile “stats/coach/export” (FE вызывает несуществующие BE endpoints)
  - exercises custom upload endpoint mismatch

