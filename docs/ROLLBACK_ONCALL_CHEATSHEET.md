# Rollback On-Call Cheatsheet (1 page)

Быстрый выбор безопасного сценария отката при инциденте релиза.

Источник полной логики: `docs/ROLLBACK_STRATEGY.md`.

## 0) 60-second triage

1. Что упало: `migrate`, `deploy` или `verify`?
2. Проблема app-only или schema/data?
3. Есть ли `PREVIOUS_IMAGE_TAG` и `DB_BACKUP_PATH` в `.rollback-meta.env`?
4. Первый ли это deploy?

## 1) Выбор сценария

### A — rollback только image/app (по умолчанию)

Выбираем, если:
- симптомы уровня приложения (5xx, broken API/UI),
- нет явных ошибок несовместимости схемы.

Действия:
1. Откат `IMAGE_TAG` на предыдущий.
2. `pull backend frontend` + `up -d`.
3. Health/smoke проверки.

### B — image rollback + migration downgrade

Выбираем, если:
- есть schema mismatch,
- есть проверенный `downgrade()` и понятная target revision,
- риск неконсистентности контролируем.

Действия:
1. Сначала rollback image.
2. Затем `alembic downgrade <target_revision>`.
3. Повторные проверки health/smoke + ключевые бизнес-флоу.

### C — image rollback + DB restore

Выбираем, если:
- downgrade невозможен/небезопасен,
- есть признаки data corruption или необратимой миграции,
- допустима потеря данных после backup timestamp.

Действия:
1. Сначала rollback image.
2. Restore БД из `DB_BACKUP_PATH`.
3. Health/smoke + доменная валидация.

## 2) Таблица сигналов мониторинга -> сценарий

| Сигнал | Признак | Рекомендованный сценарий |
|---|---|---|
| 5xx на API после deploy, при этом SQL ошибок нет | app/runtime regression | A |
| Smoke `system/health` и `version` fail, migrate success | часто app/config issue | A (первый выбор) |
| Логи backend: `column does not exist`, `relation does not exist`, ORM mapping errors | schema mismatch | B |
| Миграция прошла, но старый app не поднимается из-за схемы | backward-incompatible change | B или C |
| Ошибки после data-transform миграции, откат downgrade сомнителен | риск неконсистентных данных | C |
| Подтверждена порча данных после миграции | data corruption | C |
| Первый deploy, `PREVIOUS_IMAGE_TAG` пустой | auto image rollback недоступен | Manual: explicit tag |

## 3) Edge case: первый deploy

Если `PREVIOUS_IMAGE_TAG` пустой:
1. Авто-rollback в reusable deploy workflow не сработает (ожидаемо).
2. Запускать `.github/workflows/rollback-production.yml` вручную.
3. Передавать `rollback_image_tag` явно.
4. Если рабочего тега нет — rollback образов невозможен, только hotfix/redeploy.

## 4) Команды (manual SSH fallback)

### A: image rollback

```bash
cd ~/fittracker-pro
source .rollback-meta.env
sed -i -E "s|^IMAGE_TAG=.*|IMAGE_TAG=${PREVIOUS_IMAGE_TAG}|" .env
docker-compose -f docker-compose.prod.yml pull backend frontend
docker-compose -f docker-compose.prod.yml up -d
```

### B: downgrade

```bash
cd ~/fittracker-pro
docker-compose -f docker-compose.prod.yml exec -T backend alembic current
docker-compose -f docker-compose.prod.yml exec -T backend alembic history --indicate-current
docker-compose -f docker-compose.prod.yml exec -T backend alembic downgrade <target_revision>
```

### C: restore

```bash
cd ~/fittracker-pro
source .rollback-meta.env
docker-compose -f docker-compose.prod.yml up -d postgres
docker exec -i fittracker-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DB_BACKUP_PATH"
```

## 5) Exit criteria (incident can be closed)

- `GET /api/v1/system/health` = 200, `status=healthy`
- `GET /api/v1/system/version` = 200, версия читается
- `GET /health` = 200
- Ключевые пользовательские сценарии проходят
- В incident note зафиксированы: причина, выбранный сценарий, ревизии/теги, риск по данным

Последнее обновление: 2026-04-10
