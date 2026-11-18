# FitTracker Pro 2.0 — Roadmap FTP-030–FTP-034 (Premium Athlete + Coach)

**Дата:** 2026-11-18
**Статус:** черновик для утверждения (FTP-020)
**Связь:** `docs/reports/FTP-020-audit-report.md`, `docs/architecture/fittracker-v2-target.md`
**Зависит от:** FTP-020 (аудит), FTP-021 PR A (готов, #268)

---

## 1. Контекст

Premium PWA для Athlete + Coach строится на существующем backend и БД. Аудит (FTP-020)
подтвердил: Coach-платформа реализована полноценно; главные гэпы — Coach-доступ к данным
клиента (G1), расписание встреч (G2), платёжный провайдер (G3), Athlete Premium (G4) и
консолидация офлайн-очереди. Frontend развивается эволюционно.

## 2. Зависимости между задачами

```
FTP-020 (аудит, done)
   │
   ├── FTP-021 B–D (athlete premium UI)        ← требует эталон premium-ui (B1)
   ├── FTP-021 E  (coach read-only UI)
   ├── FTP-030 (Premium Design System завершение) ← можно параллельно с B
   │
   ├── FTP-031 (Coach backend: G1 coach-access + RBAC) ← блокирует coach-прогресс клиента
   ├── FTP-032 (Coach backend: G2 schedule + G3 payments) ← блокирует Schedule UI и монетизацию
   ├── FTP-033 (Athlete Premium G4 + офлайн v2) ← после G3 (платежи), офлайн параллельно
   │
   └── FTP-034 (QA, performance, release candidate) ← после B–E и F(backend)
```

## 3. Задачи

### FTP-030 — Premium Design System завершение + Athlete dashboard foundation

- **Цель:** выделить единый токеновый слой, закончить премиум-оболочку, заложить
  athlete dashboard как композицию существующих данных.
- **Содержание:**
  - Вынести Premium Design System в `shared/styles/tokens.css` (graphite/lime/surfaces/type);
    `tailwind.config.js` + `globals.css` подключают токены; grep-гейт на хардкод-цвета.
  - Расширить `shared/ui` (Button/Card/Badge/EmptyState/StatCard) токенами — без второй
    дизайн-системы.
  - Довести `AppShell`/`Navigation`/`AppShellHeader` до эталона (desktop sidebar,
    mobile bottom nav, Telegram shell, active workout banner).
  - `features/athlete` scaffold: Overview-страница из существующих хуков
    (`/users/stats`, `/analytics/summary`, последняя тренировка, StartWorkoutSheet).
  - Empty/loading/error/offline/reduced-motion состояния.
- **Критерий готовности:** typecheck/lint/test:ci/build green; `premium-shell.spec.ts`
  обновлён; Overview без mock-данных; скриншоты desktop/mobile.
- **Оценка:** M (3–5 дней). **Зависимости:** FTP-021 PR A (done), эталон premium-ui (B1).
- **Риск:** дублирование данных между home и athlete overview → переиспользовать
  `features/home` hooks, не копировать.

### FTP-031 — Coach backend: доступ к данным клиента (G1) + RBAC

- **Цель:** реализовать `/users/coach-access*` (сейчас 501) с серверной проверкой
  принадлежности клиента тренеру и границами прав.
- **Содержание:**
  - SPEC (контракт, ownership, permissions, аудит, consent).
  - Модель/расширение `coach_clients.permissions` (read-only по умолчанию; доступ к
    workouts/analytics/health — отдельные скоупы; consent клиента).
  - Эндпоинты: чтение истории/аналитики/прогресса клиента тренером; аудит чтения
    (по образцу `_audit_health_read`).
  - Негативные кейсы: чужой клиент → 403/404; клиент с revoke/paused → отказ;
    entitlements (TRAINER_PRO) для расширенного мониторинга.
  - OpenAPI-генерация + committed artifacts; pytest (ownership, RBAC, rate limit).
- **Критерий готовности:** `api:contract:check:committed` green; pytest coach-access
  green; сервер — единственный authority.
- **Оценка:** L (5–10 дней). **Зависимости:** нет backend-блокеров; контракт-гейт.
- **Риск:** утечка чувствительных данных → строгие negative-тесты + аудит + consent.

### FTP-032 — Coach backend: расписание встреч (G2) + платежи (G3)

- **Цель:** контракт для Coach Schedule; подключение платёжного провайдера.
- **Содержание:**
  - SPEC G2: домен `coach_meetings` (или расширение tasks) — миграция (непустой
    downgrade), CRUD, слоты, статусы, напоминания (через `coach_notifications`),
    клиентская видимость. `api:types:generate` + pytest.
  - SPEC G3: интеграция платёжного провайдера (выбор: Telegram Stars / YooKassa / Stripe —
    **открытое решение №1**). Абстракция за `coach_entitlement_service`; вебхуки +
    idempotency; безопасная обработка; rollback.
- **Критерий готовности:** schedule API покрыт тестами; payments — security review,
  webhook-валидация, idempotency; CI green.
- **Оценка:** XL (10–15 дней). **Зависимости:** FTP-031 (основа доступа); решение по провайдеру.
- **Риск:** compliance/security платежей → выделенный security review, sandbox-тесты.

### FTP-033 — Athlete Premium (G4) + Offline v2

- **Цель:** монетизация спортсменов; консолидация офлайн-очереди.
- **Содержание:**
  - Athlete подписка: каталог планов + entitlements по образцу coach
    (`CoachSubscription` → `AthleteSubscription`); paywall-механика; интеграция с G3.
  - Offline v2: миграция legacy `offlineQueue` → `SyncQueueEngine` (тесты миграции,
    coverage), Background Sync API как progressive enhancement, расширение persist-scope
    (analytics summary, coach snapshot), конфликт-резолюция last-write-wins.
  - Аналитика монетизации: базовая отчётность (не критично для MVP).
- **Критерий готовности:** подписка покупается/валидируется на сервере; offline v2
  без дублей; unit/E2E (offline, sync) green.
- **Оценка:** L (5–10 дней). **Зависимости:** G3 (платежи), FTP-030 (design).
- **Риск:** регрессия офлайна → держать оба механизма до полного покрытия тестами.

### FTP-034 — QA, performance, release candidate

- **Цель:** стабильный релиз Premium Athlete + Coach.
- **Содержание:**
  - E2E: `athlete-overview.spec.ts`, `coach-premium.spec.ts`, обновление
    workout-flows/mobile; прогон всего suite (desktop + mobile android/ios + TG Mini App).
  - Performance: bundle-бюджеты, lazy-чанки premium-страниц, Lighthouse на мобильных.
  - PWA: install/update/offline сценарии; реальные устройства (Android Chrome, iOS Safari,
    Telegram Mini App); известное ограничение sync при закрытом приложении — в docs.
  - Создать `CHANGELOG.md` (по формату `final-changelog-and-roadmap-2026-04-06.md`),
    обновить docs/README, KNOWN_LIMITATIONS; скриншоты в PR-описание.
  - Релиз-кандидат: runbook deploy, rollback-план, smoke на staging.
- **Критерий готовности:** полный QA suite green; документация обновлена; релиз одобрен.
- **Оценка:** M (3–5 дней) + время на устройства. **Зависимости:** FTP-030–033.

---

## 4. Порядок выполнения (рекомендуемый)

1. FTP-030 (Design System + athlete foundation) — параллельно FTP-031 (backend coach-access).
2. FTP-021 PR B–D (athlete UI) — после FTP-030 и эталона premium-ui.
3. FTP-031 → FTP-021 PR E (coach read-only UI).
4. FTP-032 → FTP-021 PR F (coach schedule/mutations UI).
5. FTP-033 (athlete premium + offline v2).
6. FTP-034 (QA/release) — на кандидата.

Каждый шаг — отдельные PR, merge после green QA gates.

---

## 5. Критерии приёмки (общие)

- Пользователь проходит существующие сценарии без потери данных/функций.
- Athlete + Coach следуют единому премиум-дизайну на mobile/desktop.
- Тот же роутер и API-клиент; нет дублирующей бизнес-логики из прототипа.
- Нет mock-данных в production UX, нет неработающих CTA.
- Coach-права валидирует backend; клиенты изолированы.
- PWA install/update/offline не деградируют.
- Локальные тесты, сборка и E2E green либо задокументированы блокеры.
- Обновлены changelog и документация; PR содержит скриншоты, риски и rollback.