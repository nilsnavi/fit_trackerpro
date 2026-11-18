# FTP-020 — Audit Report: FitTracker Pro 2.0 (Athlete + Coach)

**Дата:** 2026-11-18
**Ветка:** `feature/ftp-020-architecture-audit`
**Базовый коммит:** `f53b98b` (main)
**Тип:** read-only audit + planning. Изменены только документы в `docs/`.

---

## 1. Резюме

Проект — зрелая кодовая база: полный функциональный Athlete (тренировки, прогрессия,
аналитика, здоровье, офлайн), **полностью реализованный Coach (Trainer Pro)** на backend и
frontend, строгая CI-политика, генерация OpenAPI-типов, офлайн-контракт с idempotency.
Premium UI-база уже частично заложена (FTP-021 PR A: графит+лайм+Manrope+adaptive shell).

**Ключевой вывод:** стратегия «новый frontend, существующий backend» подтверждена. Backend
и предметная модель готовы для реюза; фронтенд требует **поэтапной premium-эволюции**, а не
полного rewrite (существующий Active Workout и Coach-функциональность слишком ценны).

---

## 2. Метод и проверенные данные

- Три независимых параллельных аудита: frontend, backend+API+БД, docs+CI+infra.
- Всё подтверждено фактическим кодом (файлы и строки), не описаниями.
- Git-проверка перед началом: рабочее дерево чистое, ветка `main`, default branch `origin/main`.
- Работа ведётся в отдельной ветке `feature/ftp-020-architecture-audit` (создана от main).

### 2.1 Проверки окружения (фактические)

| Проверка | Результат |
|---|---|
| `git status --short` | чисто (до создания ветки) |
| Ветка | `feature/ftp-020-architecture-audit` |
| Default branch | `origin/main` |
| Существующие артефакты FTP-020 | отсутствуют (созданы в этом PR) |
| `design-references/premium-ui/` | **отсутствует** (эталон FTP-021 не распакован) |

---

## 3. Текущее состояние архитектуры

### 3.1 Frontend

- **Стек:** React 19.3, react-router-dom 7.18, TanStack Query 5.107 (persist), Zustand 5.1,
  Axios 1.21, Recharts 3.8, @telegram-apps/sdk-react 3.3.9, Tailwind CSS 4.3.5, Vite 7.3.6,
  vite-plugin-pwa 2.0, Jest 29.7, Playwright 1.65, TypeScript 5.9.3, Sentry 10.47, dnd-kit 6.3.
- **Роутинг:** `src/app/routes/AppRoutes.tsx` (Suspense + lazy), `RouteGuard`
  (`src/shared/auth/RouteGuard.tsx`). ~45 маршрутов, включая полноценное дерево `/coach/*`
  (`src/features/coach/routes.tsx`, 16 маршрутов) и `/client/coach-programs`.
- **Тема:** Tailwind v4 + `src/styles/globals.css` — semantic + Telegram tokens
  (`--tg-theme-*`), шрифт Manrope (woff2, кириллица+латиница). В `globals.css:680-846`
  готовый блок **«Premium web shell»** — тёмная премиум-палитра, лаймовый primary,
  сайдбар на широких экранах, нижняя навигация на узких/Telegram. Покрыт
  `frontend/e2e/premium-shell.spec.ts`.
- **Архитектура:** feature-sliced: `app/`, `features/<domain>/`, `shared/`, `stores/`.
  Server state — TanStack Query (queryKeys в `shared/api/queryKeys.ts`), UI state — Zustand.
  Сетевой слой изолирован: `shared/api/client.ts` + `shared/api/domains/*.ts`.
- **Фичи:** workouts (крупнейшая, Active flow ~1200 строк, 20+ hooks, workoutMode),
  home, analytics (4 вкладки, recharts), coach (полный), profile, auth, exercises, health,
  achievements, emergency, legal, telegram.

### 3.2 Backend

- **Стек:** Python 3.12, FastAPI 0.162.5, SQLAlchemy 2.1.8 async, Pydantic 2.14.3, Alembic.
- **Слои:** `api/v1` (14 роутер-модулей) → `application/` (27 сервисов) → `domain/`
  (44 SQLAlchemy-модели + progression engine) → `infrastructure/` (15 репозиториев,
  telegram_auth, cache, idempotency, email_delivery).
