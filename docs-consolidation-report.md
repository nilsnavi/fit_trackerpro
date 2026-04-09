# FitTracker Pro — docs consolidation report

Цель: свести документацию проекта к понятной, непротиворечивой системе с одним “entrypoint” и каноническими guide’ами.

## Итоговая структура (канон)

- `README.md` — **entrypoint** + быстрый старт + “source of truth”
- `docs/DOCS_INDEX.md` — индекс/навигация и зоны ответственности
- `docs/local-development.md` — локальная разработка
- `docs/DEPLOYMENT.md` — production деплой
- `docs/architecture.md` — архитектура (as-is + обязательные принципы)
- `docs/security.md` — безопасность (канон)
- `docs/offline-pwa.md` — офлайн и PWA (канон)

## Что было не так (находки)

### Дублирование

- **Deployment**: пересечение в `README.md`, `README-DEPLOYMENT.md`, `docs/DEPLOYMENT.md` (одни и те же сущности: GHCR, `IMAGE_TAG`, `deploy.yml`, ручные команды).
- **Security**: параллельные чеклисты `docs/SECURITY_CHECKLIST.md` (EN) и `docs/security/checklist.md` (RU) частично повторяли друг друга.
- **Architecture**: часть структуры backend описана в `README.md`, часть — в `docs/current-architecture.md`, часть — в `docs/target-architecture.md`, плюс отдельный канон `docs/architecture/backend.md`.
- **PWA/offline**: длинный раздел в `README.md`, при этом ожидаемый файл `docs/offline-pwa.md` отсутствовал.

### Противоречия

- **Путь на сервере**:
  - встречалось `~/fittracker-pro` (workflows/DEPLOYMENT/README) и `~/fit_trackerpro` (production checklist).
  - Канон установлен как `~/fittracker-pro` (соответствует workflow `DEPLOY_DIR`).
- **Backend “слои”**:
  - `docs/current-architecture.md` и `docs/target-architecture.md` ссылались на `backend/app/services|repositories|models`,
  - фактическая структура `backend/app` — `api/`, `application/`, `domain/`, `infrastructure/`, `schemas/`, …

### Устаревшее / рискованное

- `README-DEPLOYMENT.md` отмечал, что `deploy.sh` не синхронизирован с текущим CI-пайплайном (оставлено как предупреждение; канон — workflows).

### Broken structure / broken references

- `docs/offline-pwa.md` отсутствовал как файл, хотя тема офлайна была важной (исправлено добавлением канонического документа).

## Что сделано (изменения)

- Добавлены канонические документы:
  - `docs/local-development.md`
  - `docs/DEPLOYMENT.md`
  - `docs/architecture.md`
  - `docs/security.md`
  - `docs/offline-pwa.md`
- `README.md` превращён в entrypoint:
  - добавлены ссылки на канонические документы
  - добавлен короткий раздел “source of truth”
  - production/architecture/PWA разделы сокращены до ссылок на канон
- `docs/DOCS_INDEX.md` обновлён под новую структуру и дополнен “source of truth”.
- `docs/DEPLOYMENT.md`, `README-DEPLOYMENT.md`, `docs/SECURITY_CHECKLIST.md` переведены в режим **legacy redirect** (чтобы не ломать старые ссылки и убрать дубли).
- `docs/PRODUCTION_CHECKLIST.md` приведён к каноническому пути `~/fittracker-pro`.

## Рекомендации дальше (не обязательно, но полезно)

- В `docs/current-architecture.md` и `docs/target-architecture.md` заменить устаревшие пути `backend/app/services|repositories|models` на фактические (`application/domain/infrastructure`) или добавить явную пометку “historical”.
- По желанию — добавить в `docs/DEPLOYMENT.md` короткую секцию про `deploy.sh` как "не использовать" (ссылка уже есть в legacy документах).

