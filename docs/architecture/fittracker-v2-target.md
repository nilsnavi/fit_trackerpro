# FitTracker Pro 2.0 — Целевая архитектура (Athlete + Coach Premium)

**Дата:** 2026-11-18
**Статус:** черновик для утверждения (FTP-020)
**Связь:** `docs/reports/FTP-020-audit-report.md`, `docs/roadmap/fittracker-v2-roadmap.md`
**Стратегия:** новый/эволюционирующий frontend, существующий backend и БД.

---

## 1. Принципы

1. **Backend — source of truth** для данных, авторизации, RBAC, монетизации.
2. **Frontend — единый Premium Design System** на токенах; без второй дизайн-системы.
3. **Server state** — TanStack Query; **локальный UI-state** — Zustand.
4. **Офлайн** — единая очередь мутаций с idempotency; persisted server state.
5. **Поэтапная эволюция**: ни один PR не ломает существующие сценарии Athlete/Coach.
6. **Контракт `/api/v1`** — генерируется и проверяется CI; типы не правятся вручную.
7. Все пользовательские тексты — русский; адаптив mobile (iPhone/Android) + desktop;
   состояния focus/loading/empty/error/offline/reduced motion.

---

## 2. Контуры

### 2.1 Frontend (React 19 + Vite 7 + TypeScript)

```
frontend/src/
├── app/                        # shell и bootstrap (существует)
│   ├── AppRoot.tsx, App.tsx
│   ├── layouts/AppShell.tsx    # premium adaptive shell (A: готово, B: доводка)
│   ├── providers/              # QueryProvider, TelegramProvider, ThemeProvider,
│   │                           # HealthCheckGate, SyncQueueRunner, IncompleteWorkoutGate
│   └── routes/AppRoutes.tsx    # Athlete tree + Coach tree (вложенный)
├── features/
│   ├── athlete/                # НОВОЕ: premium-страницы спортсмена (композиция)
│   │   ├── pages/              # Overview, Trainings, Programs, Progress
│   │   ├── components/
│   │   └── hooks/
│   ├── coach/                  # СУЩЕСТВУЕТ (расширяется Schedule в PR E/F)
│   ├── workouts/               # СУЩЕСТВУЕТ — state machine KEEP, presentation PR C
│   ├── analytics/              # СУЩЕСТВУЕТ — premium presentation
│   ├── home/                   # СУЩЕСТВУЕТ — источник метрик для athlete overview
│   ├── health/ profile/ auth/ exercises/ achievements/ emergency/ legal/ telegram/
├── shared/
│   ├── api/                    # client, domains, generated (KEEP)
│   ├── offline/                # SyncQueueEngine (KEEP; консолидация legacy очереди)
│   ├── ui/                     # KEEP; расширение токенами
│   ├── styles/
│   │   ├── tokens.css          # Premium Design System (единый источник)
│   │   └── globals.css         # подключение токенов, telegram adapter
│   ├── auth/ hooks/ lib/ errors/ config/ types/ stores/
└── stores/                     # Zustand (KEEP)
```

### 2.2 Backend (FastAPI — без архитектурной замены)

- Слои `api/v1 → application → domain → infrastructure` сохраняются.
- Новые возможности добавляются **в существующие bounded contexts**:
  - Coach access (G1) — новый сервис/репозиторий доступа к данным клиента;
  - Schedule (G2) — домен встреч/событий тренера;
  - Payments (G3) — сервис платёжного провайдера за entitlement-сервисом;
  - Athlete Premium (G4) — каталог планов по образцу coach-подписки.
- **RBAC:** role `COACH` в `user_roles` + feature-flag `coach` + `require_active_coach_client`
  + entitlement checks. Новые разрешения — только server-side, с тестами негативных кейсов.

### 2.3 Данные

- PostgreSQL 15 + Redis 7; Alembic (head `s11_2_email_auth`).
- Новые таблицы только через новые миграции с непустым `downgrade()` и CI round-trip.
- Health-данные: аудит чтения + consent обязательны; coach-доступ к ним — отдельный
  контролируемый контракт (G1).

### 2.4 Premium Design System (единый источник)

| Слой | Что содержит | Файл |
|---|---|---|
| Raw tokens | graphite/lime/surfaces/radius/type/shadow/spacing | `styles/tokens.css` (`:root`, `.dark`) |
| Semantic tokens | `bg-background`, `bg-surface`, `bg-card`, `bg-muted`, `text-foreground/hint`, `accent` (lime), `primary` | `tailwind.config.js` |
| Telegram adapter | `--tg-theme-*` → semantic (light/dark), селектор `[data-telegram='true']` | `globals.css` |
| Premium shell | `[data-app-shell][data-telegram='false']` — графит, сайдбар, Manrope | `globals.css:680-846` (расширить) |
| Motion | prefers-reduced-motion | `globals.css` |

