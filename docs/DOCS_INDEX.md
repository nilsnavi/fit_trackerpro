# Docs Index

Единая карта документации проекта FitTracker Pro.

## Как пользоваться

- Используйте этот индекс как стартовую точку перед изменениями в коде или инфраструктуре.
- При каждом изменении поведения системы обновляйте профильный документ и этот индекс.
- Если документ устарел или отсутствует, создайте задачу и назначьте владельца.

## Карта документов и ответственные секции

| Документ | Что покрывает | Ключевые секции | Ответственный |
|---|---|---|---|
| `README.md` | Общий обзор проекта, запуск, архитектура, API-карта | Структура проекта, Быстрый старт, Backend архитектура, API Endpoints, CI/CD | Tech Lead |
| `README-DEPLOYMENT.md` | Короткая operational-шпаргалка для запуска и эксплуатации | Local Start, Current Backend Architecture, CI/CD, Ops Commands, Required Env | DevOps |
| `TELEGRAM_SETUP.md` | Интеграция Telegram Mini App и auth flow | BotFather setup, env, auth endpoints, troubleshooting, security notes | Backend Lead |
| `docs/ENVIRONMENT_SETUP.md` | Полная настройка переменных окружения | Backend vars, Frontend vars, Production compose vars, validation checklist | DevOps |
| `docs/DEPLOYMENT.md` | Полный гайд production-деплоя | Prerequisites, Server bootstrap, secrets, SSL/Nginx, manual/automated deploy, rollback | DevOps |
| `docs/PRODUCTION_CHECKLIST.md` | Релизный чеклист перед/после выката | Before release, Environment and secrets, Smoke checks, Rollback readiness | Release Manager |
| `docs/SECURITY_CHECKLIST.md` | Безопасность приложения и инфраструктуры | Transport, Auth/session security, Secrets, Containers/dependencies, Review cadence | Security Owner |
| `docs/PROJECT_AUDIT_2026-03-26.md` | Технический аудит и план стабилизации | Findings, Priorities, Iteration plan, Quick wins | Tech Lead |
| `frontend/DESIGN_SYSTEM.md` | Дизайн-система frontend и UI-паттерны | Theme setup, component classes, animations, Telegram integration | Frontend Lead |
| `database/postgresql/PARTITIONING_POLICY.md` | Политика партиционирования БД | Triggers, rollout policy, maintenance | DB Owner |
| `database/postgresql/migrations/README_zero_downtime_snake_case.md` | Runbook zero-downtime миграций | Phases, migration order, validation | DB Owner |
| `database/postgresql/migrations/README_rename_columns_to_snake_case.md` | Детали миграции именования колонок | Mapping rules, rollout steps, compatibility notes | DB Owner |

## Зоны ответственности по направлениям

- **Backend/API:** актуальность endpoint-карты, auth flow, сервисная архитектура.
- **Frontend:** UI/UX гайды, поведение Telegram Mini App на клиенте.
- **Database:** migration runbooks, schema policy, compatibility notes.
- **DevOps/SRE:** окружения, деплой, CI/CD, rollback, production checklists.
- **Security:** security checklist, secret management, periodic review cadence.

## Регламент обновления документации

- Обновляйте документацию в том же PR/коммите, где меняется поведение системы.
- Минимум раз в месяц выполняйте doc-review для `docs/DEPLOYMENT.md`, `docs/ENVIRONMENT_SETUP.md`, `docs/SECURITY_CHECKLIST.md`.
- При изменении API сначала обновляйте `README.md` (API Endpoints), затем профильные guides.
