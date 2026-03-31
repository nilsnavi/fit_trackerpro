# Docs Index

Единая карта документации проекта FitTracker Pro.

## Как пользоваться

- Используйте этот индекс как стартовую точку перед изменениями в коде или инфраструктуре.
- При каждом изменении поведения системы обновляйте профильный документ и этот индекс.
- Если документ устарел или отсутствует, создайте задачу и назначьте владельца.

## Карта документов и ответственные секции

| Документ | Что покрывает | Ключевые секции | Ответственный |
|---|---|---|---|
| `README.md` | Entrypoint: навигация, быстрый старт, source of truth | Док-ссылки, Quick Start, Source of truth | Tech Lead |
| `docs/local-development.md` | Локальная разработка | Docker Compose, hybrid mode, quick checks | Tech Lead |
| `docs/deployment.md` | Production деплой | Source of truth, env, deploy flow, ручные шаги | DevOps |
| `docs/architecture.md` | Архитектура (канон) | Контуры, backend/frontend структура, API карта | Tech Lead |
| `docs/security.md` | Безопасность (канон) | Secrets, TLS/Nginx, auth, deps, checks | Security Owner |
| `docs/offline-pwa.md` | Офлайн и PWA | SW, caches, persist, queue, ограничения | Frontend Lead |
| `TELEGRAM_SETUP.md` | Интеграция Telegram Mini App и auth flow | BotFather setup, env, auth endpoints, troubleshooting, security notes | Backend Lead |
| `docs/ENVIRONMENT_SETUP.md` | Полная настройка переменных окружения | Backend vars, Frontend vars, Production compose vars, validation checklist | DevOps |
| `docs/DEPLOYMENT.md` | Legacy-redirect на новый гайд деплоя | Ссылка на `docs/deployment.md` | DevOps |
| `docs/ROLLBACK_STRATEGY.md` | P1-стратегия безопасного отката | Trigger conditions, workflow rollback, DB restore policy, manual runbook | DevOps/SRE |
| `docs/PRODUCTION_CHECKLIST.md` | Релизный чеклист перед/после выката | Before release, Environment and secrets, Smoke checks, Rollback readiness | Release Manager |
| `docs/SECURITY_CHECKLIST.md` | Legacy-redirect на канонический security | Ссылка на `docs/security.md` | Security Owner |
| `docs/security/checklist.md` | Расширенный практический чеклист (RU) | Детали по стеку и env | Security Owner |
| `docs/PROJECT_AUDIT_2026-03-26.md` | Технический аудит и план стабилизации | Findings, Priorities, Iteration plan, Quick wins | Tech Lead |
| `docs/target-architecture.md` | Целевая архитектура после рефакторинга (to-be) | Frontend/backend structure, deploy, env, health | Tech Lead |
| `docs/architecture/backend.md` | Слои backend, направление зависимостей, bounded contexts, правила новых модулей | Слои, Направление зависимостей, Основные bounded contexts, Правила для новых модулей | Backend Lead |
| `docs/qa/testing-strategy.md` | Стратегия тестирования (QA), приоритеты, тестовая пирамида, критичные сценарии | Пирамида, P0–P2, Critical flows | QA/Tech Lead |
| `frontend/DESIGN_SYSTEM.md` | Дизайн-система frontend и UI-паттерны | Theme setup, component classes, animations, Telegram integration | Frontend Lead |
| `docs/db/schema-governance.md` | Политика схемы БД (единый source of truth) | Source of truth, workflow миграций, запреты/исключения, проверки | DB Owner |
| `database/postgresql/PARTITIONING_POLICY.md` | Политика партиционирования БД | Triggers, rollout policy, maintenance | DB Owner |
| `database/postgresql/migrations/README_zero_downtime_snake_case.md` | Runbook zero-downtime миграций | Phases, migration order, validation | DB Owner |
| `database/postgresql/migrations/README_rename_columns_to_snake_case.md` | Детали миграции именования колонок | Mapping rules, rollout steps, compatibility notes | DB Owner |

## Зоны ответственности по направлениям

- **Backend/API:** актуальность endpoint-карты, auth flow, сервисная архитектура (`docs/architecture/backend.md`).
- **Frontend:** UI/UX гайды, поведение Telegram Mini App на клиенте.
- **Database:** migration runbooks, schema policy, compatibility notes.
- **DevOps/SRE:** окружения, деплой, CI/CD, rollback, production checklists.
- **Security:** `docs/SECURITY_CHECKLIST.md`, `docs/security/checklist.md`, secret management, periodic review cadence.

## Source of truth (где смотреть в первую очередь)

- **Деплой**: `docs/deployment.md` (канонические ссылки на workflows + `docker-compose.prod.yml`)
- **Архитектура**: `docs/architecture.md` (backend-детали: `docs/architecture/backend.md`)
- **Окружения**: `docs/env-matrix.md` + `docs/ENVIRONMENT_SETUP.md`
- **Миграции**: `database/migrations` (правила: `docs/db/schema-governance.md`)

## Регламент обновления документации

- Обновляйте документацию в том же PR/коммите, где меняется поведение системы.
- Минимум раз в месяц выполняйте doc-review для `docs/DEPLOYMENT.md`, `docs/ENVIRONMENT_SETUP.md`, `docs/SECURITY_CHECKLIST.md`, `docs/security/checklist.md`.
- При изменении API сначала обновляйте `README.md` (API Endpoints), затем профильные guides.
