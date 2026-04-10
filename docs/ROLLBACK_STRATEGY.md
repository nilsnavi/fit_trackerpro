# Rollback Strategy (P1) — Schema-Evolving Releases

Цель: дать on-call быстрый и безопасный выбор сценария отката после неудачного релиза, где могли измениться и приложение, и схема БД.

Базовый принцип:
- сначала выбираем минимально-разрушительный сценарий;
- откат образов выполняем почти всегда;
- rollback схемы/данных делаем только при явных сигналах несовместимости.

Быстрый one-page режим для дежурного: `docs/ROLLBACK_ONCALL_CHEATSHEET.md`.

## 1. Что делает текущий CI/CD (source of truth)

Актуальный production/staging pipeline:
1. `resolve-tag` (проверка versioned `IMAGE_TAG`, не `latest`)
2. `build` (для `release`) или `build-skipped` (для `workflow_dispatch`)
3. `pre-deploy-validate` (secrets/compose/nginx)
4. `migrate`:
- сохраняет `PREVIOUS_IMAGE_TAG` (если был)
- пишет `.rollback-meta.env`
- делает pre-deploy backup БД (`DB_BACKUP_PATH`)
- выполняет `alembic upgrade head`
- выполняет idempotent seed
5. `deploy` (`docker-compose up -d` + host checks)
6. `verify` (smoke checks)
7. `record-stable` (пишет `.last-stable-deploy.env` только после полного успеха)
8. `rollback` (автозапуск при падении `migrate`/`deploy`/`verify`)