- **Аутентификация:** Telegram initData HMAC-SHA256 (replay window 300s),
  JWT HS256 (access 30 мин, refresh 7 дней с ротацией и family reuse-detection),
  email auth (SMTP, 6-значный код), health consent с версионированием.
- **Безопасность:** rate limit (SlowAPI + custom RateLimitMiddleware по политикам),
  idempotency-ключи на мутациях, аудит чтения health-данных, feature-flag на coach,
  строгие прод-проверки env (reject_insecure_defaults).
- **Coach (полный):** модели/схемы/сервисы/эндпоинты identity, invitations, clients,
  monitoring (правила NO_RECENT_WORKOUT и др.), programs+assignments, packages/payments/tasks
  (business), notifications (outbox), entitlements (FREE/TRAINER_PRO, trial/grace).
  Client-сторона: `/client/coach-programs` + start day → WorkoutLog.

### 3.3 Данные и миграции

- PostgreSQL 15 + Redis 7; Alembic в `database/migrations/` (35 миграций, head `s11_2_email_auth`).
- CI-валидация миграций: `--validate-chain`, fresh upgrade, rollback round-trip.
- Тестовая БД: SQLite in-memory по умолчанию, `TEST_DATABASE_URL` для Postgres, защита от продуктива.

### 3.4 PWA / офлайн

- vite-plugin-pwa (Workbox): precache + runtime cache (шрифты/JS/CSS/иконки), `navigateFallback`
  с denylist `/api/`, `registerType: 'prompt'`, SW отключён в dev.
- Offline data: TanStack Query persist в IndexedDB `fittracker_offline`/`queryCache`
  (`fittracker_rq_offline_v2`, TTL 7 дней) для exercises/reference/history/templates.
- Mutations: `SyncQueueEngine` (localStorage `fittracker_sync_queue_v1`, dedupe, backoff,
  cap 200) + legacy `offlineQueue` для сетов; enqueue-хелперы `workoutOfflineEnqueue.ts`;
  запуск `SyncQueueRunner` (15с/online/visibility).
- Draft: localStorage `workout_draft_{userId}_{workoutId}` + zustand-persist
  `active-workout-session-draft` + Telegram Cloud Storage.

### 3.5 CI/CD

- `.github/workflows/`: test.yml (главный gate: build, lint max-warnings 0, tsc, test:ci,
  coverage baselines, deadcode, bundle budgets, E2E desktop/mobile, pytest, ruff, API-contract,
  миграции), security.yml (gitleaks, dependency-review, CodeQL, pip-audit, npm audit, Trivy),
  build.yml/deploy.yml/migrate.yml/rollback-production.yml, e2e-smoke-real.yml, workflow-lint.
- API contract: `api:types:generate` → openapi.json + openapi.d.ts committed;
  drift-гейты `api:contract:check` и `api:contract:check:committed` на каждый push/PR.

### 3.6 Тесты

- Frontend: ~98 тест-файлов Jest (96 suites / 640 tests), coverage thresholds, architecture
  tests (networkBoundary, eslintNetworkBoundary), client (terminated/coach-token-safety),
  coach, offline (engine/idb/conflict), active workout.
- Backend: 50 тест-файлов pytest, маркеры smoke/unit/integration/slow/auth, в т.ч. 9 coach-тестов.
- E2E Playwright: 19 спеков в `frontend/e2e/` (golden path, workout flows, mobile android/ios,
  offline, session restore, progression, coach entitlements/relations/monitoring/programs,
  premium-shell) + 3 в `tests/e2e/`.

---

## 4. Функции Athlete и Coach (инвентаризация)

### 4.1 Athlete (все реализованы)

