# FitTracker Pro — Documentation

Единый entrypoint для документации проекта. Если вы не знаете, с чего начать — начните отсюда.

## Product

- **Обзор проекта и быстрый старт**: `../README.md`, `../QUICKSTART.md`, `../LAUNCH_GUIDE.md`
- **Telegram Mini App (auth, переменные, troubleshooting)**: `./product/telegram-setup.md`
- **Offline/PWA (канон)**: `./offline-pwa.md`

## Architecture (Clean Architecture)

Документация поддерживает подход “Clean Architecture”: зависимости направлены **внутрь**, к домену; HTTP/DB/фреймворки — на внешнем контуре.

- **Архитектура (канон)**: `./architecture.md`
- **Backend layers + dependency rule (подробно)**: `./architecture/backend.md`
- **Current vs target**:
  - current: `./current-architecture.md`
  - target: `./target-architecture.md`

## Deployment & Operations

- **Production deployment (канон)**: `./DEPLOYMENT.md`
- **Launch runbook P0 (WS1-7…WS1-11, WS1-15, для владельца)**: `./LAUNCH_RUNBOOK.md`
- **Smoke против реального API (секреты, ротация init_data)**: `./testing/real-api-smoke.md`
- **Local development**: `./local-development.md`
- **Environment variables / setup**: `./ENVIRONMENT_SETUP.md`, `./env-matrix.md`
- **Rollback**: `./ROLLBACK_STRATEGY.md`, `./ROLLBACK_ONCALL_CHEATSHEET.md`
- **Security (канон)**: `./security.md` (дополнительно: `./security/checklist.md`)

## Testing

- **Testing strategy (канон)**: `./qa/testing-strategy.md`
- **E2E (Playwright)**:
  - guide: `../frontend/e2e/README.md`
  - quick reference: `./testing/e2e-quick-reference.md`
  - implementation notes: `./testing/golden-path-e2e-implementation.md`
  - completion checklist (архив): `./archive/e2e-completion-checklist.md`

## Legal & Data

- **Данные и приватность (процедуры, согласие, ответственные)**: `./legal/privacy-and-data.md`
- Тексты документов для пользователя живут в приложении: `frontend/src/features/legal/content.ts`
  (версии обязаны совпадать с `backend/app/core/legal.py`)

## Roadmap

- **Roadmap index**: `./roadmap/README.md`

## Reports & Archive

- **Reports (аудиты, статусы, quality)**: `./reports/` (index: `./reports/README.md`)
- **Archive (снимки, временные summary, устаревшие заметки)**: `./archive/`