Реализация:
- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-environment.yml`
- `.github/workflows/rollback-production.yml` (ручной rollback workflow)

## 2. Типы rollback-сценариев

### Сценарий A: rollback только image/app

Применяем, если:
- нет признаков поломки схемы БД;
- миграции только backward-compatible (expand), или миграции вообще не затрагивали проблемную функциональность;
- ошибка в коде/конфиге/интеграции приложения.

Действия:
1. Откатить `IMAGE_TAG` на `PREVIOUS_IMAGE_TAG` (auto rollback или manual workflow).
2. Не выполнять restore БД.
3. Проверить `/api/v1/system/health`, `/api/v1/system/version`, `/health`, ключевые бизнес-эндпоинты.

Риск: низкий, потому что данные не перезаписываются.

### Сценарий B: rollback image/app + migration downgrade

Применяем, если:
- новый релиз требует схему, несовместимую со старым приложением;
- есть корректный `downgrade()` для конкретной миграции;
- откат можно сделать без потери критичных данных.

Действия:
1. Зафиксировать deploy freeze.
2. Откатить image на предыдущий стабильный tag.
3. Выполнить `alembic downgrade <target_revision>` до совместимой ревизии.
4. Повторно проверить health/smoke.

Когда предпочтительнее restore:
- `downgrade()` неполный/небезопасный;
- миграция включала необратимые data-transform операции;
- downgrade не возвращает консистентное состояние данных.

Риск: средний. Требует ручного подтверждения ревизии и валидации данных.

### Сценарий C: rollback image/app + database restore

Применяем, если:
- зафиксирована data corruption/невосстановимая несовместимость после миграции;
- downgrade невозможен или уже провалился;
- нужен полный возврат к pre-deploy snapshot.

Действия:
1. Откатить image на предыдущий стабильный tag.
2. Восстановить БД из `DB_BACKUP_PATH` (создан в `migrate` stage).
3. Прогнать smoke + базовые доменные проверки целостности.

Важно:
- `rollback_restore_db=true` по умолчанию выключен и должен включаться осознанно.
- Restore перезаписывает post-backup изменения данных.

Риск: высокий (возможна потеря изменений после момента backup).

## 3. Decision Tree для on-call

1. Падение релиза затрагивает только app/runtime (5xx, broken UI/API), а схема выглядит совместимой?
- Да -> Сценарий A (image/app rollback only).
- Нет -> перейти к шагу 2.

2. Проблема связана со схемой (ошибки SQL/ORM, missing column/table, migration mismatch)?
- Нет -> Сценарий A.
- Да -> перейти к шагу 3.

3. Есть проверенный и безопасный `downgrade()` для нужной ревизии без риска неконсистентных данных?
- Да -> Сценарий B (image rollback + migration downgrade).
- Нет -> перейти к шагу 4.

4. Есть валидный pre-deploy backup (`DB_BACKUP_PATH`) и допустима потеря post-backup записей?
- Да -> Сценарий C (image rollback + DB restore).
- Нет -> аварийный ручной режим: стабилизация сервиса (A), затем инцидентный план с DBA/Backend owner.

## 4. Edge case: первый deploy

Проблема:
- на первом деплое `PREVIOUS_IMAGE_TAG` пустой;
- автоматический rollback образов из `deploy-environment.yml` завершится ошибкой (это ожидаемо).

Безопасный порядок:
1. Запустить `.github/workflows/rollback-production.yml` вручную.
2. Передать `rollback_image_tag` явно (последний известный рабочий тег).
3. `rollback_restore_db=true` включать только при необходимости и только при наличии валидного `DB_BACKUP_PATH`.
4. Если рабочего тега нет, rollback образа невозможен: фиксировать инцидент, выполнять hotfix/redeploy.

## 5. Совместимость rollback с текущим CI/CD

Проверка соответствия выполнена:
- rollback hook срабатывает после `migrate`/`deploy`/`verify` fail (`always()` + failure condition).
- pre-deploy backup создается до `alembic upgrade head` и путь сохраняется в `.rollback-meta.env`.
- `record-stable` обновляет last-stable только после полного success (migrate+deploy+verify).
- ручной rollback workflow умеет брать tag в приоритете:
1) explicit `rollback_image_tag`
2) `.rollback-meta.env: PREVIOUS_IMAGE_TAG`
3) `.last-stable-deploy.env: LAST_STABLE_PREVIOUS_TAG`

Ограничения, которые остаются системными:
- автоматический rollback не делает `alembic downgrade`;
- database restore автоматом не включается для release-события;
- при первом деплое auto rollback image недоступен без явного тега.

## 6. Operational Checklist (короткий)

Перед откатом:
- [ ] Определить тип инцидента: app-only / schema / data corruption.
- [ ] Подтвердить текущий этап падения: `migrate`, `deploy` или `verify`.
- [ ] Проверить наличие `.rollback-meta.env` и `DB_BACKUP_PATH`.
- [ ] Зафиксировать deploy freeze и уведомить on-call канал.

Во время отката:
- [ ] Выполнить выбранный сценарий (A/B/C) без смешивания шагов.
- [ ] Для downgrade: зафиксировать целевую ревизию и команду.
- [ ] Для restore: подтвердить допуск к потере post-backup данных.

После отката:
- [ ] Проверить `/api/v1/system/health`, `/api/v1/system/version`, `/health`.
- [ ] Проверить ключевые бизнес-потоки (логин/тренировки/шаблоны).
- [ ] Создать incident note: причина, сценарий, итог, дальнейший fix-forward план.

## 7. Быстрые команды (manual fallback по SSH)

Откат только image/app:

```bash
cd ~/fittracker-pro
source .rollback-meta.env
sed -i -E "s|^IMAGE_TAG=.*|IMAGE_TAG=${PREVIOUS_IMAGE_TAG}|" .env
docker-compose -f docker-compose.prod.yml pull backend frontend
docker-compose -f docker-compose.prod.yml up -d
```

Migration downgrade (пример):

```bash
cd ~/fittracker-pro
docker-compose -f docker-compose.prod.yml exec -T backend alembic current
docker-compose -f docker-compose.prod.yml exec -T backend alembic history --indicate-current
docker-compose -f docker-compose.prod.yml exec -T backend alembic downgrade <target_revision>
```

DB restore из pre-deploy backup:

```bash
cd ~/fittracker-pro
source .rollback-meta.env
docker-compose -f docker-compose.prod.yml up -d postgres
docker exec -i fittracker-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DB_BACKUP_PATH"
```

---

Последнее обновление: 2026-04-10
