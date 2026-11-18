# FTP-030 — Архитектура нового Premium PWA (Athlete + Coach)

**Статус:** Proposed — требуется утверждение.  
**Основа:** FTP-020 (аудит), PR #268 (merged), утверждённый вариант B.  
**Область работ:** архитектура и планирование; **без изменений рабочего приложения, backend, БД и деплоя**.

## 1. Решение и ключевое расхождение

**Вариант B означает новую frontend-точку входа и независимый исходный код приложения**, а не только косметический рефакторинг существующего `frontend/src`.

FTP-020/существующий `docs/architecture/fittracker-v2-target.md` описывают в основном эволюцию старого frontend. Это полезный запасной вариант A, но он **не выполняет буквально утверждённую стратегию B**. Настоящий SPEC предлагает новый `apps/pwa-v2/` с переиспользованием **проверяемых контрактов, алгоритмов и UI-примитивов** через выделенные, тестируемые пакеты/адаптеры.

Результат этапа архитектуры — решение о структуре; код в рамках FTP-030 не создаётся.

## 2. Подтверждённая база и ограничения

- Существующий backend: FastAPI `/api/v1`, PostgreSQL, Redis, Alembic; модели, entitlements и Coach API сохраняются.
- Старый frontend: React/TypeScript/Vite, TanStack Query, Zustand, Telegram SDK, Workbox, Jest/Playwright.
- PR #268 уже merged в `main`: графитово-лаймовые токены, локальный Manrope, адаптивная оболочка и email-auth. Использовать как **референс**, не предполагать автоматическую совместимость.
- Active Workout state machine/хуки, алгоритмы прогрессии, offline/idempotency и API-обёртки — кандидаты на reuse, **не переносить слепым копированием**.
- `/users/coach-access` возвращает 501 по аудиту: экран персонального прогресса чужого клиента запрещён до завершения отдельного API/consent.
- Backend Schedule API отсутствует по аудиту: нельзя показывать фиктивное расписание как работающее.
- `design-references/premium-ui/` отсутствует по аудиту: отсутствие референса блокирует пиксельную UI-приёмку, но не разработку архитектуры.

## 3. Варианты и решение

| Критерий | A — рефакторинг старого frontend | B — новый frontend + reuse |
| --- | --- | --- |
| Изоляция регрессий | ниже: правки старого дерева | выше: отдельная точка входа/сборка |
| Скорость первого экрана | потенциально быстрее | первоначальные затраты на bootstrap/адаптеры |
| Риск дублирования бизнес-логики | низкий | высокий без package-boundaries |
| Чистота дизайна/маршрутов | ограничения legacy shell | независимая система |
| Сосуществование и rollback | feature flags в том же frontend | самостоятельный staging/origin, простой rollback маршрутизации |
| Утверждённая стратегия | не соответствует B | **выбрано B** |

Не переносить новые premium-экраны в старый `frontend/src` как основной путь. PR FTP-021 B–G не запускать автоматически: требуется перепланирование под отдельный app.

## 4. Целевая структура (план, не существующие файлы)

```text
fit_trackerpro/
├── frontend/                    # СТАРОЕ приложение; сохраняется без изменения на старте
├── apps/
│   └── pwa-v2/                  # НОВОЕ React + TS + Vite PWA
│       ├── src/
│       │   ├── app/             # bootstrap, route tree, layouts, providers, feature flags
│       │   ├── domains/
│       │   │   ├── athlete/     # screens, page composition, forms
│       │   │   ├── coach/       # screens, program and client views
│       │   │   └── workouts/    # presentation/adapters to workout core
│       │   ├── shared/
│       │   │   ├── ui/          # Premium UI primitives
│       │   │   ├── auth/        # web/Telegram adapters
│       │   │   ├── api/         # typed gateway to /api/v1
│       │   │   └── offline/     # persistence and one sync engine
│       │   └── styles/         # tokens + accessibility + themes
│       ├── public/              # manifest, icons
│       └── e2e/
├── packages/                    # Вводить только по доказанной необходимости
│   ├── api-contract/            # OpenAPI generated types / contract tests
│   └── workout-core/            # чистая переносимая state machine без зависимостей от DOM/Telegram
├── backend/                     # KEEP
├── database/                    # KEEP
├── design-references/premium-ui/ # Эталон, не включать в сборку
└── docs/
```

Пакеты `packages/*` — **целевой вариант**, не обязательный немедленный монорепо-рефакторинг. Если извлечение старых хуков требует существенной переработки, применить thin adapters, а не переносить связанный UI целиком.

### Правила зависимостей

- `app → domains → shared → api-contract/workout-core`; обратные импорты запрещены.
- Ни одна domain-страница не вызывает `fetch`/Axios напрямую: только typed API gateway.
- TanStack Query = серверное состояние; Zustand = локальный UI/workout draft.
- Вся бизнес-авторизация — на FastAPI; UI hide/show не является контролем доступа.
- Исходные компоненты старого приложения не импортируются по глубоким путям (например, `../../../frontend/src/...`). Reuse разрешён после выделения стабильного публичного интерфейса и тестов.
- Идемпотентность мутирующих workout-команд сохраняется при рестарте и повторной синхронизации.
- Все тексты UI — по-русски; i18n-ready.

