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

## Частичная реализация в репозитории

Реализовано в `.github/workflows/deploy.yml`:

- новый input `rollback_restore_db` для `workflow_dispatch`;
- сохранение rollback-метаданных в `.rollback-meta.env`;
- детерминированный откат на `PREVIOUS_IMAGE_TAG`;
- post-rollback health checks;
- восстановление БД переведено в опциональный режим.

## Ручной runbook (если automation недоступна)

```bash
cd ~/fittracker-pro
source .rollback-meta.env
sed -i -E "s/^IMAGE_TAG=.*/IMAGE_TAG=${PREVIOUS_IMAGE_TAG}/" .env
docker-compose -f docker-compose.prod.yml pull backend frontend
docker-compose -f docker-compose.prod.yml up -d
```

Опционально восстановить БД из `DB_BACKUP_PATH` только после подтверждения:

```bash
docker-compose -f docker-compose.prod.yml up -d postgres
docker exec -i fittracker-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DB_BACKUP_PATH"
```

## Ограничения и дальнейшие шаги

- Это **частичная** реализация: rollback не делает автоматического rollback Alembic-миграций.
- Для полного сценария стоит добавить:
  - миграционную политику "expand/contract" для backward-compatible релизов;
  - canary/blue-green (с переключением трафика);
  - автоматический capture release note с привязкой к commit SHA и tag.
