# Аудит проекта FitTracker Pro (2026-03-26)

## Что проверено

- Обзор архитектуры и документации (`README.md`, `backend/app/main.py`, `backend/app/utils/config.py`, `frontend/src/App.tsx`).
- Запуск backend-тестов: `cd backend && pytest -q`.
- Запуск frontend-тестов: `cd frontend && npm run -s test -- --watchAll=false`.
- Сборка frontend: `cd frontend && npm run -s build`.
- Линт frontend: `cd frontend && npm run -s lint`.

---

## Ключевые выводы

### 1) Frontend сейчас не проходит production-сборку (высокий приоритет)

Сборка падает из-за TypeScript-ошибок:
- множественные `TS6133` (неиспользуемые переменные/импорты),
- среди блокеров: ошибка use-before-declaration в legacy `WorkoutCardio.tsx` (отдельные страницы по типу тренировки позже убраны в пользу `WorkoutModePage` и конфига режимов).

**Почему это важно:** при текущем состоянии нельзя стабильно выпускать изменения в production.

**Рекомендации:**
1. Исправить блокирующие TS-ошибки в первую очередь (включая страницы потока тренировки после консолидации в `WorkoutModePage`).
2. Ввести policy: PR не мержится, пока `npm run build` не проходит.
3. Для большого массива legacy-кода — временно вынести cleanup в отдельный технический epic и закрывать по компонентам.

---

### 2) Frontend имеет большой долг по линтингу (высокий приоритет)

`npm run lint` показывает **67 проблем** (31 error, 36 warning), включая:
- `@typescript-eslint/no-unused-vars`,
- `react-hooks/exhaustive-deps`,
- `no-explicit-any`,
- `prefer-const`, `no-constant-condition`.

**Почему это важно:** ошибки линтера и хуков повышают риск багов в рантайме (устаревшие замыкания, несинхронный state, сложно поддерживаемый код).

**Рекомендации:**
1. Разделить задачи на категории: `errors` → `warnings`.
2. Зафиксировать порог: сначала 0 `errors`, затем постепенно снижать `warnings`.
3. Добавить pre-commit (например, `lint-staged`) только на изменённые файлы.

---

### 3) Backend-тесты зависят от обязательных env-переменных (средне-высокий приоритет)

`pytest` падает до старта тестов из-за обязательных значений в `Settings`:
- `DATABASE_URL`,
- `TELEGRAM_BOT_TOKEN`,
- `TELEGRAM_WEBAPP_URL`,
- `SECRET_KEY`.

**Почему это важно:** CI и локальная разработка усложняются; часть тестов, не требующих внешних сервисов, не может быть запущена изолированно.

**Рекомендации:**
1. В тестовом режиме подставлять безопасные default-значения (через `.env.test` и/или `conftest.py`).
2. Явно разделить runtime-конфиг production/dev/test.
3. Сделать smoke-тест, подтверждающий, что приложение стартует в `ENVIRONMENT=test` без внешних зависимостей.

---

### 4) Несогласованность тестов и реального качества сборки (средний приоритет)

Frontend-тесты (`jest`) проходят, но production-сборка падает. Это указывает на разрыв между тестовым контуром и release-контуром.

**Рекомендации:**
1. В CI выстроить обязательную последовательность: `lint` → `test` → `build`.
2. Сделать `build` обязательным статус-чеком для merge.
3. Добавить nightly job с расширенными проверками (coverage + type checks + dependency audit).

---

### 5) Улучшения инженерного процесса (средний приоритет)

Проект уже содержит богатую инфраструктуру (мониторинг, документация, Docker), но для стабильности релизов полезно усилить процесс.

**Рекомендации:**
1. Добавить единый `Makefile`/task runner (`make test`, `make lint`, `make build`, `make check`).
2. В README выделить “минимальный gate перед PR” с точными командами.
3. Зафиксировать policy для TS/ESLint ошибок (что считается блокером).

---

## Предлагаемый план на 2 итерации

### Итерация 1 (стабилизация, 1–3 дня)
- Починить frontend build-blockers (страницы тренировок / общий TS cleanup).
- Довести frontend lint до 0 errors.
- Сделать backend тестовый конфиг (`.env.test`) и запустить минимум smoke + unit.

### Итерация 2 (укрепление качества, 3–5 дней)
- Включить жёсткие CI-гейты `lint/test/build`.
- Добавить pre-commit проверки на изменённые файлы.
- Разбить remaining warnings на отдельные технические задачи с SLA.

---

## Быстрые wins

- Удалить неиспользуемые импорты и переменные в самых активных компонентах (`EmergencyMode`, `GlucoseTracker`, `WaterTracker`, `Profile`, `Calendar`).
- Исправить зависимости в `useEffect/useCallback`, где линтер сигнализирует про `exhaustive-deps`.
- Перенести общие helper-ы из component-файлов в отдельные модули для корректной Fast Refresh-работы.

---

## Статус после Integration 1 (обновление)

- ✅ Исправлены блокирующие ошибки TypeScript, из-за которых падала production-сборка.
- ✅ Устранены lint **errors** (включая `no-unused-vars`, `no-constant-condition`, use-before-declaration).
- ⚠️ Линтер всё ещё падает, потому что в скрипте включён `--max-warnings 0`, а в коде остаются warnings (`no-explicit-any`, `react-hooks/exhaustive-deps`, `react-refresh/only-export-components`).
- ✅ Frontend тесты проходят (`jest`), production build проходит (`vite build`).

## Статус после Integration 2 (обновление)

- ✅ Frontend `lint` теперь проходит с текущим строгим правилом `--max-warnings 0`.
- ✅ Frontend `build` проходит стабильно.
- ✅ Frontend unit-тесты проходят.
- ✅ Устранены предупреждения по `react-hooks/exhaustive-deps`, `no-explicit-any` и `react-refresh/only-export-components` в проблемных файлах.