## 5. UX-модули и границы

### Athlete

1. Overview: сводка реальных показателей; Start Workout как основной CTA.
2. Workout: set editor (вес, повторения, RPE/RIR), rest timer, progressive overload, session restore.
3. Programs: текущие шаблоны и назначенные тренером планы.
4. Progress: история/объём/PR/графики; отсутствие server data — честный empty/error.
5. Account: профиль, настройки, безопасность, consent.

### Coach

1. Overview: только реальные агрегаты и собственные клиенты.
2. Clients: приглашения, состояние отношений, разрешения.
3. Programs: builder, assignments, progress в рамках доступных данных.
4. Monitoring: только данные, доступные через backend-authorized endpoints.
5. Schedule: **disabled/feature-gated до отдельного backend-контракта**.
6. Billing/entitlements: существующие backend проверки; новые платежи только отдельным SPEC.

### Visual system

Сохранить утверждённый стиль Graphite + Lime + Manrope; семантические токены без хардкод-цветов на доменных страницах, минимум 44×44 px для основных мобильных элементов, WCAG AA контраст, responsive mobile/desktop, reduced motion. Telegram theme — явный адаптер, без навязывания Telegram цветов независимому веб-PWA.

## 6. API-матрица: факты из FTP-020 и архитектурные требования

| Экран/возможность | API семейство | Статус для v2 | Правила |
| --- | --- | --- | --- |
| Web/TG login | `/api/v1/users/auth/*` | reuse, проверить OpenAPI | email OTP + Telegram initData; не смешивать identities |
| Athlete overview | `/api/v1/users/*`, `/api/v1/analytics/*` | reuse; композиция | реальные данные/empty states |
| Active Workout | `/api/v1/workouts/*` | reuse с проверкой exact endpoints | Idempotency-Key; restore; offline |
| Templates | `/api/v1/workouts/templates*` | reuse | проверять ownership |
| Exercise catalog | `/api/v1/exercises/*` | reuse | кеш справочников |
| Analytics | `/api/v1/analytics/*` | reuse c ограничениями | не имитировать отсутствующие muscle views |
| Coach clients/invitations | `/api/v1/coach/clients*`, `/coach/invitations*` | reuse | COACH + entitlement + relationship |
| Coach programs/assignments | `/api/v1/coach/programs*`, `/coach/assignments*` | reuse | strict server RBAC |
| Coach client progress | `/api/v1/users/coach-access*` | **BLOCKED: 501** | отдельный SPEC, consent, audit, negative tests |
| Coach schedule | API отсутствует в FTP-020 | **BLOCKED** | отдельный backend SPEC/migration; UI скрыть |
| Payments | provider API не утверждён | **LATER** | sandbox, webhooks signatures, idempotency |

**Важно:** wildcard-пути выше — семейства маршрутов из аудита, не доказательство точных методов. До реализации Codex обязан сделать матрицу HTTP methods/path/request/response из актуального OpenAPI.

## 7. Auth, RBAC, consent и security

- Web login и Telegram login используют единый backend identity с подтверждённой привязкой аккаунтов, без автоматического объединения по совпадающему имени/email.
- Web сессии не требуют Telegram SDK; TG SDK и initData используются только в Mini App.
- Клиентские роли: UI отрисовка и навигация; серверные `COACH`, relationship, entitlement и consent — единственные источники полномочий.
- При отзыве доступа/смене аккаунта очищать query cache, локальную очередь и персональные drafts соответствующего пользователя.
- Health/glucose/medical данные по умолчанию не попадaют в offline Coach cache. Для доступа нужны явное согласие, аудит чтения, минимальные scope и отрицательные тесты.
- Access/refresh handling: использовать текущие механизмы backend; включить test cases logout, expiry, rotation, account switching; документированный 30-минутный промежуток access-token после logout вынести в security blocker assessment.

## 8. Offline-first

- Offline shell: manifest + Service Worker после первого успешного запуска.
- Persist: IndexedDB с версией схемы, user partition, TTL, quota handling и очисткой при logout.
- **Один** серверно-идемпотентный queue engine; миграция из legacy очереди — отдельный тестируемый этап.
- Rest timer и workout draft продолжают функционировать без сети; синхронизация после восстановления с отображением pending/failed/conflict.
- Не обещать reliable background sync при закрытом iOS PWA или Telegram Mini App; visibility/online runner обязателен.
- Модель конфликтов по типам операций (append set, edit set, cancel, finish); **нельзя** применять универсальный last-write-wins к тренировочным операциям без проверки инвариантов.
- E2E: offline set → restart → reconnect → exactly one server-side record; не терять pending queue при обновлении SW.

## 9. План сосуществования и отката

