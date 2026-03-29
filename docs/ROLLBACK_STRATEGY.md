# Rollback Strategy (P1)

Безопасный rollback после неудачного production-деплоя строится вокруг принципа:
**сначала откатываем приложение на последний стабильный image tag, восстановление БД делаем только осознанно и выборочно**.

## Цели

- Минимизировать downtime при неудачном релизе.
- Исключить автоматическое разрушительное восстановление данных.
- Обеспечить воспроизводимый откат через фиксированный предыдущий tag.
- Оставить прозрачный operational-процесс для on-call/DevOps.

## Когда запускаем rollback

- `deploy` job завершился с ошибкой.
- `smoke` job завершился с ошибкой.
- Ручное решение on-call по итогам post-deploy мониторинга.

## Безопасный автоматический сценарий (workflow)

1. **Перед деплоем** фиксируется `PREVIOUS_IMAGE_TAG` (читается из текущего `.env` на сервере, если там уже был `IMAGE_TAG`; при первом деплое значение пустое — автоматический откат образов в workflow недоступен, пока не будет успешного выката с сохранённым тегом).
2. Выполняется backup БД и путь сохраняется в `.rollback-meta.env`.
3. Выполняется деплой целевого `IMAGE_TAG`.
4. При неуспехе срабатывает `rollback` job:
   - восстанавливает `IMAGE_TAG` в `.env` до `PREVIOUS_IMAGE_TAG`,
   - выполняет `docker-compose pull backend frontend`,
   - поднимает стек `docker-compose up -d`,
   - запускает health-проверки (`/system/health`, `/system/version`, `http://localhost/`).

### Политика восстановления БД

- По умолчанию восстановление БД **выключено** (`rollback_restore_db=false`).
- Включать восстановление БД только если:
  - релиз применил несовместимые миграции, и
  - подтверждено, что возврат схемы/данных необходим и безопасен.
- Для ручного запуска через `workflow_dispatch` доступен флаг `rollback_restore_db=true`.

## Файлы метаданных на сервере (`~/fittracker-pro`)

| Файл | Когда пишется | Содержимое |
|------|----------------|------------|
| `.rollback-meta.env` | В начале каждого деплоя из `deploy.yml` | `PREVIOUS_IMAGE_TAG`, `TARGET_IMAGE_TAG`, `DEPLOY_STARTED_AT`, `DB_BACKUP_PATH` |
| `.last-stable-deploy.env` | После **успешного** deploy **и** smoke (`record-stable` job) | `LAST_STABLE_IMAGE_TAG`, `LAST_STABLE_PREVIOUS_TAG`, `LAST_STABLE_RECORDED_AT` |

`PREVIOUS_IMAGE_TAG` — это тег, который **уже крутился** до текущей попытки выката; его же использует авто-rollback при падении deploy или smoke.

## Автоматический rollback (`deploy.yml`)

Реализовано в `.github/workflows/deploy.yml`:

- input `rollback_restore_db` только для `workflow_dispatch` (при откате после сбоя; для события `release` восстановление БД из бэкапа не включается автоматически);
- сохранение метаданных в `.rollback-meta.env`;
- откат `IMAGE_TAG` на `PREVIOUS_IMAGE_TAG`, `pull` backend/frontend, `up -d`, health checks на хосте;
- после успешного smoke — запись снимка стабильных тегов в `.last-stable-deploy.env`.

## Ручной rollback workflow (GitHub Actions)

Отдельный workflow: `.github/workflows/rollback-production.yml` (только **workflow_dispatch**).

1. В поле **confirm** введите ровно `ROLLBACK` — иначе запуск будет отклонён отдельной job.
2. **rollback_image_tag** — пусто: берётся `PREVIOUS_IMAGE_TAG` из `.rollback-meta.env`, иначе (если пусто) `LAST_STABLE_PREVIOUS_TAG` из `.last-stable-deploy.env`; либо укажите тег явно.
3. **rollback_restore_db** — по умолчанию выключено; включайте только при осознанной необходимости восстановить дамп из `DB_BACKUP_PATH` в `.rollback-meta.env`.

## Ручной runbook по SSH (если CI недоступен)

```bash
cd ~/fittracker-pro
source .rollback-meta.env
sed -i -E "s|^IMAGE_TAG=.*|IMAGE_TAG=${PREVIOUS_IMAGE_TAG}|" .env
docker-compose -f docker-compose.prod.yml pull backend frontend
docker-compose -f docker-compose.prod.yml up -d
```

Опционально восстановить БД из `DB_BACKUP_PATH` только после подтверждения:

```bash
docker-compose -f docker-compose.prod.yml up -d postgres
docker exec -i fittracker-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DB_BACKUP_PATH"
```

## Ограничения и дальнейшие шаги

- Откат образов **не** откатывает схему БД Alembic автоматически.
- Для полного сценария стоит добавить:
  - миграционную политику "expand/contract" для backward-compatible релизов;
  - canary/blue-green (с переключением трафика);
  - автоматический capture release note с привязкой к commit SHA и tag.