| Функция | Frontend | Backend API |
|---|---|---|
| Активная тренировка (start/sets/RPE/RIR/rest/complete/cancel) | `features/workouts/active/*`, `workoutMode/*` | `/workouts/start`, `/sessions`, `/complete`, `/cancel`, `PATCH /sets/:setId` |
| Восстановление черновика / incomplete | `SessionRestoreDialog`, `useIncompleteWorkoutCheck` | `GET /workouts/sessions/incomplete` |
| Offline-очередь мутаций + idempotency | `shared/offline/*`, `activeWorkoutSessionDraftStore` | `Idempotency-Key` header |
| Рекомендация веса / прогрессии | `useWeightRecommendation`, `useProgressionRecommendation` | `GET weight-recommendation`, `/workouts/progression/recommendation` |
| Прогрессия (SPEC-006) | `ProgressionTargetsPage`, prefill | `/progression/*` |
| Шаблоны тренировок | `WorkoutBuilder*`, `WorkoutTemplatesPage` | `/workouts/templates*` |
| История + календарь | `WorkoutHistoryPage`, `Calendar` | `/workouts/history`, `/workouts/calendar` |
| Аналитика (обзор/нагрузка/награды/здоровье) | `AnalyticsDashboardPage`, `ProgressOverviewPage` | `/analytics/*` |
| Muscle load / training load | `MuscleLoadTable`, `TrainingLoadTable` | `/analytics/muscle-load`, `/training-load/daily` |
| Здоровье (wellness/glucose/water/body measurements) | `features/health/*`, `HomeHealthSection` | `/health-metrics/*` |
| Достижения | `AchievementsPage` | `/achievements/*` |
| Экстренные контакты | `EmergencyButton`, `EmergencyContactsSection` | `/emergency/contacts` |
| Экспорт данных | Profile | `GET /users/export` |
| Каталог упражнений | `Catalog`, `AddExercise` | `/exercises/*` |

### 4.2 Coach (все реализованы, backend authority)

| Функция | Frontend | Backend API |
|---|---|---|
| Coach-профиль и подписка | `CoachOnboardingPage`, `CoachSubscriptionPage` | `/coach/profile`, `/coach/subscription`, `/coach/plans` |
| Инвайты клиентов | `CoachInvitePage`, `CoachInvitationAcceptPage` | `/coach/invitations*` |
| Клиенты (status/revoke) | `CoachClientsPage`, `CoachClientPage` | `/coach/clients*` |
| Мониторинг клиентов | `CoachMonitoringPage`, `CoachMonitoringDetailPage` | `/coach/monitoring*` |
| Программы + assignments | `CoachProgramsPage`, `CoachProgramBuilderPage`, `CoachProgramDetailPage` | `/coach/programs*`, `/coach/assignments*` |
| Пакеты/платежи/задачи (business) | `CoachClientPackagesPage`, `CoachPackagesPage`, `CoachTasksPage` | `/coach/packages*`, `/coach/clients/:id/packages*`, `/coach/tasks*` |
| Entitlements / paywall | `EntitlementPaywall` | server-side `require_capacity`/`require_feature` (403) |
| Клиентская сторона программ | `ClientCoachProgramsPage` | `/client/coach-programs*` (start day → WorkoutLog, Idempotency-Key) |

**Важно:** переключение UI **не** даёт прав Coach. Все проверки — на сервере:
`require_coach_feature` (feature flag) + `require_coach` (роль COACH в `user_roles`) +
`require_active_coach_client` + `require_capacity`/`require_feature` (entitlements).

---

## 5. Классификация компонентов: KEEP / REFACTOR / REWRITE / REMOVE

### 5.1 KEEP (переиспользовать без изменений)

| Компонент | Почему |
|---|---|
| Backend полностью: api/application/domain/infrastructure/schemas | Полная предметная область, JWT-контракт, idempotency, rate limits, аудит health |
| OpenAPI-генерация (`api:types:generate`) + committed artifacts | Воспроизводимый контракт, CI-gate |
| Auth: Telegram initData, email auth, refresh rotation, RouteGuard | Security-sensitive, работает |
| Active Workout state machine: hooks, stores, sync, timers, idempotency | Бизнес-критичный, покрыт тестами — нельзя заменять демо |
| Offline: SyncQueueEngine, offlineQueryPersist, conflictResolution, workoutOfflineEnqueue | Сильный офлайн-контракт |
| Zustand stores (rest presets, smart settings, quick increments, draft) | UI-локальное состояние |
| Coach backend: модели/сервисы/эндпоинты/entitlements | Полноценная платформа тренера |
| TanStack Query паттерны, queryKeys, domain API wrappers | Server state конвенция |
| PWA: vite-plugin-pwa, Workbox, manifest, PwaUpdatePrompt | Готовая инфраструктура |
| CI/CD workflow и QA gates | Product contract, не ослаблять |

