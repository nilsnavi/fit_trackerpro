# Backend quality report (FitTracker Pro)

Дата: 2026-03-31

## Что запускалось (локально)

- `ruff check backend/app`
- `ruff check backend/app --select F401,F841,F821`
- `pytest` (конфиг `backend/pytest.ini`, включая coverage thresholds)

Примечание: type-related checks (mypy/pyright) **в репозитории не настроены**, поэтому отдельная типовая проверка не запускалась.

## Что было найдено

- **Ruff**
  - **F401**: неиспользуемые импорты
  - **F821**: неразрешённое имя в type annotation (`Exercise`)

## Что исправлено

- **Неиспользуемые импорты (F401)**:
  - `backend/app/api/v1/achievements.py`: убран неиспользуемый `status`
  - `backend/app/middleware/rate_limit.py`: убран неиспользуемый `HTTPException`
  - `backend/app/tests/test_rate_limit.py`: убран неиспользуемый `os`
- **Undefined name в аннотации (F821)**:
  - `backend/app/domain/user.py`: добавлен `TYPE_CHECKING`-импорт `Exercise` (не влияет на runtime)
- **Разблокирован CI install зависимостей**:
  - `backend/requirements/base.txt`: `python-telegram-bot==20.8` → `python-telegram-bot==22.7`, чтобы устранить конфликт с `httpx==0.28.1`

## Что осталось как technical debt

- **Type checking**: отсутствуют конфиги/джобы для mypy/pyright. Рекомендация — добавить минимальный pyright/mypy baseline позже (может потребовать доп. аннотаций и исключений).
- **Зависимости**: pinned versions без общего lock-файла для backend (в CI каждый раз решается окружение). Это не баг, но источник нестабильности.

## Mandatory проверки в CI (минимально)

Сейчас backend job в GitLab CI запускает `pytest`, но не запускает lint/type checks.

Предложение минимальных обязательных gates:

- **Lint (обязательно)**: `ruff check backend/app`
- **Tests (обязательно)**: `pytest` (уже есть)
- **Type checks (опционально на первом этапе)**: добавить отдельным шагом после согласования tooling (pyright или mypy)

В рамках этой задачи добавлен минимальный job `lint_backend` в `.gitlab-ci.yml`, чтобы lint стал блокирующим для merge.

