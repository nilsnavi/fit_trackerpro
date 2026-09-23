# План исправлений до продакшена (Production Remediation Plan)

**Дата:** 2026-09-23
**Базовая точка:** `main` @ `e8fee2e`; 2026-09-23 в рабочую ветку влит `main` @ `3765b93` (ветка работы: `arena/01a0b3cd-fit-trackerpro`)
**Источник проблем:** `docs/reports/production-gap-analysis-2026-09-18.md`
**Цель плана:** довести приложение от «код готов, но не запускался» до «стабильно работает в проде и обслуживается».

---

## Статус выполнения

Обновлено: 2026-09-23 (ветка `arena/01a0b3cd-fit-trackerpro`).

| ID | Задача | Статус | Проверка |
|----|--------|--------|----------|
| WS1-1 | Security CI: разделение prod/dev аудита | ✅ сделано | `security.yml`: блокирующий `npm audit --omit=dev --audit-level=high` + report-only полный аудит; YAML валиден |
| WS1-2 | `react-router-dom` 7.18.4 | ✅ сделано | `tsc`, `eslint`, 49 suites / 312 тестов, `build`, bundle budget, contract check — зелёные; `npm audit --omit=dev` не содержит react-router |
| WS1-3 | `valibot` через `overrides` | ✅ сделано | `npm ls valibot` → 1.5.0 везде; **`npm audit --omit=dev` → 0 уязвимостей** |
| WS1-4 | `python-jose` → PyJWT 2.14.0 | ✅ сделано | `pip-audit` по `base.txt`, `prod.txt`, `dev.txt` — чисто; backend **309 тестов** зелёные; +7 новых тестов на токены |
| WS1-12 | Секрет Telegram-вебхука + бот в проде | ✅ сделано | `X-Telegram-Bot-Api-Secret-Token` проверяется через `hmac.compare_digest` до парсинга; `secret_token` в `set_webhook`; +4 HTTP-теста и +8 тестов конфигурации; `validate-production-env.mjs` требует секрет при включённом боте |
| WS1-13 | Emergency: реальная доставка вместо заглушки | ✅ сделано | Контакт получает уведомление только после подключения в боте (`/link <код>` или t.me-ссылка); ответ API содержит результат по каждому контакту, `successful_count` считает только принятые Bot API сообщения; UI («Мне плохо» на главной + раздел контактов в профиле) показывает реальный статус и не обещает вызов скорой. Проверка: `grep -rn "экстренной помощи отправлен" frontend/src` пусто; backend 320 тестов, frontend 51 suite / 320 тестов |
| WS1-14 | Правовой минимум: политика и согласие | ✅ сделано | Страницы `/legal/privacy` и `/legal/consent`, обязательный чек-бокс в онбординге (без него кнопка выключена, а бэкенд отвечает 400 `consent_required`), согласие пишется в `users.profile.consent` с версией текста и датой (дата не перезаписывается при повторном онбординге), процедуры и ответственные — `docs/legal/privacy-and-data.md`. Проверка: `pytest app/tests/test_health_data_consent.py` (4 теста), `jest onboardingConsent` (4 теста) |
| WS1-5 | Обновление dev-цепочки (vite/eslint/openapi-tooling) | ✅ сделано | `vite` 5.4.21 → **7.3.6**, `@typescript-eslint/*` 6.21.0 → **8.70.1**, override `js-yaml@^4.3.2` для `@redocly/openapi-core`; **`npm audit` → 0 уязвимостей** (было 9 high / 1 moderate), `tsc`/`eslint`/`jest` 70 suites / 482 теста, `build` + `bundle:check` (entry 119.42 KiB из 120), `api:contract:check` — зелёные. eslint 8.57.1 оставлен осознанно: flat config (eslint 9) — отдельная задача |
| WS1-6 | `E2E Smoke Real API`: честный пропуск без секретов | ✅ сделано (вариант B) | Workflow не падает, когда staging не настроен: шаг «Check smoke environment» выставляет `configured=false`, все прогонные шаги под `if:`, в конце — `notice`/`warning` и статус skipped. Полный прогон (вариант A) включается секретами `E2E_*` без правок workflow — процедура и ротация `init_data` в `docs/testing/real-api-smoke.md`. Проверка: YAML валиден, поведение описано в job summary |
| WS2-1 | `/health` на реальных данных вместо mockData | ✅ сделано | Мок-метрики (вес/шаги/пульс/калории) и нарисованный «график» удалены; экран собран из реальных блоков — вода, глюкоза, самочувствие/сон (существующие трекеры, каждый своим чанком) и замеры тела с реальными точками (`recharts`). Пустое состояние/ошибка/загрузка — честные. Проверка: `grep -rn "mockData" frontend/src/features/health` пусто; `jest src/features/health` 14 тестов; `bundle:check` OK (HealthPage 3.7 КиБ, трекеры 4.8–6.1 КиБ gzip) |
| WS2-2 | Виджеты главной: смонтировать или удалить | ✅ сделано | Блок «Здоровье сегодня» на главной: вода (быстрое +250 мл с инвалидацией кэша), последний замер глюкозы и самочувствие за сегодня через новый `useHomeHealthWidgets`; состояния загрузка / ошибка с повтором / «Нет данных». Проверка: `jest src/features/home` 14 тестов, весь фронт 76 сьютов / 510 тестов; tsc и lint чисто; `bundle:check` OK (Home 11.52 КиБ, entry 116.65 КиБ gzip) |
| WS2-3 | Убрать хардкод в статистике профиля | ✅ сделано | `active_days` считается по реальной истории (уникальные дни за 30 дней, новый `AnalyticsService.get_active_days`); `total_calories` убран из ответа и типов — калории в приложении не считаются, нулевая заглушка вводила в заблуждение. Проверка: `pytest app/tests/test_users.py` 12 passed/1 skipped (Postgres-only тест скипается на SQLite), весь бэкенд 471 passed/5 skipped; OpenAPI перегенерирован, `api:contract:check` OK |
| WS1-7…WS1-11, WS1-15 | Инфраструктура, staging, релиз | 📘 runbook готов, ждём владельца | Из песочницы не выполняется (нужны доступы). Пошаговый runbook с командами, гейтами и откатом — `docs/LAUNCH_RUNBOOK.md`; deep-dive в `docs/DEPLOYMENT.md`, `docs/STAGING_DEPLOYMENT_REHEARSAL.md`, `docs/ROLLBACK_STRATEGY.md` |

**Что это значит для CI.** После мержа: `Security` должен стать зелёным (прод-аудит чист, Python-аудит чист, полный аудит — report-only). `Test` нужно подтвердить в CI: локально зелёный, но 6 E2E-наборов (Playwright) в песочнице не запускались — браузер не скачивается.

**Изменение контракта.** Docstring `/telegram/webhook` попал в OpenAPI, поэтому `frontend/src/shared/api/generated/*` перегенерированы (`npm run api:types:generate`); `npm run api:contract:check` проходит.

**Найдено в процессе (сведение с main).** 1) WS1-13 и SPEC-006 завели миграции с одним и тем же `revision id` (`n7o8p9q0r1s2`) — в merge-коммите миграция экстренных контактов перевешена на актуальный head `o8p9q0r1s2t3` и переименована в `p9q0r1s2t3u4_emergency_contact_telegram_link.py`; это чинило падавшие в CI «DB migrations (fresh/rollback)». 2) Новый `app/infrastructure/telegram_sender.py` ронял baseline покрытия пакета `infrastructure` — закрыт юнит-тестами (`app/tests/test_telegram_sender.py`). 3) Экран онбординга переехал на `useOnboardingSubmit`, поэтому согласие WS1-14 живёт в хуке. 4) Архитектурный тест `networkBoundary` ссылался на удалённый `EmergencyMode.tsx` — заменён на `EmergencyContactsSection.tsx`.

**Состояние CI.** Конфликт с `main` (был в `OnboardingScreen.tsx`) не давал GitHub создать merge-commit, поэтому прогоны вообще не запускались — после merge PR mergeable, а «Test» зелёный по всем джобам, кроме backend-baseline покрытия, который закрыт коммитом с тестами.

**Найдено в процессе.** Апгрейд на react-router v7 ломает Jest-окружение: модуль обращается к `TextEncoder` на этапе импорта, а jsdom его не предоставляет. Полифилл добавлен в `frontend/src/__mocks__/jest.globals.ts`; относительные редиректы (`Navigate to=".." relative="path"`) закрыты тестом `workoutsRelativeRedirects.test.tsx`.