Правила: запрет хардкод-hex на страницах (grep-гейт), все компоненты `shared/ui` —
только через токены, без второй дизайн-системы.

---

## 3. Ключевые решений по доменам

### 3.1 Active Workout (Athlete core)

- **KEEP:** state machine, hooks (`useActiveWorkoutSync`, `useWorkoutSetWrites`,
  `useRestTimer`, `useProgressionRecommendation`), store-черновики, sync/idempotency,
  RPE/RIR, rest timer, weight recommendation, завершение/восстановление, offline-очередь.
- **CHANGE (PR C):** только presentation components и модалки под премиум-дизайн.
- **Критерий:** старт → нагрузка → подходы → отдых → сохранение/завершение → история;
  прерывание сети → восстановление → без дублей (покрыто E2E + unit).

### 3.2 Athlete dashboard (PR B)

- Метрики рассчитываются **из серверных данных** (`/analytics/*`, `/users/stats`,
  `/workouts/history*`, `/progression/*`), либо явный empty state.
- Кнопка «Начать тренировку» → существующий рабочий сценарий (StartWorkoutSheet).
- Без mock-данных и нерабочих CTA.

### 3.3 Programs & Analytics (PR D)

- Реальные шаблоны, история, прогресс из существующих `/api/v1` endpoints.
- Отсутствующие muscle-load views — отдельная миграционная задача, не фронтенд-имитация.

### 3.4 Coach (PR E–F)

- **Read-only (E):** dashboard, клиенты, мониторинг, программы — существующие контракты.
- **Mutations/backend (F):** G1 coach-access, G2 schedule, G3 payments — каждый с отдельным
  SPEC + миграция + тесты. Серверная авторизация проверяет принадлежность клиента тренеру
  и границы организаций.
- Клиентская изоляция: `coach_clients` (статус, permissions), частичный unique index;
  мониторинг только своих клиентов; чтение медданных — с аудитом и consent.

### 3.5 Монетизация

- Coach: существующие FREE/TRAINER_PRO + entitlements; добавить платёжного провайдера (G3).
- Athlete Premium (G4): каталог планов + entitlements по образцу coach.
- Paywall-механика `EntitlementPaywall` — переиспользуется.

---

## 4. Офлайн-синхронизация (v2)

- **Единая очередь:** legacy `offlineQueue` → `SyncQueueEngine` (dedupeKey, idempotencyKey,
  backoff, cap). Распространение на coach-операции (assign/start day).
- **Background Sync API** в SW как progressive enhancement; `SyncQueueRunner`
  (15с/online/visibility) — основной путь для Telegram Mini App.
- **Persist scope** расширяется: analytics summary, coach snapshot (с TTL и stale-меткой);
  чувствительные медданные — с осторожностью (не кешировать без TTL).
- **Конфликты:** server-authoritative last-write-wins по `updated_at` + idempotency;
  `conflictResolution.ts` сохраняется.

---

## 5. Миграция и параллельная работа

| Фаза | main (prod) | Ветки | Выход |
|---|---|---|---|
| 0 (сейчас) | текущий продукт | `feature/ftp-020-architecture-audit` (docs) | аудит утверждён |
| 1 | PR A уже в main (#268) | — | premium shell |
| 2 | стабильно | FTP-021 B–D (athlete) | premium athlete |
| 3 | стабильно | FTP-021 E (coach read-only) | premium coach |
| 4 | стабильно | FTP-021 F + FTP-032/033 (backend: G1–G3, athlete premium, offline v2) | монетизация + RBAC |
| 5 | стабильно | FTP-021 G + FTP-034 (QA/release) | release candidate |

Правило: каждый PR проходит QA gates (typecheck/lint/test:ci/build/contract/coverage/E2E
по scope) перед merge; полный E2E + реальные устройства — на кандидата релиза.

---

## 6. Что НЕ меняется

- Backend слои, JWT/Telegram auth, rate limits, idempotency, OpenAPI-контракт.
- Active Workout state machine, sync, draft, timers.
- Пользовательские данные и схема БД (без новых миграций до согласованных SPEC).
- CI gates и security policy.
- Health/achievements/emergency/telegram домены (представление может меняться, домен — нет).

---

## 7. Согласование

Целевая архитектура принимается после ревью. Изменения к ней — через ADR.