1. Старое `frontend/` + API остаются в production на текущих маршрутах.
2. Новое `apps/pwa-v2` запускается на **отдельном staging origin** или path с проверенной service worker scope; отдельный SW/manifest/cache prefix.
3. Backend общие API; обязательно проверить CORS, auth cookies/tokens, CSRF assumptions, redirect и email callback origin.
4. Ни один миграционный PR не меняет production routing. Backend additions — backwards-compatible и проверяются обоими frontend.
5. Pilot cohort — добровольный opt-in, наблюдение за API errors/sync duplicates/crashes.
6. Cutover только после полного gate; rollback = переключение маршрута на старый frontend, без разрушения данных или несовместимых миграций.

## 10. ADR

- **ADR-030-01 (Proposed):** independent `apps/pwa-v2` instead of in-place `frontend/src` rewrite. Reason: соответствует варианту B и изолирует риск.
- **ADR-030-02 (Proposed):** keep FastAPI/Postgres/Redis and existing `/api/v1`. Reason: зрелые backend-контракты и данные.
- **ADR-030-03 (Proposed):** extract/adapter workout core after tests, not copy UI components. Reason: избежать регрессии state machine.
- **ADR-030-04 (Proposed):** single queue engine with idempotency; no optimistic claims about closed-app background sync.
- **ADR-030-05 (Proposed):** Coach data exclusively server-authorized, explicit consent for sensitive data.
- **ADR-030-06 (Proposed):** independent staging origin, no early production route switch.

Все ADR остаются Proposed до утверждения владельцем.

## 11. План небольших PR (без merge/deploy в рамках FTP-030)

| PR | Содержание | Условия готовности |
| --- | --- | --- |
| V2-00 | Bootstrap нового `apps/pwa-v2`, tooling, scripts, CI | build/lint/typecheck/CI; старый frontend без изменений |
| V2-01 | Premium tokens/UI primitives, adaptive shell, mobile navigation | screenshots, contrast, mobile/Desktop; reference доступен |
| V2-02 | Auth adapters + API contracts/query client | web+TG sign-in tests, role/security negative tests |
| V2-03 | Athlete overview, programs and analytics (read-only) | реальные данные, offline/empty/error |
| V2-04 | Workout core adapter, active workout, draft/recovery | E2E idempotency, disconnect/reconnect, timer |
| V2-05 | Coach clients, monitoring, programs (существующие API) | roles, relation/revoke, entitlements |
| V2-06 | Backend Coach access API + consent (отдельный SPEC) | security audit, 401/403/404, OpenAPI, pytest |
| V2-07 | Coach schedule API + UI (отдельный SPEC) | migration round trip, CRUD E2E, conflict tests |
| V2-08 | Queue consolidation + PWA hardening | offline regression, migration, no duplicate sets |
| V2-09 | Pilot/release candidate, QA, rollout plan | full CI, real devices, rollback drill |

Payments/monetization предлагается отдельной фазой после стабильного Athlete + Coach MVP.

## 12. QA-матрица / acceptance gates

- Новый frontend является независимой сборкой и запускается без старого `frontend/src` в runtime.
- Старое приложение остаётся рабочим и неизменённым на первом этапе.
- Нет демоданных и неработающих CTA в production.
- Разделение спортсмен/тренер: UI + 401/403 на backend, запрет доступа к чужим данным.
- Active workout: start → sets → RPE/RIR → rest → finish → history, восстановление черновика и offline replay без дублей.
- Telegram Mini App, веб-логин, logout/refresh и смена учётной записи покрыты сценариями.
- PWA install/update/offline на Chrome Android, iOS Safari и Telegram (с документированными ограничениями).
- Минимальные проверки: typecheck, lint, unit, build, API contract drift, E2E desktop/mobile; backend pytest/миграции для API PR.
- Performance: budget first-load JS/CSS, Lighthouse mobile, мониторинг ошибок; пороги согласовать после baseline.
- Git: каждый PR отдельно, без автоматического merge/deploy; изменения БД только с миграциями и downgrade.

## 13. Открытые решения и блокеры

| ID | Вопрос | Следующее действие |
| --- | --- | --- |
| B1 | Нет распакованного UI-эталона | предоставить архив в рабочую среду; commit только как reference |
| B2 | Coach access 501 | отдельная спецификация на ownership/permissions/consent/audit |
| B3 | Нет Schedule backend | отдельная спецификация, до этого feature gate |
| B4 | Старые и новые auth/session при общем API | cross-origin security plan и integration test |
| B5 | Извлечение workout state machine | dependency audit и spike до V2-04 |
| B6 | FTP-020 документы описывают вариант A | согласовать ADR-030-01 и затем обновить roadmap |
| B7 | Billing/payment provider | вне первого MVP, отдельное коммерческое решение |

## 14. Итоговая точка утверждения

Рекомендуется **утвердить ADR-030-01** (реально новый frontend) и отдельный pipeline V2-00–V2-09, **пока не запускать FTP-021 PR B**. До одобрения архитектуры не создавать `apps/pwa-v2`, не выполнять миграции, деплой или merge.
