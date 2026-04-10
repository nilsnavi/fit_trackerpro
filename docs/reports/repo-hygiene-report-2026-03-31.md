# FitTracker Pro — repo hygiene report

Дата: 2026-03-31

## Что найдено (generated/runtime artifacts)

В рабочем дереве присутствуют локальные артефакты, которые **не должны коммититься** и уже покрыты правилами игнора:

- `node_modules/` (в корне репозитория)
- `htmlcov/` (в корне репозитория)
- `.ruff_cache/` (в корне репозитория)

Также в `.gitignore` уже предусмотрены игнор-правила для типовых артефактов из задачи:

- `dist/`
- `coverage/`, `coverage.xml`, `coverage.json`
- `htmlcov/`
- `.coverage`, `.coverage.*`
- `__pycache__/`, `*.pyc`
- `.venv/`, `venv/`
- `node_modules/`

## Что ошибочно отслеживалось git

На момент выполнения работ **не обнаружено** файлов/директорий из списка generated/runtime artifacts, которые были бы отслеживаемыми git (tracked).

Соответственно, команд `git rm --cached` для удаления артефактов из индекса не потребовалось.

## Какие ignore-правила добавлены/изменены

Изменение сделано только одно и оно про безопасность исходников:

- В `backend/.gitignore` удалено правило, игнорирующее `alembic/versions/*.py`.
  - Причина: файлы в `alembic/versions/` — это реальные migration-файлы (исходники) и их нельзя терять из контроля версий.

Root `.gitignore` и `frontend/.gitignore` уже содержали необходимые правила для `dist/coverage/htmlcov/__pycache__/node_modules/.venv` и т.п., поэтому их менять не пришлось.

## Что должно оставаться локальным (не коммитить)

- **Python**
  - `__pycache__/`, `*.pyc`
  - `.venv/`, `venv/`, `env/`, `ENV/`
  - `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.tox/`
  - `.coverage*`, `coverage.xml`, `coverage.json`, `htmlcov/`
- **Node/Frontend**
  - `node_modules/`
  - `dist/`, `dist-ssr/`
  - `coverage/`, `.nyc_output/`
  - `.vite/`, `.parcel-cache/`, `.eslintcache`, `.stylelintcache`, `.cache/`