### 5.2 REFACTOR (адаптировать под premium, сохранив логику)

| Компонент | Что сделать | Риск |
|---|---|---|
| `AppShell` / `Navigation` / `AppShellHeader` | Довести до эталона (сайдбар уже есть), адаптив, Telegram shell | Низкий |
| `Home` (`features/home`) | Premium dashboard: метрики из серверных данных, empty states | Средний |
| Active workout presentation (components/modals) | Поэтапно presentation-only под премиум; state machine не трогать | Средний |
| `AnalyticsDashboardPage` + charts | Premium-представление, оставить recharts и API | Низкий |
| Coach UI (pages/components) | Premium layout, сохранить контракты и RBAC | Низкий |
| `shared/ui/*` (Button/Card/Badge/...) | Расширить токены, не создавать вторую дизайн-систему | Средний |

### 5.3 REWRITE (в контексте v2)

| Компонент | Что | Почему |
|---|---|---|
| Токеновая тема → полноценный Premium Design System | Расширить `globals.css`/`tailwind.config.js` semantic tokens (graphite + lime + surfaces), вынести в `styles/tokens.css` | Сейчас премиум-блок частично хардкодится в globals.css |
| Coach dashboard («Обзор») | Новая композиция существующих данных `/coach/*` | Эталон Coach → Обзор |
| Athlete dashboard («Обзор») | Композиция существующих хуков/API | Эталон Athlete → Обзор |
| Коуч-расписание (Schedule) | Новый UI + **новый backend контракт** | Контракта нет (см. §6) |

### 5.4 REMOVE (не переносить / удалять в мажоре)

| Компонент | Когда |
|---|---|
| Legacy API-алиасы `/auth`, `/achievements`, `/challenges`, `/emergency` | Мажорный релиз (уже скрыты из OpenAPI, deprecated) |
| Legacy `offlineQueue` (localStorage очередь сетов) | Консолидация на SyncQueueEngine (после миграции данных/тестов) |
| Мёртвый `authApi.refreshToken()` | Уже удалён в main |
| Демо-данные/CTA прототипа premium-ui | Не подключать вообще |
| `muscle_signals` legacy-вьюхи | Переписать под `workout_logs`/`workout_sets` (KNOWN_LIMITATIONS) |

---

## 6. Недостающие API и модели БД для коммерческой платформы тренеров

### 6.1 Backend-гэпы (блокеры для Coach Premium)

| # | Гэп | Файл/место | Влияние | Рекомендация |
|---|---|---|---|---|
| G1 | **`/users/coach-access*` — 501 «not implemented»** | `backend/app/api/v1/users.py:84-101` | Coach не может получить доступ к данным клиента (истории, аналитика, медданные) с серверной проверкой принадлежности | Отдельная SPEC: модель доступа, проверка `coach_clients`, аудит чтения, consent |
| G2 | **Расписание встреч (Schedule) — контракта нет** | эталон Coach → Расписание; сейчас только `CoachTasks` | Нет модели событий/встреч, нет API | SPEC + миграция `coach_meetings` (или расширение tasks) + эндпоинты + тесты |
| G3 | **Платёжный провайдер отсутствует** | `coach_payments` — ручной ввод | Нельзя продавать подписки/пакеты онлайн | Интеграция (Stripe / YooKassa / Telegram Stars) — отдельная задача с security review |
| G4 | **Athlete Premium подписки нет** | только `CoachSubscription` | Нет монетизации спортсменов | Каталог планов + entitlements по образцу coach |
| G5 | **Участие в челленджах — 501** | `challenges.py:28-30` | Аналитика «Награды» частично | P2, не блокер premium |
| G6 | **muscle_signals legacy-вьюхи отсутствуют** | `docs/KNOWN_LIMITATIONS.md` | Muscle-signals деградируют | Переписать вьюхи под текущую схему |