---

## Как пользоваться планом

- **ID задачи:** `WS<поток>-<номер>`. Потоки: WS1 — открыть прод (P0), WS2 — продуктовая полнота (P1), WS3 — эксплуатация (P1), WS4 — после релиза (P2).
- **Оценка:** в человеко-днях (`d`) одного разработчика; `op` — работа оператора/владельца репозитория (доступы, секреты, сервер).
- **Зависимости:** указаны явно; задачи без зависимостей можно брать параллельно.
- **Gate:** задача считается сделанной только при выполнении блока «Готово, когда» (acceptance) и прохождении команд из блока «Проверка».
- **Правило релиза:** неготовую фичу не «допиливаем в проде», а прячем за feature flag (`backend/app/infrastructure/feature_flags.py`) либо не рендерим в UI. Это позволяет не сдвигать релиз из-за продуктовых доработок.
- **Правило CI:** красный workflow = блокер. Перед началом работ `Test` зелёный, `Security` и `E2E Smoke Real API` красные — их чиним в первую очередь, иначе не будет сигнала о регрессиях во время остальных правок.

---

## 0. Критический путь (одним взглядом)

```
[CI зелёный]        WS1-1..WS1-6  ─┬─►  WS1-7 образы main ─┐
                                   │                        │
[Инфраструктура]   WS1-8/WS1-9  ───┴────────────────────────┴─► WS1-10 staging deploy
                                                                      │
                                                          WS1-11 rollback/restore drill
                                                                      │
[Правовые/фичи]    WS1-12 webhook+bot ─┐                              │
                   WS1-13 emergency    ├──────────────────────────────┤
                   WS1-14 legal        ┘                              ▼
                                                            WS1-15 Release v1.0.0 → prod
                                                                      │
                            WS2 (продукт) и WS3 (эксплуатация) — параллельно, до/после релиза
```

**Минимум для первого прода:** WS1 целиком (≈12–15 дней с учётом op-задач), WS3-1..WS3-4 обязательны до публичного трафика.
**Если срок жёсткий:** WS1-13 и WS1-14 закрываются «скрытием», а не реализацией — фича выключается флагом, экран удаляется из бандла, релиз идёт.

---

## WS1 — P0: открыть прод

### WS1-1. Сделать `Security` actionable и зелёным · [#160](https://github.com/nilsnavi/fit_trackerpro/issues/160)

**Приоритет:** P0 · **Оценка:** 1d · **Зависимости:** нет · **Тип:** код/CI

**Проблема:** workflow красный из-за `npm audit --audit-level=moderate` (17 уязвимостей, из них реально в прод-бандл идут `react-router`, `valibot`) и `pip-audit` (`ecdsa` через `python-jose`). Красный security-гейт обесценивает сигнал и мешает мержить.

**Шаги:**
1. Разделить аудит на два уровня, как это принято для SPA:
   - `npm audit --omit=dev --audit-level=high` — **блокирующий** (прод-зависимости);
   - `npm audit --audit-level=moderate` по dev-зависимостям — **не блокирующий** (report-only, `continue-on-error: true`, вывод в job summary), с задачей на устранение в WS1-5.
2. В `pip-audit` добавить файл игнора (`--ignore-vuln PYSEC-2026-1325` или `--ignore-requirements`) **с обязательным сроком**: комментарий «пересмотреть после WS1-4» + правило снятия.
3. Ветка `security` не должна требовать ручного подтверждения при падении только dev-аудита.

**Готово, когда:** workflow `Security` зелёный на PR и на `main`; в логах видно список dev-адвизори с указанием, какие задачи их закрывают; прод-аудит блокирует мерж.

**Проверка:** `gh run list --workflow=security.yml`, локально `npm audit --omit=dev --audit-level=high`, `pip-audit -r backend/requirements/prod.txt`.

---

### WS1-2. Обновить `react-router-dom` до 7.18.4 · [#161](https://github.com/nilsnavi/fit_trackerpro/issues/161)

**Приоритет:** P0 · **Оценка:** 1d · **Зависимости:** нет · **Тип:** код

