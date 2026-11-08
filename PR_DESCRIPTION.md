# Frontend audit: дедуп IA, токены, deadcode-гейт и CI-харденинг

> Ветка: `feat/coach-sprint-10.1-review` → `main` · **16 коммитов** · 165 файлов, +10 070 / −11 995 (относительно точки форка `f87af84`; после слияния с актуальным main coach-часть диффа схлопнется — см. «План слияния»)
> Открыть PR: https://github.com/nilsnavi/fit_trackerpro/pull/new/feat/coach-sprint-10.1-review
> Либо: `gh pr create --base main --head feat/coach-sprint-10.1-review --body-file PR_DESCRIPTION.md`

## TL;DR

Четыре смысловые части:

1. **Coach-фича** (`808fdec`, `e6f7129`, `cbb7c22`) — идентичность тренера, связи «тренер–клиент», токен-безопасность, E2E. **Уже смёржена в main под другими SHA** (`da7feb2`, `835e88e`, `edb15f2`) — контент ветки посимвольно вошёл в main (проверено по каждому хунку), поэтому после слияния эта часть не добавит диффа. В истории ветки остаётся как происхождение кода.
2. **Чистка фронтенда** (`7cb03d7`, `31c153c`) — дедупликация экранов прогресса/здоровья, хардкод-цвета → дизайн-токены, −6 700 строк недостижимого кода (66 модулей). Вид интерфейса не менялся.
3. **Deadcode-гейт** (`e4854e5`, `2a589bb`, `a7b308b`, `688b864`) — reachability-анализатор стал постоянным CI-барьером с sanity-проверкой контракта.
4. **CI/тестовая инфра** (`434de4d`, `bdad4ff`, `7e549b1`, `56f9c87`, `c647d45`, `9a1d385`, `45b9a6f`) — сетевой гард в юнит-тестах, фикс флака routing.smoke, оживший осиротевший сюит, новый воркфлоу линтера workflows (strict YAML + actionlint) и починка двух «тихо умерших» воркфлоу, сломанных dependabot-мержами.

---

## 1. Coach: идентичность тренера и клиенты — уже в main

- Домен: `coach_profile`, `coach_invitation`, `coach_client` (+ аудит-события); API `/coach/*`: профиль, приглашения, привязка клиентов, разделение прав через `deps/coach.py`
- Ревью-фиксы (`cbb7c22`): resolve приглашения **GET→POST** (токен — bearer-секрет, убран из query/логов; схема `CoachInvitationResolve`), `current_only=True` в `get_for_coach` (ACTIVE∪PAUSED с детерминированным order-by вместо `active_only`), запрет явного `null` для не-null полей `CoachProfileUpdate`, терминальные связи рендерятся как история без ссылок, +4 интеграционных теста (postgres-контракты, rate-limit, relations)
- `e6f7129`: починка E2E-авторизации онбординга тренера
- **Статус**: всё содержимое `cbb7c22` и `e6f7129` присутствует в main (main-спека e2e — супермножество обоих коммитов). Ветки-дубликаты в main: `da7feb2` ≈ наш `808fdec`+`cbb7c22`, плюс `835e88e`, `edb15f2` (client-monitoring)

## 2. IA: один дашборд прогресса и живые health-роуты

- `/analytics` и `/progress` объединены в единый дашборд с табами «Сводка / Упражнения / Восстановление»; `/analytics` стал редиректом, таб навигации ведёт на `/progress`
- Починены потерянные роуты здоровья: фабрика `healthRoutes()` существовала, но не была подключена к дереву — переходы с дашборда здоровья (`/health/water|glucose|wellness|measurements`) молча уводили на `/home`
- Home разгружен: убраны фейковый статус-бар «9:41», декоративный арт, захардкоженные «Вчера» и «+8% объём»; «Вчера» заменено честной относительной датой
- WorkoutsPage: убрана сетка «Быстрый старт», дублировавшая шит старта; режимы (функционал/силовая/кардио) перенесены в модалку «Начать тренировку» — ни одна точка входа не потеряна

## 3. Цвета → токены (вид не изменён)

- Новые группы в `tailwind.config.js`: `azure/ink/panel/line/void` — каждый токен документирует заменённый hex; точные совпадения ушли на системные шкалы (`success-*`, `warning-*`, `danger-*`, `primary-*`)
- Emergency-блок — CSS-переменные `--emergency-*`; графики recharts — единая тема `shared/lib/chartTheme.ts` поверх `--chart-*` в globals.css, контракт закреплён юнит-тестом `chartTheme.test.ts` (экспорт — только `var(--chart-…)`, каждая переменная объявлена в globals.css)
- В `className` исходников не осталось ни одного hex (проверено grep); изменились только имена классов, значения — те же

