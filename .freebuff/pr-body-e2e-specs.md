## Что и зачем

Пять E2E-job'ов в CI запускались, но падали. Разбор по артефактам показал две независимые причины: одну в сборке образа, вторую — в самих спеках.

### 1. Образ собирался как dev-сборка (корневая причина)

`frontend/Dockerfile` в builder-стадии выставляет `ENV NODE_ENV=development` (чтобы `npm ci` поставил devDependencies) — и это значение попадало в `vite build`. По скачанному из CI-прогона бандлу видно, что в образе оказывалась dev-сборка:

- бандл содержит `jsxDEV` (React dev-runtime) вместо `jsx`;
- `TelegramAuthGate` скомпилирован в `const devBypass = !trimmed`: условие `process.env.NODE_ENV === 'development'` свернулось в `true` (в production-сборке на этом месте `!1`).

В образе приложение пускало в шелл любого посетителя без Telegram-контекста, дальше срабатывал health-гейт: `useBackendHealth` запрашивает относительный `/health/ready`, а nginx в образе отдаёт на него `index.html` с кодом 200 → `response.json()` падает → экран «Техническое обслуживание». Поэтому проверка «без Telegram показывается заглушка» была невыполнима в CI, а вместе с ней «плавали» клики и тайминги (dev-рендер, StrictMode).

Фикс — одна строка: бандл собирается с `NODE_ENV=production`; `npm ci` по-прежнему ставит devDependencies.

### 2. Спеки описывали не тот контракт UI

- **Навигация.** Дашборд (`/home`) намеренно скрывает нижнюю навигацию (`useHideAppShellNavigation`), а спеки кликали nav-ссылки сразу после `goto('/')`: при редиректе успевал мелькнуть шелл с навигацией, затем узлы пересоздавались («element was detached from the DOM»). Теперь навигация проверяется из разделов, где она отрисована — `navigation.smoke`, quick smoke в `mvp-regression`, `golden-path` (каталог → «Тренировки»), `mvp-golden-path` (проверяет контент дашборда).
- **`workout-mode-flows` («resume draft»).** Промпт §48 «Незавершённая тренировка» поднимался поверх хаба и перехватывал клик по «Открыть активную тренировку». Теперь промпт закрывается так же, как это делает пользователь, с фолбэком на пилюлю.
- **`critical-path`.** Мок `POST /workouts/complete` не закрывал сессию: возвращал запись без `duration`/`status`, поэтому в истории оставался бейдж «В процессе». Мок приведён к контракту сервера.

### 3. Оставшийся красный job — `E2E Playwright (default suite)`

Он гоняет все четыре проекта, и в нём же лежат три real-API спека (`tests/e2e/*`, `@mvp-e2e`) против compose-стека. Все их падения были экраном «Техническое обслуживание» из п. 1: в CI-стеке фронтенд отдаётся nginx'ом, а `frontend/nginx.conf` не проксировал `/health/ready`, который SPA запрашивает со своего origin.

- `frontend/nginx.conf`: `location = /health/ready` проксируется на `backend:8000` рядом с существующим `/api/`. Теперь гейт получает `{"status":"ready",...}` и приложение доходит до реального UI.
- `tests/e2e/golden-path.spec.ts`, `offline.spec.ts`, `auth.spec.ts` приведены к текущему контракту экрана активной сессии: подход редактируется inline (без кнопки «Редактировать подход»), завершается кнопкой «Завершить подход», отдых — «Пропустить», сессия закрывается кнопкой «Завершить» без диалога подтверждения; статус синка — баннер «Нет соединения», а не удалённый `workout-sync-indicator`; упражнение ищется по русскому названию из справочника; онбординг считается завершённым по контенту дашборда, а не по shell-навигации.
- В golden path ожидается ответ PATCH сессии после завершения подхода: иначе защита «Сначала завершите хотя бы один подход» читает ещё не обновлённый кэш детали.

## Проверка

- `tsc --noEmit` и `eslint` по изменённым файлам — чисто;
- полный набор `e2e/` на трёх проектах (chromium, mobile-android, mobile-ios): **102 passed, 3 skipped, 0 failed**;
- целевые файлы с `--repeat-each=2..3` стабильны: `telegram-auth-onboarding`, `navigation.smoke`, `mvp-regression`, `workout-mode-flows`, `active-workout-offline-refresh`, `critical-path`, `golden-path`, `mvp-golden-path`;
- dev-бандл (старый Dockerfile) воспроизводит падение `telegram-auth-onboarding` один в один — тот же снимок экрана «Техническое обслуживание», что и в CI.

Проверка исправлений п. 3 — локально на том же compose-стеке (`docker-compose.e2e.yml`) со свежей БД, в CI-режиме (`retries=2`, `workers=2`, `PLAYWRIGHT_SKIP_WEBSERVER=1`, `E2E_BASE_URL=http://127.0.0.1:3000`):

- `npx playwright test` целиком (все четыре проекта, как в job'е): **104 passed, 0 failed**;
- отдельно `--project=chromium-mvp-e2e`: 5 passed;
- в CI job `E2E Playwright (default suite)` — **pass** (был красным).

## Известные ограничения

- `tests/e2e/*` (`@mvp-e2e`) требуют поднятого compose-стека; локально запускаются только против него.
- `E2E MVP golden path (Playwright + compose)` по-прежнему `skipping` по условию workflow.
- Красные `Dependency Review`, `Frontend npm audit`, `Python Dependency Audit` и `Kilo Code Review` — внешние/предсуществующие (находки аудита в текущем lockfile и исчерпанные кредиты ревью-бота); это изменение не добавляет зависимостей и на них не влияет.