### 6.2 Frontend-гэпы

| # | Гэп | Где |
|---|---|---|
| F1 | Нет premium Athlete dashboard («Обзор») | `features/home` — требуется композиция |
| F2 | Нет premium Coach dashboard («Обзор») | `features/coach` — требуется композиция |
| F3 | Нет Coach Schedule UI | маршрут `/coach/*` |
| F4 | Premium Design System не выделен в отдельный токеновый слой | `styles/globals.css:680-846` |
| F5 | `design-references/premium-ui/` не распакован в workspace | эталон FTP-021 недоступен локально |

### 6.3 Согласованность контрактов

- Backend/frontend контракт защищён CI (`api:contract:check:committed`).
- Новые эндпоинты (G1, G2, G3) обязаны идти через `api:types:generate` + committed artifacts.
- Новые таблицы — через новые Alembic-миграции (не редактировать применённые), с непустым `downgrade()`.

---

## 7. Offline-first: ограничения и рекомендуемая архитектура синхронизации

### 7.1 Текущие ограничения (KNOWN_LIMITATIONS + подтверждено кодом)

1. «Холодный» офлайн с первого визита невозможен (SW не кеширует первый запрос).
2. Синхронизация очереди мутаций только при открытом приложении (15с/online/visibility);
   **фонового sync нет** — при закрытом приложении очередь не разгружается.
3. Дублирование механизмов очереди: `SyncQueueEngine` (новый) и legacy `offlineQueue` (старый).
4. IndexedDB persist ограничен subset-ключей (exercises/reference/history/templates).
5. Персист всей активной сессии частично дублируется: localStorage + zustand-persist + Telegram Cloud Storage.

### 7.2 Рекомендуемая архитектура (для v2)

1. **Единая очередь:** мигрировать legacy `offlineQueue` на `SyncQueueEngine` (dedupeKey,
   idempotencyKey, backoff уже есть). Удалить дубль после покрытия тестами.
2. **Фоновая синхронизация:** добавить `Background Sync API` в service worker как
   progressive enhancement (replay очереди при восстановлении сети), сохранив текущий
   runner как fallback. Для Telegram Mini App — синхронизация при открытии/видимости
   остаётся основным путём.
3. **Periodic sync / Notification Triggers** — исследовать (iOS ограничен); не блокер.
4. **Persist scope:** расширить subset на читаемые premium-данные (analytics summary,
   coach monitoring snapshot) с TTL и stale-меткой; не кешировать чувствительные медданные без TTL-ограничения.
5. **Конфликты:** текущий `conflictResolution.ts` сохранить; для coach-данных ввести
   server-authoritative merge (last-write-wins по updated_at + idempotency).
6. **Наблюдаемость:** сохранить `workoutSyncTelemetry`; распространить на coach-операции.

### 7.3 Сценарии, которые обязаны остаться рабочими

- Старт → подходы (сеть вкл/выкл) → отдых → завершение → история.
- Прерывание сети → восстановление → **без дублей** (idempotency-ключи).
- Восстановление черновика после перезагрузки.
- Coach: назначение программы → клиент стартует день → синк назад.

---

## 8. Рекомендуемая структура нового frontend (Premium Design System)

**Подход:** эволюция существующего `frontend/src` (feature-sliced), а не полный rewrite.
Новые premium-страницы — композиция существующих хуков/API.