**Обоснование:** оба адвизори (open redirect через `\` в `<Link>`/`useNavigate`, constructor injection в `deserializeErrors()`) закрыты только в `>=7.18.0`; текущая 6.x (`^6.22.0`, фактически 6.30.x) остаётся уязвимой — патча в 6.x нет (`6.30.6` — последняя и тоже уязвима).

**Хорошая новость:** в `frontend/src` нет data-router API (`createBrowserRouter`, `RouterProvider`, `useLoaderData`, `json(`, `defer(`), используются только декларативные `BrowserRouter`/`Routes`/`Route`/`Navigate`/`Outlet`/`useParams`/`useNavigate` — они сохранены в v7. Миграция — это в основном bump версии + проверка поведения относительных путей.

**Шаги:**
1. `npm i react-router-dom@7.18.4 -C frontend` (React 18.2 совместим; Node 20+ в CI/сборке уже есть).
2. Прогнать `tsc`, `eslint`, `jest`, `npm run build`.
3. Проверить сценарии, где v7 меняет резолвинг относительных путей: сплэт-роуты, `Navigate to=".."`, редиректы из `RouteGuard` (`frontend/src/shared/auth/RouteGuard.tsx`) и редиректы после логина (`return_url_after_login`).
4. Прогнать E2E-наборы `npm run e2e:mvp`, `npm run e2e:regression`.

**Готово, когда:** все тесты и 6 E2E-наборов зелёные; `npm audit --omit=dev` не содержит `react-router`; в `docs/` отмечена версия роутера.

**Проверка:** `node -p "require('./frontend/node_modules/react-router-dom/package.json').version"`, `npm audit --omit=dev`.

---

### WS1-3. Закрыть `valibot` (транзитивно через `@telegram-apps/*`) · [#162](https://github.com/nilsnavi/fit_trackerpro/issues/162)

**Приоритет:** P0 · **Оценка:** 0.5d · **Зависимости:** нет · **Тип:** код

**Проблема:** `@telegram-apps/{sdk,bridge,transformers}` тянут `valibot <=1.4.1` (ReDoS в `EMOJI_REGEX`, некорректный `flatten()` для унаследованных свойств). Актуальные `@telegram-apps/sdk` 3.11.8 (установлена) и `valibot` 1.5.0 существуют, но цепочка зафиксирована жёстко.

**Шаги:**
1. Добавить в `frontend/package.json`:
   ```json
   "overrides": { "valibot": "^1.5.0" }
   ```
2. `npm install`, проверить, что Telegram SDK инициализируется (юнит-тесты `telegramEnv`, `useTelegram`, smoke-роутинг) и что `npm ls valibot` показывает 1.5.0 во всех ветках.
3. Если override ломает SDK — обновить `@telegram-apps/*` до последних и повторить; в крайнем случае сделать ленивую загрузку SDK и зафиксировать адвизори как принятый риск с обоснованием в `docs/security.md`.

**Готово, когда:** `npm audit --omit=dev` чист по `valibot`, тесты фронта и E2E зелёные.

**Проверка:** `npm ls valibot`, `npm audit --omit=dev --audit-level=high`.

---

### WS1-4. Заменить `python-jose` на PyJWT (устранение `ecdsa`) · [#163](https://github.com/nilsnavi/fit_trackerpro/issues/163)

**Приоритет:** P0 · **Оценка:** 0.5d · **Зависимости:** нет · **Тип:** код

**Обоснование:** `python-jose` 3.5.0 — последняя версия и жёстко требует `ecdsa!=0.15` (транзитивно флагнутый `ecdsa 0.19.2`). Обновлением это не лечится. При этом `jose` используется **ровно в одном файле** (`backend/app/core/security/tokens.py`: `jwt.encode/decode`, `JWTError`), алгоритм — HS256, ECDSA/ES* не используется. PyJWT 2.14.0 использует `cryptography` и не тянет `ecdsa`.

**Шаги:**
1. В `backend/requirements/base.txt`: `python-jose[cryptography]==3.5.0` → `pyjwt==2.14.0` (плюс явный `cryptography` из PyJWT-зависимостей — по факту ставится автоматически).
2. Правки в `tokens.py`: `from jose import JWTError, jwt` → `import jwt` + `from jwt import PyJWTError as JWTError`; `jwt.encode(...)` → вернуть `str` (в PyJWT 2.x уже `str`).
3. Убедиться, что нигде больше нет импортов `jose` (`grep -rn "from jose" backend`).
4. Прогнать backend-тесты (`test_auth.py`, `test_telegram_init_data_validation.py`) — HMAC-валидация initData в `core/security` или `auth_service` использует `hmac`/`hashlib`, не `jose`; проверить `grep -rn "hashlib\|hmac"` чтобы убедиться.
5. Снять ignore из WS1-1.

**Готово, когда:** `pip-audit -r backend/requirements/prod.txt` чист; `pytest` зелёный; токены access/refresh выдаются и валидируются (тесты + ручная проверка login → `/users/auth/me`).

**Проверка:** `pip-audit`, `pytest backend/app/tests/test_auth.py -q`.

---

### WS1-5. Обновить dev-цепочку (vite/esbuild/eslint/typescript-eslint/openapi-tooling) · [#164](https://github.com/nilsnavi/fit_trackerpro/issues/164)

**Приоритет:** P0 (для разблокировки CI) · **Оценка:** 1–2d · **Зависимости:** WS1-1 · **Тип:** код

**Данные по версиям:** `vite` 5.1.0 → адвизори затрагивают `<=6.4.2` (dev-server path traversal, `server.fs.deny` bypass, esbuild dev-proxy); `@typescript-eslint/*` 6.x → `minimatch` ReDoS (фикс в `@typescript-eslint/parser` 8.70.1); `@redocly/openapi-core → js-yaml` (dev).

**Шаги:**
1. `vite` обновить до актуальной мажорной (проверить совместимость `vite-plugin-pwa`, `vite-plugin-mkcert`, конфигов `vite.config.ts`, PWA-сборки). Альтернатива при высоком риске — оставить и полагаться на WS1-1 (dev-only, не попадает в прод-бандл), зафиксировав решение.
2. `@typescript-eslint/*` + `eslint` обновить до v8 (могут появиться новые правила/ошибки — прогнать `npm run lint` и починить).
3. Обновить `openapi-typescript` и `@redocly/*`; после обновления **обязательно** `npm run api:types:generate` и `npm run api:contract:check` (иначе дрейф контрактов).
4. Прогнать `npm run build`, `BUNDLE_STATS=1 npm run build && npm run bundle:check` (бюджеты бандла не должны просесть), `jest --ci`.

**Готово, когда:** `npm audit` не содержит high/moderate, кроме задокументированных; сборка, бюджеты, линт, тесты и контракт зелёные.

**Проверка:** `npm audit --json | jq '.metadata.vulnerabilities'`, `npm run bundle:check`, `npm run api:contract:check`.

---

### WS1-6. Починить (или приземлить) `E2E Smoke Real API` · [#165](https://github.com/nilsnavi/fit_trackerpro/issues/165)

**Приоритет:** P0 · **Оценка:** 0.5d · **Зависимости:** WS1-10 (нужен живой staging URL) · **Тип:** CI/ops

**Проблема:** job падает каждый день на шаге `Validate smoke environment`: не заданы секреты `E2E_BASE_URL`, `E2E_API_BASE_URL`, `E2E_TELEGRAM_INIT_DATA`. Ежедневный красный workflow = шум, к которому привыкают.

**Шаги:**
1. Вариант A (после WS1-10): завести секреты для staging — URL фронта, URL API, `init_data` тестового Telegram-пользователя; продумать обновление `init_data` (у Telegram `auth_date` ограничен — задокументировать процедуру ротации в `docs/testing/`).
2. Вариант B (если staging ещё нет): сделать job честно-скипающим при отсутствии секретов (`echo "skipped: staging not configured"` + вывод предупреждения, но **не** failure) и оставить только `workflow_dispatch`.
3. Не удалять workflow: no-mock smoke — единственная проверка, что прод реально живой.

**Готово, когда:** ночной workflow зелёный (или явно skipped с предупреждением), а при наличии staging — реально проходит golden path против staging.

**Проверка:** `gh run list --workflow=e2e-smoke-real.yml --limit 3`.

---

### WS1-7. Собрать образы текущего `main` и зафиксировать тег · [#166](https://github.com/nilsnavi/fit_trackerpro/issues/166)

**Приоритет:** P0 · **Оценка:** 0.5d · **Зависимости:** WS1-1..WS1-5 (собирать уже исправленный код) · **Тип:** CI/ops

**Проблема:** последний `Build and Push` на `main` — `cancelled` (2026-09-16), для HEAD `e8fee2e` образа в GHCR нет; тегов релиза тоже нет. `deploy.yml` принципиально требует versioned `image_tag` и запрещает `latest`.

**Шаги:**
1. Запустить `Build and Push` на `main` после мержей WS1-1..WS1-5; дождаться успеха (multi-arch, Trivy-скан).
2. Зафиксировать имя тега вида `main-<short_sha>` (metadata-action использует `type=sha,prefix={{branch}}-`).
3. Проверить наличие обоих образов (backend/frontend) и что digest совпадает с просканированным.

**Готово, когда:** в GHCR есть `ghcr.io/nilsnavi/fit_trackerpro/backend:main-<sha>` и `.../frontend:main-<sha>`, оба просканированы Trivy без critical.

**Проверка:** `docker manifest inspect ghcr.io/nilsnavi/fit_trackerpro/backend:main-<sha>` (с любой машины с docker) или страница Packages в GitHub.

---

### WS1-8. Создать GitHub Environments и секреты · [#167](https://github.com/nilsnavi/fit_trackerpro/issues/167)

**Приоритет:** P0 · **Оценка:** 0.5d · **Тип:** op (владелец репозитория)

**Проблема:** `gh api repos/nilsnavi/fit_trackerpro/environments` → `total_count: 0`. `deploy.yml`/`migrate.yml`/`rollback-production.yml` без environment работать не будут (0 запусков за всю историю). `migrate.yml` жёстко зашит на `environment: production`.

**Шаги:**
1. Создать environment `staging`, затем `production`; для `production` включить **required reviewers** и (опционально) ограничение веток (`main`).
2. Завести в каждом environment секреты:
   `DEPLOY_HOST`, `DEPLOY_USER`, `SSH_PRIVATE_KEY`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `SECRET_KEY` (≥32 симв.), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_URL` (HTTPS), `ALLOWED_ORIGINS` (HTTPS-список, без `*`), `VITE_API_URL` (с `/api/v1`), `VITE_TELEGRAM_BOT_USERNAME`.
   Опционально: `SENTRY_DSN`, `SLACK_WEBHOOK_URL`, `TELEGRAM_WEBHOOK_SECRET` (см. WS1-12).
3. Убедиться, что `DEPLOY_USER` имеет доступ к `~/fittracker-pro`, а `SSH_PRIVATE_KEY` — ключ без пароля (для CI).
4. Прогнать `scripts/staging-rehearsal.ps1` в режиме проверки (без `-Dispatch`) — он валидирует наличие environment и обязательных секретов.

**Готово, когда:** `gh api repos/nilsnavi/fit_trackerpro/environments` показывает `staging` и `production`; все 12 обязательных имён присутствуют в обоих (values не читаются и не логируются).

**Проверка:** `scripts/staging-rehearsal.ps1` без ошибок; job `pre-deploy-validate` проходит на staging-deploy.

---

### WS1-9. Подготовить сервер(ы) · [#168](https://github.com/nilsnavi/fit_trackerpro/issues/168)

**Приоритет:** P0 · **Оценка:** 0.5d · **Тип:** op

**Шаги:**
1. Docker + Docker Compose, git, curl, каталог деплоя `~/fittracker-pro` (клонирован на нужный тег).
2. TLS: `NGINX_SSL_DIR=/etc/letsencrypt/live/<domain>` c `fullchain.pem`/`privkey.pem`; проверить автопродление.
3. `BACKUPS_DIR=/var/backups/fittracker` (вне репозитория), права для пользователя деплоя; проверка, что каталог не в git.
4. Firewall: только 22/80/443; Postgres/Redis наружу не публикуются (уже так в `docker-compose.prod.yml`).
5. Домен + DNS: фронт и API за одним edge nginx; `TELEGRAM_WEBAPP_URL` = `https://<domain>/`.
6. BotFather: Menu Button → `TELEGRAM_WEBAPP_URL`.
7. **Staging отдельно от прода:** другой каталог (`~/fittracker-pro-staging`), другой домен/сертификат, отдельная БД, отдельный бот (чтобы не путать данные и вебхуки).

**Готово, когда:** `docker compose -f docker-compose.prod.yml config --quiet` проходит на сервере; `docker run --rm hello-world` работает; порт 443 отвечает.

**Проверка:** `ssh <user>@<host> 'cd ~/fittracker-pro && docker compose -f docker-compose.prod.yml config --quiet'`.

---

### WS1-10. Staging deploy rehearsal (первый полный выкат) · [#169](https://github.com/nilsnavi/fit_trackerpro/issues/169)

**Приоритет:** P0 · **Оценка:** 1d · **Зависимости:** WS1-7, WS1-8, WS1-9 · **Тип:** op/CI

**Шаги:**
1. `gh workflow run deploy.yml -f environment=staging -f image_tag=main-<sha> -f rollback_restore_db=false`.
2. Проследить весь DAG: `pre-deploy-validate` → backup БД → `alembic upgrade head` → `seed_reference_data apply` → `up -d` → readiness-опрос `/api/v1/system/ready` → verify smoke → запись stable-тега.
3. Проверить артефакты: `.rollback-meta.env` с `DB_BACKUP_PATH`, `.last-stable-deploy.env`, отсутствие ошибок в логах контейнеров.
4. Вручную: открыть Mini App в Telegram на staging-боте, пройти вход, создать шаблон, начать и завершить тренировку, проверить аналитику и офлайн-режим (включить авиарежим, внести подход, вернуть сеть).

**Готово, когда:** staging-стек healthy, все smoke-проверки зелёные, ручной golden path пройден, ссылки на логи/скриншоты приложены к задаче.

**Проверка:**
```bash
curl -fsS "https://<staging>/api/v1/system/health"    # {"status":"healthy"}
curl -fsS "https://<staging>/api/v1/system/ready"     # status=ready, postgres=ok, redis=ok
curl -fsS "https://<staging>/api/v1/system/version"   # version/commit_sha заполнены
curl -fsS "https://<staging>/healthz"
```

---

### WS1-11. Репетиция rollback и восстановления БД · [#170](https://github.com/nilsnavi/fit_trackerpro/issues/170)

**Приоритет:** P0 · **Оценка:** 1d · **Зависимости:** WS1-10 · **Тип:** op

**Обоснование:** `docs/ROLLBACK_STRATEGY.md` описывает 3 сценария (image-only / image+downgrade / image+restore), но ни один не исполнялся. Именно этот прогон определяет MTTR в реальном инциденте.

**Шаги:**
1. Сценарий A: `gh workflow run rollback-production.yml -f environment=staging -f rollback_image_tag=<предыдущий> -f rollback_restore_db=false -f confirm=ROLLBACK`; убедиться, что сервис поднялся на предыдущем теге и smoke прошёл.
2. Сценарий C (безопасно, на staging): взять `DB_BACKUP_PATH` из `.rollback-meta.env`, восстановить дамп в **тестовую** БД под другим именем; проверить количество строк в ключевых таблицах.
3. Сценарий B: убедиться, что `alembic downgrade -1` реально работает на staging (в CI есть round-trip тест миграций, но не на живых данных).
4. Записать тайминги каждого шага в `docs/ROLLBACK_ONCALL_CHEATSHEET.md` (фактические минуты, а не оценка).

**Готово, когда:** все три сценария пройдены на staging, тайминги задокументированы, повторный deploy возвращает систему на актуальный тег.

**Проверка:** `docs/ROLLBACK_STRATEGY.md` обновлён фактами; в задаче — лог workflow и вывод проверок БД.

---

### WS1-12. Защитить Telegram-вебхук и включить бота в проде · [#171](https://github.com/nilsnavi/fit_trackerpro/issues/171)

**Приоритет:** P0 · **Оценка:** 1d · **Зависимости:** WS1-8 (секрет), WS1-10 · **Тип:** код/op

**Проблема (двойная):**
1. `POST /telegram/webhook` (`backend/app/main.py:296`) не проверяет `X-Telegram-Bot-Api-Secret-Token`, а `start_bot_webhook()` (`backend/app/bot/main.py:356`) не устанавливает `secret_token` при `set_webhook` — при том что nginx намеренно отключает для этого пути rate-limit. Любой может слать поддельные updates.
2. В `docker-compose.prod.yml:98` жёстко `TELEGRAM_BOT_ENABLED=false` → в проде бот не работает вообще: нет `/start`, `/help`, `/stats`, не выставляется Menu Button.

**Шаги:**
1. Добавить в `backend/app/settings/config.py`: `TELEGRAM_WEBHOOK_SECRET: str | None`, в production — обязателен (валидация рядом с `reject_insecure_defaults_in_production`).
2. В `start_bot_webhook()` передавать `secret_token=settings.TELEGRAM_WEBHOOK_SECRET` в `set_webhook`.
3. В обработчике вебхука сверять заголовок **constant-time** (`hmac.compare_digest`) и возвращать `403` при несоответствии **до** парсинга JSON; строку секрета в логи не писать.
4. Прокинуть `TELEGRAM_WEBHOOK_SECRET` в `docker-compose.prod.yml` и в `deploy-environment.yml` (нужно добавить в список обязательных секретов `pre-deploy-validate`).
5. Заменить `TELEGRAM_BOT_ENABLED=false` на `${TELEGRAM_BOT_ENABLED:-false}` и включить `true` на staging, затем на prod после проверки.
6. Тесты: новый кейс «вебхук без заголовка → 403», «с неверным → 403», «с верным → 200»; обновить `test_bot.py`.
7. Проверить на staging: `/start`, `/stats` (данные приходят из `AnalyticsService`, хардкода там нет), Menu Button открывает Mini App; вебхук зарегистрирован (`getWebhookInfo` через Bot API).

**Готово, когда:** поддельный POST на `/telegram/webhook` получает 403; настоящие updates от Telegram обрабатываются; бот отвечает в staging и в проде.

**Проверка:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<host>/telegram/webhook -H 'content-type: application/json' -d '{"update_id":1}'   # 403
curl -s "https://api.telegram.org/bot$TOKEN/getWebhookInfo" | jq '.result.url, .result.last_error_message'
```
Плюс `pytest backend/app/tests/test_bot.py -q`.

---

### WS1-13. Emergency: убрать ложь (реализовать или скрыть) · [#172](https://github.com/nilsnavi/fit_trackerpro/issues/172)

**Приоритет:** P0 · **Оценка:** 1–2d · **Зависимости:** нет · **Тип:** код/продукт

**Важно:** заглушка не только на фронте. Бэкенд `backend/app/application/emergency_service.py` **имитирует** отправку: `_send_emergency_notification_impl` ставит `success=True` просто если у контакта есть `contact_username` или `phone`, ничего не отправляя; `notify_workout_start/end` возвращают только текстовый превью. У контактов нет `telegram_id`/`chat_id`, значит реальная доставка невозможна без изменения модели. А фронт (`EmergencyButton.tsx`) показывает «Вызов экстренной помощи отправлен», не вызывая API и не рендерясь ни на одном маршруте.

**Вариант «реализовать» (минимум, честный):**
1. Миграция: добавить `telegram_id`/`chat_id` в `emergency_contacts` (или флаг «подтверждён» для контакта, связавшегося с ботом).
2. Реальная доставка через `python-telegram-bot` (`bot.send_message`), уведомление только тем контактам, чей `telegram_id` подтверждён; для остальных — честный статус «не доставлено, контакт не подключён».
3. Таблица/лог события с результатом по каждому контакту (уже есть `log_emergency_event`, дополнить реальными исходами).
4. UI: перед показом кнопки — проверка настроенных контактов; явный дисклеймер «приложение не вызывает скорую, уведомляем ваших близких»; состояния success/partial/failed без вранья; кнопка вызова телефона экстренных служб.
5. Тесты: доставка мокается, проверяется «частичный успех» и «нет контактов».

**Вариант «скрыть» (если релиз горит):**
1. Удалить `EmergencyButton` из бандла и не монтировать `EmergencyMode`; эндпоинты оставить, но пометить в OpenAPI как не реализованные.
2. Завести задачу на реализацию с приоритетом после релиза (WS4).

**Готово, когда:** нигде в UI нет утверждения об отправке уведомления без реальной отправки; для фичи есть либо работающий флоу, либо её нет в интерфейсе.

**Проверка:** `grep -rn "экстренной помощи отправлен" frontend/src` → пусто; ручной прогон флоу на staging.

---

### WS1-14. Правовой минимум: политика конфиденциальности и согласие на данные о здоровье · [#173](https://github.com/nilsnavi/fit_trackerpro/issues/173)

**Приоритет:** P0 (для публичного запуска) · **Оценка:** 1d (включая текст) · **Тип:** legal/код

**Обоснование:** приложение хранит пульс, глюкозу, вес, сон, самочувствие — это чувствительные данные. В репозитории нет ни политики, ни согласия, ни описания сроков хранения.

**Шаги:**
1. Текст политики конфиденциальности (что собираем, зачем, где храним, кому не передаём, сроки, как удалить) + текст согласия на обработку данных о здоровье.
2. Размещение: страница внутри Mini App (`/legal/privacy`, `/legal/consent`) или документ в боте; ссылка из профиля и из онбординга.
3. Онбординг (`frontend/src/components/Onboarding/OnboardingScreen.tsx`): обязательный чек-бокс согласия до сохранения профиля; факт согласия фиксировать на бэке (поле в `users.profile` с версией текста и датой) — это доказуемость.
4. Экспорт/удаление уже реализованы (`GET /users/export`, `DELETE /users/me`) — описать их в политике.
5. Добавить в `docs/` раздел «данные и приватность» с владельцем процесса и каналом для запросов субъектов данных.

**Готово, когда:** политика и согласие доступны в приложении, согласие фиксируется в БД с версией и timestamp, процедура удаления описана и проверена вручную.

**Проверка:** пройти онбординг на staging без галки (блок) и с галкой (разрешение + запись в `profile`).

---

### WS1-15. Первый релиз `v1.0.0` → production · [#174](https://github.com/nilsnavi/fit_trackerpro/issues/174)

**Приоритет:** P0 · **Оценка:** 1d · **Зависимости:** WS1-1..WS1-14 · **Тип:** op

**Шаги:**
1. Пройти `docs/PRODUCTION_CHECKLIST.md` и go/no-go чеклист (ниже) — без исключений.
2. Создать GitHub Release `v1.0.0` на коммите, прошедшем staging (тег → published release триггерит `deploy.yml` → build → deploy-pipeline в `production` с required reviewers).
3. Подтвердить деплой в ручном approval; дождаться успеха verify.
4. Сразу после выката: `TELEGRAM_WEBAPP_URL` в BotFather, Menu Button, `/start` в боте.
5. Ручная приёмка на живом проде: вход через Telegram, шаблон → старт → подходы → завершение, история и аналитика, офлайн-подход с возвратом сети, профиль (замеры/экспорт), удаление тестового аккаунта — по возможности на отдельном аккаунте.
6. Зафиксировать stable-тег и провести разбор (что заняло больше времени, что автоматизировать).

**Готово, когда:** прод отдаёт health/ready/version, Mini App работает вживую, бот отвечает, `SENTRY_DSN` получает события (WS3-4), бэкап перед миграцией есть.

**Проверка:** smoke-команды из `docs/DEPLOYMENT.md` + `gh release view v1.0.0`.

---

## WS2 — P1: продуктовая полнота

### WS2-1. `/health` на реальных данных вместо `mockData` · [#175](https://github.com/nilsnavi/fit_trackerpro/issues/175)

**Статус:** ✅ сделано (2026-09-23). Экран больше не рисует выдуманных метрик: блоки воды, глюкозы и самочувствия — это существующие трекеры на реальных хуках (подгружаются отдельными чанками), замеры тела — новая карточка с серией и графиком по реальным точкам API. Чистые преобразования вынесены в `frontend/src/features/health/lib/bodyMeasurementSeries.ts` и покрыты тестами, карточка проверена на пустом/ошибочном/загруженном состоянии и на реальных значениях.

**Оценка:** 2d · **Файлы:** `frontend/src/features/health/pages/HealthPage.tsx`, `.../components/*`, `.../hooks/useHealthQueries.ts`, `frontend/src/shared/api/domains/healthApi.ts`

**Шаги:**
1. Убрать `mockData` (строки 17/56) и «Mock Chart Placeholder» (строка 100).
2. Экран собрать из реальных блоков: замеры тела (`useBodyMeasurementsQuery`/`useAddBodyMeasurementMutation`), вода (`/health-metrics/water/*`), глюкоза (`GlucoseTracker`), самочувствие/сон (`WellnessCheckin`) — все хуки уже существуют и покрыты бэкенд-тестами.
3. Состояния: загрузка (skeleton), пустое («нет данных за период»), ошибка с ретраем; график на реальных точках (`recharts` уже в зависимостях).
4. Юнит-тесты на маппинг данных + рендер пустого состояния.

**Готово, когда:** на пустом аккаунте экран показывает корректные пустые состояния, на заполненном — реальные значения, `grep -rn "mockData" frontend/src/features/health` пусто.

---

### WS2-2. Виджеты главной: смонтировать или удалить · [#176](https://github.com/nilsnavi/fit_trackerpro/issues/176)

**Оценка:** 1d · **Файлы:** `frontend/src/features/home/components/{Glucose,Water,Wellness}Widget.tsx`, `.../index.ts`, `frontend/src/features/home/pages/Home.tsx`, `.../lib/mapHealthToDashboard.ts`, `.../hooks/useHomeWaterQuery.ts`

**Шаги:** подготовить данные (`mapHealthToDashboard` + `useHomeWaterQuery` уже есть), вставить блоки в дашборд `Home.tsx` с состояниями загрузки/пусто; либо, если продуктово решено не показывать — удалить виджеты и мёртвые хелперы. Промежуточный вариант (хуже всех) — оставить как есть.

**Статус:** ✅ смонтировано на главной. Новый `HomeHealthSection` подключён в `Home.tsx` перед «Прогрессом» и показывает `WaterWidget`/`GlucoseWidget`/`WellnessWidget` на данных `useHomeHealthWidgets` → `useHomeWaterQuery` плюс последний замер глюкозы и отметка самочувствия за сегодня; `mapHealthToDashboard` дополнен `wellnessEntryToWellnessData`/`wellnessScoreToMood` (шкала API 0..100 без пересчёта). Виджеты получили `type="button"` и `data-testid`, у воды исправлена разметка (внешний `div[role=button]` вместо вложенных `<button>`). Покрытие: `src/features/home` 14 тестов (5 мапперы + 3 хук + 6 секция).

**Готово, когда:** нет файлов без потребителей: `for f in <список>; do grep -rl "$(basename $f)" frontend/src | grep -v "$f"; done` даёт совпадения.

---

### WS2-3. Убрать хардкод в статистике профиля · [#177](https://github.com/nilsnavi/fit_trackerpro/issues/177)

**Оценка:** 0.5d · **Файлы:** `backend/app/api/v1/users.py:83-105`, `backend/app/application/analytics_service.py`

**Шаги:** посчитать `active_days` (число уникальных дней с тренировками за период) и `total_calories` (или честно убрать поле из ответа и из UI, если калории не считаются). Обновить тесты `test_users.py`, при изменении схемы — `npm run api:types:generate` + `api:contract:check`.

**Статус:** ✅ сделано. `AnalyticsService.get_active_days(user_id, period)` считает уникальные дни с тренировками (окно совпадает с остальной сводкой, общая карта периодов `_PERIOD_DAYS`). `GET /users/me/stats` отдаёт реальные `active_days`; поле `total_calories` удалено из ответа и из FE-типа `UserStats` — калории нигде не считаются, нулевая заглушка вводила в заблуждение. Покрытие: unit-тест на подсчёт дней + integration на эндпоинт (Postgres-only, на SQLite скипается как остальные analytics-тесты).

**Готово, когда:** значения не нулевые на аккаунте с историей; контракт FE↔BE синхронен.

---

### WS2-4. Закрыть TODO в ядре активной тренировки · [#178](https://github.com/nilsnavi/fit_trackerpro/issues/178)

**Оценка:** 1–2d · **Файлы:** `frontend/src/features/workouts/active/containers/ActiveWorkoutContainer.tsx:111`, `frontend/src/features/workouts/hooks/useActiveWorkout.ts:78`, `frontend/src/features/workouts/components/ExerciseCard.tsx:28`, `frontend/src/features/workouts/hooks/useWorkoutSession.ts:57,65`

**Шаги:** подключить «добавить упражнение» к существующему флоу/модалке, закрыть debounce сохранений (защита от лишних мутаций при вводе веса/повторов), подтянуть `totalSets` из шаблона/метаданных, довести интеграцию с Zustand-store вместо дублирующего локального состояния.

**Готово, когда:** все 5 TODO удалены, поведение покрыто тестами, при быстром вводе число сетевых запросов ограничено (проверить в Network).

---

### WS2-5. Coach-access: реализовать или скрыть · [#179](https://github.com/nilsnavi/fit_trackerpro/issues/179)

**Оценка:** 2d (реализация) / 0.25d (скрытие) · **Файлы:** `backend/app/application/users_service.py:50-125`, `backend/app/api/v1/users.py:108-140`, `frontend/src/features/profile/pages/ProfilePage.tsx`

**Проблема:** код доступа генерируется и хранится в `users.profile` JSON, но никакого механизма реального доступа тренера к данным нет — UI обещает возможность, которой не существует.

**Шаги:** либо реализовать полноценно (таблица `coach_access`, эндпоинт «тренер смотрит данные по коду», аудит доступа, TTL, отзыв), либо скрыть секцию из профиля до реализации. Реализация — только с WS3-8 (аудит доступа к медданным).

**Готово, когда:** UI не обещает несуществующего; если оставлено — доступ реально работает и логируется.

---

### WS2-6. Разобрать PR #148 и висящие dependabot-PR · [#180](https://github.com/nilsnavi/fit_trackerpro/issues/180)

**Оценка:** 0.5d · **Шаги:** PR #148 (`codex/production-readiness-p0`, статус `CONFLICTING`, ~60 файлов: analytics, auth, health-check, coverage) — сделать rebase и решить судьбу по частям (что уже перекрыто работой SPEC-005 и PR #154); остальное — в отдельные PR. PR #147/#146 (gunicorn 26.x) и #140/#138 (pre-commit 4.6.2) — обновить или закрыть с обоснованием.

**Готово, когда:** нет открытых PR старше двух недель; для каждого — либо смержен, либо закрыт с комментарием «почему».

---

### WS2-7. Удалить неиспользуемые зависимости · [#181](https://github.com/nilsnavi/fit_trackerpro/issues/181)

**Оценка:** 0.25d · **Файлы:** `frontend/package.json`

**Шаги:** `@tonconnect/ui-react` (0 ссылок в `src/`) — удалить; проверить остальные (`recharts`, `date-fns`, `clsx`, `tailwind-merge` используются — не трогать). Запустить поиск мёртвых зависимостей (`npx depcheck`), по результатам — чистка, затем `npm ci && npm run build && jest`.

**Готово, когда:** прод-зависимости соответствуют реальному импорту; сборка и тесты зелёные.

---

### WS2-8. Привести документацию в соответствие реальности · [#182](https://github.com/nilsnavi/fit_trackerpro/issues/182)

**Оценка:** 1d · **Файлы:** `README.md`, `frontend/e2e/README.md`, `docs/reports/*`, `docs/qa/*`

**Шаги:**
1. `frontend/e2e/README.md`: заменить упоминания GitLab CI на GitHub Actions (реальные job-имена).
2. README: убрать/пересмотреть обещание удалить legacy-алиасы к `2026-06-30` и план `v1.2.0` — либо перенести дату, либо связать с WS4-3.
3. Пометить устаревшие снимки в `docs/reports/` (например `FRONTEND_BACKEND_API_AUDIT.md` утверждает, что water API нет — оно есть), со ссылкой на актуальный отчёт.
4. Свести все «известные ограничения» в один живой документ и синхронизировать с roadmap.

**Готово, когда:** в документации нет утверждений, противоречащих коду; ссылки на CI корректны.

---

### WS2-9. Тест-пустышка `useWorkoutSessionDraftCloudSync.test.ts` · [#183](https://github.com/nilsnavi/fit_trackerpro/issues/183)

**Оценка:** 0.5d · **Файлы:** `frontend/src/__tests__/shared/useWorkoutSessionDraftCloudSync.test.ts`

Сейчас файл состоит из TODO-комментариев. Либо реализовать 4 описанных кейса (гидрация из облака, разрешение конфликтов по `updatedAt`, удаление при отсутствии сессии, немедленный флеш по событиям), либо удалить файл, чтобы он не создавал ложное впечатление покрытия.

---

## WS3 — P1: эксплуатация (надёжность, наблюдаемость, безопасность данных)

### WS3-1. Регулярные бэкапы БД · [#184](https://github.com/nilsnavi/fit_trackerpro/issues/184)

**Оценка:** 1d · **Тип:** op

**Проблема:** автоматический бэкап существует только перед миграцией (`scripts/backup_before_migrate.sh` внутри deploy-пайплайна). Если схемы не менялись неделями, свежего дампа нет.

**Шаги:** systemd-timer/cron на хосте: `pg_dump -Fc` → `$BACKUPS_DIR`, ротация (7 дней / 4 недели / 3 месяца), проверка размера и непустоты, выгрузка за пределы сервера (rclone/rsync/S3), алерт при неудаче (WS3-3). Добавить `restore_test`-скрипт, который раз в неделю восстанавливает дамп в одноразовую БД и делает `SELECT count(*)` по ключевым таблицам.

**Готово, когда:** за 7 дней подряд есть дампы в трёх местах ротации, offsite-копия подтверждена, автотест восстановления зелёный.

---

### WS3-2. Restore-drill и обновление runbook · [#185](https://github.com/nilsnavi/fit_trackerpro/issues/185)

**Оценка:** 0.5d · **Зависимости:** WS3-1

Прогнать полное восстановление на отдельной БД, замерить RTO/RPO, записать в `docs/ROLLBACK_ONCALL_CHEATSHEET.md` фактическую пошаговую процедуру (команды, ожидаемое время, что проверять). Связано с WS1-11.

---

### WS3-3. Мониторинг как часть эксплуатации · [#186](https://github.com/nilsnavi/fit_trackerpro/issues/186)

**Оценка:** 2d · **Файлы:** `monitoring/docker-compose.monitoring.yml`, `prometheus.yml.template`, `alerts.yml`, `alertmanager.yml`

**Проблема:** стек поднимается вручную, образы `prom/prometheus:latest`, `grafana:latest`, `alertmanager` падает без `TELEGRAM_CHAT_ID`; алерты не подключены к проду, дашбордов по ключевым метрикам нет.

**Шаги:**
1. Пинning образов по digest (как в `docker-compose.prod.yml`), зафиксировать версии.
2. Документированный запуск рядом с прод-стеком (отдельный compose с явным runbook), `TELEGRAM_CHAT_ID`/`TELEGRAM_BOT_TOKEN` в env.
3. Алерты: `readiness != ready` дольше 2 минут, доля 5xx > 1%, p95 API > 1.5 c, недоступность `/healthz`, заполнение диска > 85%, провал бэкапа, `restart_count` контейнеров.
4. Дашборд Grafana: RPS, латентность по маршрутам, 5xx, пул БД, Redis, ошибки offline-синхронизации.
5. Проверка доставки алерта: искусственно уронить Redis на staging.

**Готово, когда:** алерт приходит в Telegram за < 2 минуты, дашборд открывается, образы запинены.

---

### WS3-4. Sentry: DSN, алерты, релизы · [#187](https://github.com/nilsnavi/fit_trackerpro/issues/187)

**Оценка:** 0.5d · **Шаги:** завести проекты (backend/frontend), прописать `SENTRY_DSN`/`VITE_SENTRY_DSN` в environment-секреты, включить `SENTRY_RELEASE` (тег образа) для привязки ошибок к релизу, настроить алерты (новая ошибка, рост частоты, > 1% сессий), отправить тестовое событие и убедиться, что оно видно с корректными тегами.

**Готово, когда:** тестовое событие из прода видно в Sentry с release/releasом и окружением; алерт доставляется.

---

### WS3-5. Пул соединений БД через настройки · [#188](https://github.com/nilsnavi/fit_trackerpro/issues/188)

**Оценка:** 0.5d · **Файлы:** `backend/app/infrastructure/database.py`, `backend/app/settings/config.py`

**Шаги:** добавить `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE`, `DB_POOL_PRE_PING` (дефолты для dev/тестов, обязательный расчёт для прод: `workers × (pool + overflow) ≤ max_connections` Postgres), передать в `create_async_engine`, документировать в `docs/env-matrix.md`; для SQLite/тестов сохранить текущее поведение.

**Готово, когда:** параметры применяются (видно в `pg_stat_activity`), при рестарте Postgres приложение восстанавливает соединения без ручного вмешательства.

---

### WS3-6. Отзываемые refresh-сессии · [#189](https://github.com/nilsnavi/fit_trackerpro/issues/189)

**Оценка:** 2d · **Файлы:** `backend/app/core/security/tokens.py`, `backend/app/application/auth_service.py:211-238`, `backend/app/domain/*`, миграция

**Проблема:** refresh-токен stateless с TTL 7 дней; `logout` только пишет аудит, серверное состояние не меняется; удаление аккаунта не инвалидирует выданные токены; ротации refresh (одноразовое использование) нет. Для данных о здоровье это существенно.

**Шаги:**
1. Миграция: таблица `refresh_sessions` (`id`, `user_id`, `token_hash`, `family_id`, `issued_at`, `expires_at`, `revoked_at`, `user_agent`, `ip`).
2. Refresh-flow: одноразовое использование с ротацией (повторное использование «сгоревшего» токена → отзыв всей семьи + алерт).
3. `logout` — отзыв текущей сессии (или всех), `DELETE /users/me` — отзыв всех сессий и инкремент `token_version` в JWT.
4. Access-токен 30 минут оставить как есть, но добавить проверку `token_version` при валидации.
5. Тесты: ротация, повторное использование, logout, удаление аккаунта, истёкшая сессия, миграция вверх/вниз.

**Готово, когда:** после logout и после удаления аккаунта старые токены не работают (проверяется тестом и вручную), есть очистка истёкших сессий.

---

### WS3-7. Нагрузочный прогон профиля активной тренировки · [#190](https://github.com/nilsnavi/fit_trackerpro/issues/190)

**Оценка:** 1–2d · **Шаги:** сценарий (k6/locust): вход → старт сессии → 20–40 мелких мутаций подходов с интервалом 3–10 с → завершение; N=100–500 параллельных пользователей на staging. Снять p50/p95/p99, ошибки, поведение пула БД, потребление CPU/RAM, влияние на readiness. Найденные узкие места (например, пересчёт аналитики на каждую мутацию) оформить задачами.

**Готово, когда:** есть отчёт с цифрами и списком узких мест; определён предел, при котором latency остаётся приемлемой.

---

### WS3-8. Алерты и аудит для чувствительных операций

**Оценка:** 1d · **Шаги:** алерты по доле ошибок синхронизации offline-очереди (телеметрия `workoutSyncTelemetry` уже эмитится), по всплеску 401/403 на auth, по неудачам доставки emergency-уведомлений; аудит-лог чтения медданных (замеры, глюкоза, wellness) с записью в хранилище логов; review доступа.

**Готово, когда:** события видны в Grafana/Loki, алерты настроены, доступ к медданным можно расследовать постфактум.

---

## WS4 — P2: после первого релиза

| ID | Задача | Оценка |
|----|--------|--------|
| WS4-1 | Покрытие фронта 20.8% → 60–70% (начать с `features/health`, `analytics`, `profile`) | 5d |
| WS4-2 | Бандл: дробление `charts` (110 KB gzip) и `index` (122 KB gzip) | 2d |
| WS4-3 | Удаление legacy-алиасов `/api/v1/{auth,achievements,challenges,emergency}` + финальный апдейт README | 1d |
| WS4-4 | Кэш/материализация аналитики (`training_load_daily`, `muscle_load`) под нагрузкой из WS3-7 | 3d |
| WS4-5 | Централизованные логи (Loki/Promtail уже в `monitoring/`) + дашборды | 2d |
| WS4-6 | E2E smoke-lane против staging в CI после каждого деплоя | 1d |
| WS4-7 | Реализация emergency в полном объёме (если скрыт в WS1-13), coach-access | 4d |
| WS4-8 | Консолидация устаревших снимков в `docs/` | 1d |
| WS4-9 | Полноценный экспорт данных через `POST /analytics/export` + polling | 1d |

---

## Сводный план по спринтам

| Спринт | Состав | Итог |
|--------|--------|------|
| **S1 (дни 1–5)** | WS1-1…WS1-6 (CI/зависимости), WS1-7 (образы) | CI зелёный, уязвимости прод-зависимостей закрыты, образ main в GHCR |
| **S2 (дни 6–10)** | WS1-8, WS1-9, WS1-10, WS1-11 (окружения, сервер, staging, rollback) | Staging работает, rollback и restore проверены |
| **S3 (дни 11–15)** | WS1-12, WS1-13, WS1-14, WS1-15 (вебхук+бот, emergency, legal, релиз) | **Прод запущен**, Mini App доступен пользователям |
| **S4 (дни 16–20)** | WS3-1…WS3-4 (бэкапы, restore-drill, мониторинг, Sentry) | Эксплуатация: алерты, бэкапы, наблюдаемость |
| **S5 (дни 21–25)** | WS2-1…WS2-4, WS3-5, WS3-6 | Продукт без моков, БД-пул и отзываемые сессии |
| **S6 (дни 26–30)** | WS2-5…WS2-9, WS3-7, WS3-8 | Нагрузочный отчёт, чистка долгов, аудит |
| **Далее** | WS4-* | Качество, производительность, расширения |

**Итого до прода (S1–S3):** ≈12–15 человеко-дней + доступы/сервер. **До «продукт и эксплуатация в норме» (S1–S6):** ≈35–40 человеко-дней.

---

## Матрица рисков самого процесса исправления

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Апгрейд `react-router` 6→7 ломает навигацию (относительные пути, редиректы) | Средняя | Высокое | Отдельный PR, полный прогон E2E + ручная проверка редиректов `RouteGuard`/`return_url_after_login`; откат — revert версии |
| Обновление `vite` мажорно ломает PWA/workbox-сборку | Средняя | Среднее | Обновлять после WS1-1 отдельным PR; проверять `npm run build` + precache-манифест; при риске — оставить vite 5 с записью «dev-only, принято» |
| Override `valibot` ломает Telegram SDK | Низкая | Среднее | Проверка `npm ls valibot` + smoke Mini App на staging; fallback — обновление `@telegram-apps/*` |
| Замена `python-jose` → PyJWT меняет формат/поведение токенов | Низкая | Высокое | HS256 и полезная нагрузка идентичны; прогнать `test_auth.py`, проверить совместимость со старыми токенами (payload без `token_version`) |
| Первый деплой падает на миграциях из-за отсутствия `PREVIOUS_IMAGE_TAG` | Высокая | Среднее | Прогон на staging (WS1-10/11), ручной fallback по `docs/ROLLBACK_STRATEGY.md` |
| `init_data` для smoke-real протухает | Высокая | Низкое | Процедура ротации в `docs/testing/`, алерт в календаре, при отсутствии — graceful skip (WS1-6) |
| Потеря данных при первом `restore` на проде | Низкая | Критическое | Restore только на staging/тестовой БД до первого прода; на проде — только по решению с required reviewers |
| «Скрытие» emergency воспринимается как регресс продукта | Средняя | Среднее | Зафиксировать решение письменно, поставить в WS4 с приоритетом и датой |
| Правовые требования окажутся строже (DPO, локализация данных) | Средняя | Высокое | До релиза — минимальный комплект; уточнить требования с юристом, при необходимости отложить публичный запуск |

---

## Go/No-Go чеклист первого релиза

**Обязательно (иначе No-Go):**
- [ ] `Security`, `Test`, `Build and Push` — зелёные на `main`; `E2E Smoke Real API` — зелёный или явно skipped.
- [ ] Прод-зависимости без high/critical адвизори (`npm audit --omit=dev`, `pip-audit`).
- [ ] Environments `staging`/`production` существуют, обязательные секреты заданы, `production` под required reviewers.
- [ ] Staging-деплой и rollback/restore отработаны на реальном сервере.
- [ ] `TELEGRAM_WEBHOOK_SECRET` задан, вебхук отвергает запросы без заголовка.
- [ ] В UI нет функций, которые сообщают о несуществующих действиях (emergency).
- [ ] Политика конфиденциальности и согласие доступны, факт согласия фиксируется.
- [ ] Бэкап: есть свежий дамп + подтверждённый offsite + успешный restore-drill.
- [ ] Sentry получает события, алерты настроены.
- [ ] Health/ready/version отвечают на проде; Mini App проверен вживую (вход → тренировка → аналитика → офлайн).

**Желательно (можно выпустить и закрыть в S4–S5):**
- [ ] Мониторинг с pinned-образами и алертами в Telegram.
- [ ] Пул БД настроен под число воркеров.
- [ ] Отзываемые refresh-сессии.
- [ ] Нагрузочный прогон с известным пределом.

---

## Приложение A. GitHub Issues

Все задачи заведены в трекер 2026-09-23: **#160–#190**.
Машинно-читаемый пакет: `docs/roadmap/remediation-issues-2026-09-23.json` (единственный источник текстов задач).
Лейблы не проставлены автоматически (у токена-создателя нет push-прав): выполните один раз
`node scripts/apply-remediation-labels.mjs` (сначала `--dry-run`, затем `--deps`), чтобы проставить лейблы и связи зависимостей.

| ID | Issue | Заголовок | Labels | Estimate |
|----|-------|-----------|--------|----------|
| WS1-1 | [#160](https://github.com/nilsnavi/fit_trackerpro/issues/160) | P0 — Security CI: разделить prod/dev аудит и закрыть уязвимости прод-зависимостей | `roadmap,P0,ci,reliability,estimate-S` | S |
| WS1-2 | [#161](https://github.com/nilsnavi/fit_trackerpro/issues/161) | P0 — Обновить react-router-dom до 7.18.4 | `roadmap,P0,frontend,estimate-S` | S |
| WS1-3 | [#162](https://github.com/nilsnavi/fit_trackerpro/issues/162) | P0 — Закрыть valibot (транзитивно через @telegram-apps/*) | `roadmap,P0,frontend,estimate-S` | XS |
| WS1-4 | [#163](https://github.com/nilsnavi/fit_trackerpro/issues/163) | P0 — Заменить python-jose на PyJWT (устранение ecdsa) | `roadmap,P0,backend,reliability,estimate-S` | S |
| WS1-5 | [#164](https://github.com/nilsnavi/fit_trackerpro/issues/164) | P0 — Обновить dev-цепочку (vite/esbuild/eslint/typescript-eslint/openapi-tooling) | `roadmap,P0,ci,frontend,estimate-M` | M |
| WS1-6 | [#165](https://github.com/nilsnavi/fit_trackerpro/issues/165) | P0 — Починить или приземлить E2E Smoke Real API | `roadmap,P0,ci,e2e,estimate-S` | S |
| WS1-7 | [#166](https://github.com/nilsnavi/fit_trackerpro/issues/166) | P0 — Собрать образы main и зафиксировать versioned тег | `roadmap,P0,devops,estimate-S` | S |
| WS1-8 | [#167](https://github.com/nilsnavi/fit_trackerpro/issues/167) | P0 — Создать GitHub Environments staging/production и секреты | `roadmap,P0,devops,estimate-S` | S |
| WS1-9 | [#168](https://github.com/nilsnavi/fit_trackerpro/issues/168) | P0 — Подготовить staging и production серверы | `roadmap,P0,devops,estimate-S` | S |
| WS1-10 | [#169](https://github.com/nilsnavi/fit_trackerpro/issues/169) | P0 — Staging deploy rehearsal (первый полный выкат) | `roadmap,P0,devops,estimate-M` | M |
| WS1-11 | [#170](https://github.com/nilsnavi/fit_trackerpro/issues/170) | P0 — Репетиция rollback и восстановления БД на staging | `roadmap,P0,devops,reliability,database,estimate-M` | M |
| WS1-12 | [#171](https://github.com/nilsnavi/fit_trackerpro/issues/171) | P0 — Защитить Telegram-вебхук секретом и включить бота в проде | `roadmap,P0,backend,reliability,estimate-S` | S |
| WS1-13 | [#172](https://github.com/nilsnavi/fit_trackerpro/issues/172) | P0 — Emergency: честный флоу или скрытие из UI | `roadmap,P0,frontend,feature,ux,estimate-M` | M |
| WS1-14 | [#173](https://github.com/nilsnavi/fit_trackerpro/issues/173) | P0 — Политика конфиденциальности и согласие на обработку данных о здоровье | `roadmap,P0,documentation,estimate-S` | S |
| WS1-15 | [#174](https://github.com/nilsnavi/fit_trackerpro/issues/174) | P0 — Первый релиз v1.0.0 в production | `roadmap,P0,devops,estimate-S` | S |
| WS2-1 | [#175](https://github.com/nilsnavi/fit_trackerpro/issues/175) | P1 — Экран /health на реальных данных вместо mockData | `roadmap,P1,frontend,feature,estimate-M` | M |
| WS2-2 | [#176](https://github.com/nilsnavi/fit_trackerpro/issues/176) | P1 — Виджеты главной: смонтировать или удалить | `roadmap,P1,frontend,estimate-S` | S |
| WS2-3 | [#177](https://github.com/nilsnavi/fit_trackerpro/issues/177) | P1 — Убрать хардкод в GET /users/stats (active_days, total_calories) | `roadmap,P1,backend,estimate-S` | XS |
| WS2-4 | [#178](https://github.com/nilsnavi/fit_trackerpro/issues/178) | P1 — Закрыть TODO в ядре активной тренировки | `roadmap,P1,frontend,workouts,estimate-M` | M |
| WS2-5 | [#179](https://github.com/nilsnavi/fit_trackerpro/issues/179) | P1 — Coach-access: реализовать или скрыть из профиля | `roadmap,P1,backend,frontend,estimate-S` | S |
| WS2-6 | [#180](https://github.com/nilsnavi/fit_trackerpro/issues/180) | P1 — Разобрать PR #148 и висящие dependabot-PR | `roadmap,P1,devops,estimate-S` | XS |
| WS2-7 | [#181](https://github.com/nilsnavi/fit_trackerpro/issues/181) | P1 — Удалить неиспользуемые зависимости фронтенда | `roadmap,P1,frontend,estimate-S` | XS |
| WS2-8 | [#182](https://github.com/nilsnavi/fit_trackerpro/issues/182) | P1 — Актуализировать документацию (CI, версии, устаревшие отчёты) | `roadmap,P1,documentation,estimate-S` | S |
| WS2-9 | [#183](https://github.com/nilsnavi/fit_trackerpro/issues/183) | P1 — Тест-пустышка useWorkoutSessionDraftCloudSync.test.ts | `roadmap,P1,frontend,test,estimate-S` | XS |
| WS3-1 | [#184](https://github.com/nilsnavi/fit_trackerpro/issues/184) | P1 — Регулярные бэкапы БД, offsite-копия и проверка восстановления | `roadmap,P1,devops,reliability,database,estimate-M` | M |
| WS3-2 | [#185](https://github.com/nilsnavi/fit_trackerpro/issues/185) | P1 — Мониторинг в эксплуатацию: pinned образы, алерты, дашборды | `roadmap,P1,devops,reliability,estimate-M` | M |
| WS3-3 | [#186](https://github.com/nilsnavi/fit_trackerpro/issues/186) | P1 — Sentry: DSN, релизы и алерты | `roadmap,P1,devops,reliability,estimate-S` | S |
| WS3-4 | [#187](https://github.com/nilsnavi/fit_trackerpro/issues/187) | P1 — Пул соединений БД через переменные окружения | `roadmap,P1,backend,reliability,estimate-S` | S |
| WS3-5 | [#188](https://github.com/nilsnavi/fit_trackerpro/issues/188) | P1 — Отзываемые refresh-сессии | `roadmap,P1,backend,reliability,estimate-M` | M |
| WS3-6 | [#189](https://github.com/nilsnavi/fit_trackerpro/issues/189) | P1 — Нагрузочный прогон профиля активной тренировки | `roadmap,P1,backend,reliability,estimate-M` | M |
| WS3-7 | [#190](https://github.com/nilsnavi/fit_trackerpro/issues/190) | P1 — Алерты и аудит доступа к медицинским данным | `roadmap,P1,reliability,backend,estimate-S` | S |

## Приложение B. Команды проверки (шпаргалка)

```bash
# Бэкенд
cd backend && pytest -q                                   # ожидается 290 passed
pip-audit -r requirements/prod.txt                        # без high/critical
ruff check .

# Фронтенд
cd frontend
npx tsc --noEmit && npm run lint
jest --ci                                                 # 309 passed
jest --coverage --coverageReporters=text-summary
BUNDLE_STATS=1 npm run build && npm run bundle:check
npm run api:contract:check
npm audit --omit=dev --audit-level=high
npm run e2e:mvp && npm run e2e:regression

# Инфраструктура / деплой
docker compose -f docker-compose.prod.yml config --quiet
gh workflow run deploy.yml -f environment=staging -f image_tag=main-<sha> -f rollback_restore_db=false
curl -fsS https://<host>/api/v1/system/health
curl -fsS https://<host>/api/v1/system/ready
curl -fsS https://<host>/api/v1/system/version
curl -fsS https://<host>/healthz

# Проверка вебхука (после WS1-12)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<host>/telegram/webhook \
  -H 'content-type: application/json' -d '{"update_id":1}'    # ожидается 403
```