## 4. Мёртвый код: −66 модулей и CI-гейт

Reachability-анализатор (граф импортов от `main.tsx`, алиасы, lazy-`import()`, `jest.mock`), каждый кандидат подтверждён вручную. Удалено: «ghost/smart-остров» активной тренировки (17 файлов), дубль `WorkoutDashboardPage`, шим-двойник стора, 8 пустых barrel-файлов, старый `ProgressOverviewPage`, аналитика-сироты (OneRMCalculator — 742 строки), UI-сироты (`BottomSheetSelect`, `ThemeToggle`, `useTimer`, `conflictResolution`, …) и их тесты.

Гейт (`e4854e5`–`688b864`):

- Скрипт `frontend/scripts/deadcode-reachability.cjs`, режимы `report` / `check` / `update`; baseline `frontend/deadcode.baseline.json` — **0 недостижимых прод-модулей** (периферия — тесты/моки/`*.d.ts`, не гейтятся по природе)
- `npm run deadcode:check` — exit 1 при появлении новых недостижимых прод-модулей; негативный сценарий проверен
- CI: в `test.yml` шаг **сразу после checkout** (a7b308b) проверяет не только exit code, но и контракт (отчёт создан + секция «Unreachable prod modules») — ловит деградацию гейта до report-only; markdown-отчёт грузится артефактом `deadcode-reachability-report` с `if: always()`. Попутно починен YAML (незакавыченное имя шага с `: `) и убран дублирующий прогон после тестов (688b864); рабочая мультирежимная версия скрипта закоммичена вместо случайно попавшей report-only (2a589bb)

## 5. Тестовая инфра: сетевой гард, флаки, осиротевшие сюиты