```
frontend/src/
├── app/                    # shell: layouts, providers, routes, bootstrap
│   ├── layouts/            #   AppShell (premium adaptive), AppShellHeader
│   ├── providers/          #   QueryProvider, TelegramProvider, ThemeProvider, HealthCheckGate, SyncQueueRunner
│   └── routes/             #   AppRoutes (Athlete + Coach trees)
├── features/
│   ├── athlete/            # NEW premium dashboard pages (композиция, не дубли логики)
│   │   ├── pages/          #   OverviewPage, WorkoutPage(вход в /workouts), ProgramsPage, ProgressPage
│   │   └── components/
│   ├── coach/              # EXISTS; + Schedule (PR E/F)
│   ├── workouts/           # EXISTS (KEEP state machine; presentation refactor в PR C)
│   ├── analytics/          # EXISTS (premium presentation)
│   ├── home/               # EXISTS (переиспользуется в athlete overview)
│   ├── health/, profile/, auth/, exercises/, achievements/, emergency/, legal/, telegram/
├── shared/
│   ├── api/                # client, domains, generated (KEEP)
│   ├── offline/            # SyncQueueEngine (KEEP, консолидировать), conflictResolution
│   ├── ui/                 # KEEP + расширение токенами (NO second design system)
│   ├── styles/             # tokens.css (Premium Design System: graphite/lime/surfaces/type/radius)
│   ├── auth/, hooks/, lib/, errors/, config/, types/, stores/
└── stores/                 # Zustand UI-state (KEEP)
```

### Design System принципы

- Единый источник токенов: `shared/styles/tokens.css` + `tailwind.config.js`
  (semantic + telegram + premium). Хардкод-цвета на страницах запрещены (grep-гейт).
- Telegram light/dark сохранить через theme adapter; premium-тема — отдельный селектор
  `[data-app-shell][data-telegram='false']` (уже есть).
- Адаптив: mobile (iPhone/Android) + desktop; reduced motion (уже в globals.css).
- Русская локализация везде.

---

## 9. План миграции (параллельная работа)

### Модель

- **main** остаётся работающим продуктом (Athlete + Coach текущие).
- Разработка premium-версии — серия PR в `feature/*` ветках, ревью и merge по одному.
- FTP-020 (этот аудит) — только docs, без кода продукта.

### Последовательность (FTP-021 B–G — уже в roadmap FTP-021)

| Этап | Содержание | Влияние на prod |
|---|---|---|
| PR A (готов, #268) | Premium shell, токены, Manrope, adaptive nav | Только frontend |
| PR B | Athlete dashboard (Overview) — композиция существующих данных | Frontend |
| PR C | Active Workout presentation (без смены state machine) | Frontend |
| PR D | Programs & Analytics premium | Frontend |
| PR E | Coach read-only premium (dashboard/clients/monitoring/programs) | Frontend |
| PR F | Coach mutations + backend: **G1/G2/G3 SPEC + миграции + RBAC тесты** | Backend + frontend |
| PR G | PWA/regression/release candidate, скриншоты, changelog | QA |

### Критерии безопасного merge

- `npm run typecheck && npm run lint && npm run test:ci && npm run build` — green.
- `api:contract:check:committed` — green (при изменении backend).
- Backend pytest + миграционные гейты (validate-chain, round-trip).
- E2E: workout-flows + mobile (не весь suite на каждый мелкий PR; полный — на кандидата).
- Нет регрессий Active Workout (idempotency, offline, draft).

---

## 10. Тесты для v2 (E2E / API / security / performance)

### API / contract
- `api:contract:check:committed` на каждый PR (дрифт-гейт).
- Новые эндпоинты Coach: pytest + позитивные/негативные ownership-кейсы
  (клиент тренера ≠ клиент другого тренера → 403/404).
- Idempotency-тесты на новые мутации (assign program, start day, payment record).

### E2E (расширение существующих спеков)
| Спека | Покрывает |
|---|---|
| `premium-shell.spec.ts` (exists) | оболочка, навигация, темы, reduced motion |
| NEW `athlete-overview.spec.ts` | дашборд спортсмена, метрики, empty/error/offline states |
| `workout-complete-flow.spec.ts`, `active-workout-offline-refresh.spec.ts` (exists) | Active Workout regression |
| NEW `coach-premium.spec.ts` | дашборд тренера, клиенты, мониторинг, schedule |
| `coach-*` (exists, 5 спеков) | RBAC, entitlements, relations, programs, monitoring |
| `mobile-regression.workout.spec.ts`, `mobile-hot-path.telegram-miniapp.spec.ts` (exists) | Android/iOS/TG |
| `smoke-real-api.golden-path.spec.ts` (exists) | реальный API |

### Security
- Server-authoritative RBAC тесты на coach-доступ (включая чтение медданных клиента с аудитом).
- gitleaks/CodeQL/pip-audit/npm audit/Trivy — уже в CI, не ослаблять.
- Rate limit тесты на новые coach-эндпоинты.
- НЕ хранить frontend-state как proof роли/доступа.

### Performance
- `bundle:check` (бюджеты бандла) — уже в CI; новые premium-страницы должны укладываться.
- Lazy-load premium-чанков, избегать увеличения main chunk.
- Lighthouse/объём JS на мобильных — целевые проверки в PR G.

---

## 11. Архитектурные риски

| # | Риск | Митигация |
|---|---|---|
| R1 | Переписывание Active Workout презентации заденет state machine | Presentation-only PR C, строгие E2E и unit (idempotency/offline) |
| R2 | Две дизайн-системы | Запрет хардкод-цветов, единый токеновый слой, grep-гейт |
| R3 | Coach-доступ к данным клиента (G1) без строгого RBAC → утечка медданных | Server-authoritative ownership, аудит чтения, consent, тесты негативных кейсов |
| R4 | Рост бандла premium-страниц | Lazy-load, bundle:check |
| R5 | Офлайн-очередь дублируется | Консолидация на SyncQueueEngine с тестами миграции |
| R6 | Платежи (G3) добавляют compliance-поверхность | Отдельный security review, безопасная интеграция, rollback |
| R7 | Эталон UI недоступен локально (`design-references/premium-ui/` не распакован) | Распаковать архив вручную до PR B; сверка по скриншотам ftp-021 |

---

## 12. Блокеры и открытые решения

### Блокеры
- **B1.** `design-references/premium-ui/` отсутствует в workspace — эталон не распакован.
  До PR B нужно распаковать `fittracker-pro-premium-prototype.zip` в эту папку вручную.
- **B2.** G1 (`/users/coach-access` 501) блокирует Coach «просмотр прогресса клиента»
  в полном объёме — нужен отдельный SPEC до PR F.
- **B3.** G2 (Schedule) не имеет backend-контракта — нужен SPEC + миграция до PR E/F.

### Открытые решения (требуют согласования)
1. Монетизация: Telegram Stars vs YooKassa vs Stripe (G3) — выбор провайдера.
2. Athlete Premium: что входит в платную подписку (G4).
3. Полный rewrite Coach UI vs эволюция существующего (рекомендуется эволюция).
4. Период миграции legacy `offlineQueue` → SyncQueueEngine.
5. Насколько глубоко переносить «достижения/здоровье» в premium-оболочку (все домены остаются, меняется представление).

---

## 13. Проверки (фактические результаты)

| Проверка | Результат | Комментарий |
|---|---|---|
| `git status --short` до изменений | чисто | |
| Ветка создана | `feature/ftp-020-architecture-audit` | |
| Аудит frontend (параллельный subagent) | ✅ 3 отчёта, сверены с кодом | пути/строки в §3–5 |
| Аудит backend (параллельный subagent) | ✅ | |
| Аудит docs/CI/infra (параллельный subagent) | ✅ | |
| `npm run typecheck / lint / test:ci / build` | **не выполнялось** | нет изменений кода продукта; выполнять в PR B–G |
| Backend pytest | **не выполнялось** | нет изменений backend |
| E2E | **не выполнялось** | нет изменений frontend |

---

## 14. Заключение

Backend и предметная модель готовы к реюзу для Premium Athlete + Coach. Coach-платформа
реализована полноценно (RBAC на сервере). Ключевые пробелы — Coach-доступ к данным клиента
(501), расписание встреч и платёжный провайдер/Athlete-подписка. Frontend рекомендуется
развивать эволюционно с единым Premium Design System на токенах. Дорожная карта
FTP-030–FTP-034 и план FTP-021 B–G описаны в `docs/roadmap/fittracker-v2-roadmap.md`.

**Остановка до утверждения — без изменений рабочего приложения.**