- **Network guard** (`434de4d`): `setupTests.ts` глушит реальные XHR/fetch — любой реальный сетевой вызов в юнит-тестах роняет тест сразу; эскейп-люк `JEST_ALLOW_NETWORK=1`. Аудит после фикса routing.smoke: утечек ноль
- **Фикс флака routing.smoke** (`bdad4ff`): 4 health-подстраницы (`isPublic`) монтировались реально и ходили в сеть через jsdom XHR; `NETWORK_ERROR` асинхронно портил console.error-счётчик соседних `it.each`. Добавлены недостающие моки
- **Оживший сюит** (`7e549b1`): `useExerciseMutations.vitest.tsx` → `.test.tsx` — был на jest-API, но игнорился паттерном запуска. Зафиксирована политика: юнит-тесты — Jest (Vitest в репо не настроен)
- **Workflow-lint** (`56f9c87`, `c647d45`): новый воркфлоу `workflow-lint.yml` — (1) strict YAML-парс всех `workflows/*.yml` + `dependabot.yml` (кастомный `StrictLoader`: дубликат ключа = ошибка — PyYAML молча схлопывает дубли, из-за чего первый скан пропустил битый e2e), (2) `actionlint` v1.7.11 (пин из релиза; shellcheck отключён осознанно). Триггеры `push {}` + `pull_request {}` — гоняется на всех ветках. Первый прогон зелёный (run 36779865514, все 13 файлов OK, 0 находок)
- **Починка «тихо умерших» воркфлоу** (сигнатура — битые dependabot-мержи): `security.yml` (9a1d385, сломан bump dependency-review-action 4→5 #86) и `e2e-smoke-real.yml` (45b9a6f, сломан bump setup-node 4→7 #123) — мусорная строка `dependabot/github_actions/...`, двойной `uses`, бродячий ` main`, потерянный `if`; оба восстановлены с целевой мажор-версией. До strict-гейта эти файлы молча не парсились и воркфлоу не выполнялись

## 6. Фикс WIP-теста WorkoutDetailPage (`31c153c`)

Тест «shows only populated values for sets» падал с «Found multiple elements»: фикстура создавала два подхода с одинаковыми `reps/weight`, а страница корректно рендерит чип на каждый. Подходы в фикстуре сделаны различными (+проверки чипов второго сета); в коммит вошла и WIP-версия страницы (табы Обзор/Упражнения/Анализ, EditSetSheet), на которую опирается новый тест.

## План слияния с main (проверено merge-tree: 15 конфликтных файлов)

Ветка **16 вперёд / 0 позади** origin/main, но coach-фича в main уже есть под другими SHA. Проверка каждого хунка `cbb7c22`/`e6f7129` против `git show origin/main:<path>`: **потерь нет**, наш coach-контент посимвольно совпадает с main-squash `da7feb2`; main дальше только добавлял слои (monitoring/programs). Рекомендованная схема:

- **6 add/add coach-конфликтов** (coachApi.ts, useCoachQueries.ts, CoachDashboardPage.tsx, CoachPages.test.tsx, routes.tsx, types/coach.ts) и **6 backend content-конфликтов** (coach.py, registration.py, audit.py, registry.py, config.py, .env.example) — **take-main**: наш side = подмножество main (main: +101 строка monitoring/programs в coach.py, +2 маунт `client_program_router`, +4 ORM-модели программ, +1 настройка `COACH_MONITORING_NO_WORKOUT_DAYS`). Конфликт в `audit.py` ложный — дубли ключей из битого dependabot-мержа, уже починены нашим security-фиксом
- **OpenAPI** (openapi.json, openapi.d.ts) — взять main и при необходимости перегенерировать (не руками)
- `queryKeys.ts` — тривиальный add-only (+10 строк запросов программ)
- После merge: полный гейт — backend pytest, frontend `jest` / `tsc --noEmit` / `deadcode:check`

Branch protection на main уже настроена: required checks `Test Frontend` + `Lint GitHub workflows (yaml + actionlint)`, `required_linear_history` (наши 16 коммитов линейны), force-push/deletions запрещены.

## Валидация

- `tsc --noEmit` — чисто; `npm run build` (PWA) — успешно
- Jest: **88 сюит / 561 passed** (+4 skipped) — после оживления `useExerciseMutations` и фикса routing.smoke
- Deadcode-гейт: 0 недостижимых прод-модулей; негативный сценарий (временный осиротевший модуль → exit 1 со списком, после удаления → exit 0) проверен
- workflow-lint: первый прогон зелёный (run 36779865514) — strict YAML по 13 файлам, actionlint 0 находок
- Hex-аудит: 0 вхождений в `.tsx` вне тестов
- CI-конфликты с main: 0 (security.yml починен той же техникой, test.yml — add-only)

## Известные хвосты (не блокируют, но надо знать)

- Незакоммиченный WIP вне ветки (осознанно не тронут): Catalog, трекеры здоровья (Glucose/Water), ProfilePage, WorkoutTemplatesPage, API-типы и клиент workouts, backend (workouts.py, schemas, settings/config.py, workout_plan_generator), docker-compose*, docs, скрипты бэкапов. Тест/страница WorkoutDetailPage из этого списка исключены — включены в `31c153c`
- Чужой stash `stash@{0}` («temp before fixing PR91») — не тронут
- В `e4854e5` целиком попала чужая WIP-строка `**/.env.local` в `.gitignore` — она избыточна (паттерн `.env.local` без слэша в main уже матчится на любой глубине), но безвредна; можно убрать при merge
- Аннотация в workflow-lint: ubuntu-latest мигрирует на Ubuntu 26 с 19.10.2026 (информационная)
- Исторический флак первого полного Jest-прогона: корневая причина routing.smoke устранена (`bdad4ff`), сетевой гард исключит класс таких багов впредь

## Чек-лист ревьюеру

- [ ] Прогресс: `/progress` показывает единый дашборд; `/analytics` редиректит; таб активен на обоих путях
- [ ] Здоровье: с `/health` открываются все 4 подстраницы, заголовки шапки корректны
- [ ] Визуальная дифф-проверка Home / активной тренировки / итога тренировки (токены = прежние значения)
- [ ] Deadcode-гейт: шаг в test-frontend зелёный; артефакт `deadcode-reachability-report` содержит «Unreachable prod modules: None»; временный файл без импортов в `frontend/src` роняет `npm run deadcode:check`
- [ ] workflow-lint зелёный; `security.yml` и `e2e-smoke-real.yml` парсятся (strict-шаг ловит дубли ключей)
- [ ] Сетевой гард: юнит-тест с реальным fetch падает; с `JEST_ALLOW_NETWORK=1` — проходит
- [ ] Coach-флоу: приглашение → привязка клиента (уже на main; проверять по main-версии)
- [ ] После merge с main: backend pytest + frontend jest/tsc/deadcode зелёные, OpenAPI-контракт не разъехался

## Скриншоты

| До | После |
| --- | --- |
| <!-- /progress до --> | <!-- /progress после --> |
| <!-- /health после --> | |
