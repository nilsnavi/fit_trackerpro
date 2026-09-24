# FitTracker Pro: пошаговое развёртывание на своём сервере

Дата анализа: 16 сентября 2026. Проверен локальный код на основе коммита `e0ab0dc936df9d7f89d5044c6cc2b560be11d7b8`.

**Результат:** ниже — инструкция и конфигурации для одного Linux-сервера. Это подготовленный сценарий, а не отчёт об успешном развёртывании: сборка образов, миграции, HTTPS и восстановление БД на сервере ещё не проверены. Локальный Docker daemon недоступен по правам. Пользовательские изменения в репозитории сохранены.

## 1. Что разворачиваем

| Компонент | Реализация в проекте | Назначение |
|---|---|---|
| Интерфейс | React 18, TypeScript, Vite, PWA | Telegram Mini App, тренировки и аналитика |
| API | Python 3.11, FastAPI, Gunicorn/Uvicorn | Авторизация, бизнес-логика, API `/api/v1` |
| База | PostgreSQL 15, SQLAlchemy, Alembic | Пользователи, тренировки, справочники |
| Кэш | Redis 7 | Кэш, ограничения запросов и служебное состояние |
| Веб-сервер | Nginx внутри frontend + внешний Nginx | Статика, HTTPS, проксирование |
| Telegram | Проверка подписанного `initData` | Вход через бота и Mini App |

```text
Telegram / браузер → HTTPS :443 → Nginx
                                   ├─ /api/*, /health/* → backend:8000
                                   │                         ├─ PostgreSQL:5432
                                   │                         └─ Redis:6379
                                   └─ остальные URL → frontend:80
```

Снаружи открыты только SSH, HTTP и HTTPS. PostgreSQL, Redis, API и frontend отдельных опубликованных портов не имеют. Node/Python на хосте для запуска приложения не нужны: сборка выполняется Docker.

### Найденные особенности и проблемы

1. Основной `docker-compose.prod.yml` ожидает готовые образы GHCR. В этом комплекте используется **сборка из конкретного Git-коммита на сервере**, без зависимости от доступа к GHCR. Это самостоятельный Compose-файл, не override основного.
2. В backend-образе миграции находятся в `/app/embedded_migrations`. Команда из старого runbook `alembic upgrade head` не указывает существующий конфиг. Здесь используется `alembic -c /app/embedded_migrations/alembic.ini ...` и `PYTHONPATH=/app`.
3. В production Compose всем сервисам назначен `cap_drop: ALL`, хотя стандартные entrypoint PostgreSQL/Redis и запуск Nginx требуют операций смены владельца/пользователя. В примере инфраструктурные контейнеры сохраняют стандартные Docker capabilities; backend работает непривилегированно с `cap_drop: ALL`. `privileged` не используется.
4. Основной edge Nginx работает с UID 101, а `deploy.sh` копирует ключ TLS с правами `600` от root. В комплекте Nginx master запускается стандартным способом от root и читает ключ `600`, worker-процессы — от nginx.
5. Основной edge-конфиг назначает годовой кэш всем `.js`, включая `config.js` и `sw.js`. Новый edge сохраняет политику кэша frontend. Readiness проксируется прямо в API, без зависимости от незакоммиченной локальной правки `frontend/nginx.conf`.
6. `POST /api/v1/users/` и `GET /api/v1/users/{user_id}` сейчас публичные (`backend/app/api/v1/users.py`). В комплекте они закрыты на внешнем Nginx; авторизация `/users/auth/*` сохранена. **Это временная защита периметра, не исправление авторизации внутри приложения и не полный аудит безопасности.** До боевого запуска нужны исправление backend и проверка разграничения доступа двумя аккаунтами.
7. `TELEGRAM_BOT_ENABLED=false` оставлен намеренно, как в production Compose: вход в Mini App работает, обработчик команд бота не запускается. `/start` не обязан отвечать. Webhook закрыт на Nginx. Включение бота внутри четырёх Gunicorn worker-процессов требует отдельного проектирования и проверки.
8. Корневой `.dockerignore` не исключает `backend/.env`; Dockerfile копирует весь backend. Поэтому сборка выполняется из чистого checkout, а секреты находятся **вне исходников**. Нельзя собирать production-образ из текущей рабочей папки с локальным `.env`.
9. Readiness проверяет PostgreSQL и Redis, но не доказывает корректность схемы, Telegram, бизнес-функций или восстановления. Docker Compose не перезапускает контейнер лишь из-за статуса `unhealthy`.
10. В GitHub workflow semver-образ получает тег без `v`, а release deploy берёт исходный release tag. Для будущего GHCR-деплоя нужно проверить точное наличие обоих образов, а не предполагать, что `v1.2.3` и `1.2.3` совпадают.

Основные исходники анализа: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/startup.sh`, `docker-compose.prod.yml`, `nginx/nginx.conf`, `backend/app/settings/config.py`, `database/migrations`, `.github/workflows/build-images.yml` и `deploy.yml`.

## 2. Что подготовить

- Отдельный сервер **Ubuntu Server 24.04 LTS, x86_64**, sudo/root и доступ по SSH-ключу. Инструкция рассчитана на новый сервер без других сайтов на 80/443.
- Для небольшого старта ориентир: **2–4 vCPU, 4 ГБ RAM, 40–60 ГБ SSD**; для сборки комфортнее 8 ГБ RAM. Это оценка, не результат нагрузочного теста. Размер диска зависит от данных и хранения образов/бэкапов.
- Домен, например `fitness.example.com`, с A-записью на публичный IPv4 сервера. AAAA добавлять только при рабочем IPv6 до сервера.
- Telegram-бот и токен от [@BotFather](https://t.me/BotFather); username без `@`.
- Доступ сервера к GitHub, Docker registry, npm, PyPI, Let's Encrypt и Telegram API.
- Отдельное место вне сервера для зашифрованных резервных копий.

Во всех примерах замените `SERVER_IP`, `fitness.example.com`, email и `deploy` на свои значения. На сервере используется **Bash**, не PowerShell. SSH-порт 22 — пример; при другом порте скорректируйте firewall и подключение.

Сначала выполните всё на тестовом сервере/домене с отдельным Telegram-ботом. Боевые данные не используйте до прохождения раздела 11.

## 3. Подготовка ОС и Docker

Подключитесь с Windows:

```powershell
ssh deploy@SERVER_IP
```

На сервере перейдите в административную сессию; следующие серверные команды выполняются от root:

```bash
sudo -i
set -euo pipefail
apt-get update
apt-get install -y ca-certificates curl git openssl ufw certbot dnsutils nano cron
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker version
docker compose version
docker run --rm hello-world
```

Если Docker уже установлен, сначала проверьте его происхождение и существующие контейнеры; не удаляйте конфликтующие пакеты на действующем сервере вслепую. Установка через официальный apt-репозиторий описана в [Docker Docs](https://docs.docker.com/engine/install/ubuntu/).

Firewall на новом сервере:

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

До закрытия текущей SSH-сессии проверьте вход во второй. В панели провайдера также разрешите 80/443 и SSH со своего IP. Опубликованные Docker-порты могут обходить UFW; поэтому не добавляйте публикацию 5432/6379/8000. Это поведение описано в [Docker: firewall limitations](https://docs.docker.com/engine/install/ubuntu/#firewall-limitations).

## 4. Передача комплекта и получение исходников

В **локальном PowerShell**, из этого проекта:

```powershell
scp -r D:\Project\fit_trackerpro\docs\self-hosting deploy@SERVER_IP:/tmp/fittracker-self-hosting
```

На сервере от root:

```bash
install -d -m 0755 /opt/fittracker/deploy /var/lib/fittracker/acme
install -d -m 0700 /etc/fittracker /etc/fittracker/ssl /var/backups/fittracker
install -m 0644 /tmp/fittracker-self-hosting/compose.yml /opt/fittracker/deploy/compose.yml
install -m 0644 /tmp/fittracker-self-hosting/nginx.conf /opt/fittracker/deploy/nginx.conf
install -m 0600 /tmp/fittracker-self-hosting/app.env.example /etc/fittracker/app.env
git clone https://github.com/nilsnavi/fit_trackerpro.git /opt/fittracker/source
cd /opt/fittracker/source
git checkout --detach e0ab0dc936df9d7f89d5044c6cc2b560be11d7b8
git status --short
```

Если репозиторий закрыт, настройте read-only deploy key и используйте SSH URL. Не вставляйте GitHub-токен в URL clone. Если указанный коммит недоступен в remote, передайте/опубликуйте выбранный проверенный коммит: не подменяйте его незаметно на `main`.

`git status --short` должен быть пустым. Локальные незакоммиченные изменения в эту копию не входят. Папка `open-design` — отдельное локальное приложение, для FitTracker не требуется.

Убедитесь, что исходники не содержат файлов с боевыми секретами:

```bash
test ! -e backend/.env
test ! -e frontend/.env
git ls-files 'backend/.env*' 'frontend/.env*'
```

В репозитории есть примеры и `.env.test`: это не основание копировать в них production-секреты. Не загружайте локальные `.env`, дампы и весь рабочий каталог на сервер.

## 5. Настройка переменных

```bash
nano /etc/fittracker/app.env
```

Заполните все `REPLACE_*` и `replace-*` в шаблоне:

| Переменная | Значение |
|---|---|
| `IMAGE_TAG` | Уникальная метка сборки, например первые 12 символов SHA; не `latest` |
| `GIT_COMMIT_SHA` | Полный SHA из `git rev-parse HEAD` |
| `BUILD_TIMESTAMP` | UTC-время, `date -u +%Y-%m-%dT%H:%M:%SZ` |
| `POSTGRES_USER`, `POSTGRES_DB` | Можно оставить `fittracker` |
| `POSTGRES_PASSWORD` | Отдельный случайный hex-пароль |
| `SECRET_KEY` | Другой случайный hex-секрет для JWT |
| `TELEGRAM_BOT_TOKEN` | Настоящий токен от BotFather |
| `TELEGRAM_BOT_USERNAME` | Username бота без `@` |
| `TELEGRAM_WEBAPP_URL` | `https://fitness.example.com` |
| `ALLOWED_ORIGINS` | `https://fitness.example.com`, без `/api/v1`, без `*` |
| `API_URL`, `VITE_API_URL` | `https://fitness.example.com/api/v1` |
| `ADMIN_USER_IDS` | JSON-массив Telegram ID, например `[123456789]`, либо `[]` |
| `FRONTEND_ADMIN_USER_IDS` | Те же ID через запятую, либо пусто; это только UI, права проверяет backend |
| `SENTRY_DSN` | Необязательный DSN; пусто отключает интеграцию |

Два разных секрета сгенерируйте локально на сервере: дважды `openssl rand -hex 32`, затем вставьте их в файл. Не отправляйте значения в чат. Hex выбран, чтобы избежать экранирования `$`, `@`, `%` и других символов в Compose и URL базы.

```bash
chmod 600 /etc/fittracker/app.env
git -C /opt/fittracker/source rev-parse HEAD
date -u +%Y-%m-%dT%H:%M:%SZ
```

Файл `.env` используется Compose для подстановки. Он не передаётся целиком в frontend; бот-токен и DB-пароль поступают только нужным сервисам. В `config.js` допустимы лишь публичные настройки. Новые переменные backend необходимо явно добавлять в `environment` сервиса.

## 6. Постоянная команда управления

Создайте wrapper, чтобы всегда использовать правильные Compose-файл, env и имя проекта:

```bash
cat > /usr/local/sbin/fittracker-compose <<'EOF'
#!/bin/sh
exec docker compose --env-file /etc/fittracker/app.env \
  -p fittracker -f /opt/fittracker/deploy/compose.yml "$@"
EOF
chmod 755 /usr/local/sbin/fittracker-compose
fittracker-compose config --quiet
```

Не запускайте параллельно обычный `docker compose up` из исходников: он выберет dev-файлы и другие тома. Не печатайте полный `compose config` в общие логи — там будут секреты.

## 7. HTTPS и автоматическое продление

Проверьте DNS и что порт 80 пока свободен:

```bash
DOMAIN=fitness.example.com
EMAIL=admin@example.com
dig +short A "$DOMAIN"
dig +short AAAA "$DOMAIN"
ss -lntp
certbot certonly --standalone --cert-name fittracker \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive
install -m 0644 /etc/letsencrypt/live/fittracker/fullchain.pem /etc/fittracker/ssl/fullchain.pem
install -m 0600 /etc/letsencrypt/live/fittracker/privkey.pem /etc/fittracker/ssl/privkey.pem
```

Если 80 занят другим сайтом, этот сценарий требует адаптации существующего reverse proxy; не останавливайте чужой сервис. Если ACME-проверка не проходит, проверьте A/AAAA, firewall провайдера и отсутствие прокси DNS.

После запуска приложения в разделе 9 переведите renewal на webroot, чтобы продление не требовало остановки Nginx:

```bash
certbot reconfigure --cert-name fittracker \
  --authenticator webroot --webroot-path /var/lib/fittracker/acme
install -d /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/fittracker <<'EOF'
#!/bin/sh
set -eu
[ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/fittracker ] || exit 0
install -m 0644 "$RENEWED_LINEAGE/fullchain.pem" /etc/fittracker/ssl/fullchain.pem
install -m 0600 "$RENEWED_LINEAGE/privkey.pem" /etc/fittracker/ssl/privkey.pem
/usr/local/sbin/fittracker-compose exec -T nginx nginx -t
/usr/local/sbin/fittracker-compose exec -T nginx nginx -s reload
EOF
chmod 750 /etc/letsencrypt/renewal-hooks/deploy/fittracker
systemctl enable --now certbot.timer
certbot renew --cert-name fittracker --dry-run
systemctl list-timers certbot.timer
```

Команда `reconfigure` нужна после запуска: webroot должен быть доступен через HTTP. Не оставляйте первоначальный standalone renewal при занятом порте 80. `--dry-run` проверяет ACME-продление, но по умолчанию не выполняет deploy hook. Его пути/права и reload отдельно проверьте:

```bash
RENEWED_LINEAGE=/etc/letsencrypt/live/fittracker /etc/letsencrypt/renewal-hooks/deploy/fittracker
```

Механизм webroot, `reconfigure` и hooks описан в [Certbot User Guide](https://eff-certbot.readthedocs.io/en/stable/using.html).

## 8. Сборка, база и миграции

```bash
fittracker-compose pull postgres redis nginx
fittracker-compose build --pull backend frontend
fittracker-compose up -d --wait --wait-timeout 180 postgres redis
fittracker-compose run --rm --no-deps backend \
  alembic -c /app/embedded_migrations/alembic.ini heads
fittracker-compose run --rm --no-deps backend \
  alembic -c /app/embedded_migrations/alembic.ini upgrade head
fittracker-compose run --rm --no-deps backend \
  alembic -c /app/embedded_migrations/alembic.ini current
fittracker-compose run --rm --no-deps -e REFERENCE_DATA_DIR=/app/reference_data \
  backend python3 -m app.cli.seed_reference_data apply
```

Продолжайте только после успешного завершения каждой команды. `current` должен соответствовать `heads`. Если несколько голов, ошибка миграции или конфликт справочников — остановитесь и разберите схему. Не используйте `stamp head` для сокрытия невыполненных миграций и не заменяйте Alembic автоматическим `create_all`.

Для первого запуска БД пустая. Для существующей базы обязательно выполните backup из раздела 12 **до** `upgrade head`.

Dockerfile frontend запускает `build-only`, то есть сборка образа не включает TypeScript typecheck или тесты. Перед боевым релизом нужны успешные проверки CI (`test.yml`, `security.yml`) либо эквивалентные локальные проверки. Список зависимостей в этой копии отличается от ранее проверявшихся клонов; старый результат аудита зависимостей к ней не применяется.

## 9. Запуск и технические проверки

```bash
fittracker-compose up -d --no-build --wait --wait-timeout 240 backend frontend
fittracker-compose run --rm --no-deps nginx nginx -t
fittracker-compose up -d --no-build --wait --wait-timeout 120 nginx
fittracker-compose ps
curl -fsS https://fitness.example.com/health
curl -fsS https://fitness.example.com/api/v1/system/ready
curl -fsS https://fitness.example.com/health/ready
curl -fsS https://fitness.example.com/api/v1/system/version
curl -fsS https://fitness.example.com/config.js
curl -sSI https://fitness.example.com/sw.js
```

Ожидается:

- все пять сервисов работают и healthy;
- health: `status=healthy`;
- readiness: `status=ready`, `checks.postgres=ok`, `checks.redis=ok`;
- version: SHA/версия новой сборки;
- `/config.js`: ваш HTTPS API URL, без токенов/паролей и localhost;
- `config.js`/`sw.js` не получают `max-age=31536000`/`immutable`;
- страница приложения открывается; прямой браузер может попросить открыть приложение в Telegram — это нормально.

Теперь завершите настройку renewal из раздела 7. Проверьте HTTP → HTTPS и срок сертификата:

```bash
curl -sSI http://fitness.example.com/
openssl x509 -in /etc/fittracker/ssl/fullchain.pem -noout -enddate
```

## 10. Telegram

1. В BotFather откройте `/mybots` → ваш бот → **Bot Settings → Menu Button**, установите `https://fitness.example.com`. Альтернатива — `/setmenubutton`.
2. Убедитесь, что это тот же бот, чей токен записан на сервере.
3. Откройте личный чат с ботом и его кнопку приложения; проверьте регистрацию/вход.
4. Если нужен запуск из профиля бота, настройте Main Mini App в BotFather на тот же HTTPS URL.
5. В данном режиме webhook не настраивается: авторизация Mini App не требует polling/webhook. Существующий бот на другом сервере может продолжать обслуживать команды, если это осознанная конфигурация.

Способы запуска и требования к проверке `initData`: [Telegram Mini Apps](https://core.telegram.org/bots/webapps). Никогда не подставляйте production `initData` в frontend build и не включайте dev-обход авторизации.

## 11. Приёмка перед боевым запуском

Проверки внешнего периметра, без создания пользователей:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://fitness.example.com/api/v1/users/1
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://fitness.example.com/api/v1/users/
curl -sS -o /dev/null -w '%{http_code}\n' https://fitness.example.com/api/v1/users/me
```

Первые две команды должны дать **403** от Nginx. Третья — **401/403** без токена. Затем вручную:

- [ ] Первый вход нового Telegram-пользователя, повторный вход, обновление сессии.
- [ ] Создание тренировки, подходы, завершение, история и аналитика.
- [ ] Изменение профиля и повторное открытие Mini App после закрытия.
- [ ] Проверка в Telegram Android/iOS и Telegram Web; нет блокировки iframe.
- [ ] Второй аккаунт не видит и не меняет данные первого.
- [ ] Backend-авторизация публичных legacy user endpoints исправлена и проверена до массового запуска; временный edge-фильтр не считается завершённым исправлением.
- [ ] Доступны только предусмотренные внешние порты.
- [ ] Восстановление дампа проверено, резервная копия вынесена за пределы сервера.
- [ ] Пройден тест отката, сохранён предыдущий образ и SHA.
- [ ] Успешны актуальные проверки зависимостей/CI; configured alerts действительно доходят ответственному.

До этого корректный статус — «инфраструктура запущена / приёмка не завершена», а не «production готов».

## 12. Резервные копии и восстановление

PostgreSQL хранится в Docker volume `fittracker_postgres_data`, Redis — `fittracker_redis_data`. Не выполняйте `down -v`, `docker volume prune` или очистку Docker data root на рабочем сервере.

Создайте скрипт резервирования:

```bash
cat > /usr/local/sbin/fittracker-backup <<'EOF'
#!/bin/bash
set -euo pipefail
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="/var/backups/fittracker/${stamp}.dump"
/usr/local/sbin/fittracker-compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${target}.part"
test -s "${target}.part"
mv "${target}.part" "$target"
/usr/local/sbin/fittracker-compose exec -T postgres pg_restore --list < "$target" >/dev/null
sha256sum "$target" > "${target}.sha256"
cp /etc/fittracker/app.env "/var/backups/fittracker/${stamp}.env"
tar -czf "/var/backups/fittracker/${stamp}.deploy.tgz" -C /opt/fittracker deploy
EOF
chmod 750 /usr/local/sbin/fittracker-backup
fittracker-backup
printf '%s\n' '15 3 * * * root /usr/local/sbin/fittracker-backup >> /var/log/fittracker-backup.log 2>&1' \
  > /etc/cron.d/fittracker-backup
chmod 644 /etc/cron.d/fittracker-backup
```

`pg_restore --list` проверяет читаемость архива, но не заменяет восстановление. Файлы `.env` содержат секреты: шифруйте комплект при переносе. Настройте ежедневное копирование в отдельное хранилище и сигнал об ошибке задания. Ориентир хранения — 7 ежедневных и 4 еженедельных копии; удалять старые можно только после проверки внешней копии. Команды автоматического удаления намеренно не включены.

Проверка восстановления **в новую временную БД**, без перезаписи рабочей:

```bash
DUMP=/var/backups/fittracker/ЗАМЕНИТЕ_НА_ИМЯ.dump
test -s "$DUMP"
RESTORE_DB=fittracker_restore_$(date -u +%Y%m%d%H%M%S)
fittracker-compose exec -T -e RESTORE_DB="$RESTORE_DB" postgres \
  sh -c 'createdb -U "$POSTGRES_USER" "$RESTORE_DB"'
fittracker-compose exec -T -e RESTORE_DB="$RESTORE_DB" postgres \
  sh -c 'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$RESTORE_DB"' < "$DUMP"
fittracker-compose exec -T -e RESTORE_DB="$RESTORE_DB" postgres \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$RESTORE_DB" -c "SELECT version_num FROM alembic_version;" -c "SELECT count(*) FROM users;"'
```

Сопоставьте число записей и контрольные сущности с исходной БД. Для полной репетиции подключите к восстановленной БД отдельное тестовое приложение и проверьте тренировки/профили. Удалите временную БД вручную после проверки её точного имени; не подставляйте туда `POSTGRES_DB`.

Redis хранит кэш и служебное состояние, включая данные идемпотентности; его потеря может сбросить эти гарантии/ограничения. В обычном обновлении сохраняйте его volume. Для полного disaster recovery отдельно зафиксируйте необходимость согласованного Redis backup, а не копируйте живые AOF-файлы вслепую.

## 13. Обновление и откат

### Обновление с плановым перерывом

1. Проверьте CI выбранного коммита и описание миграций на тестовом окружении.
2. Сохраните `/etc/fittracker/app.env` и каталог `deploy` в защищённом backup-каталоге. Запишите предыдущий `IMAGE_TAG` и полный SHA. Сохраните старые локальные образы; новый tag должен отличаться.
3. В чистом checkout выполните `git fetch origin`, затем `git checkout --detach НОВЫЙ_SHA`. Установите новые `IMAGE_TAG`, `GIT_COMMIT_SHA`, `BUILD_TIMESTAMP` в app.env. Выполните `fittracker-compose config --quiet` и `fittracker-compose build --pull backend frontend`.
4. Остановите запись: `fittracker-compose stop nginx frontend backend`. Сделайте `fittracker-backup`. Убедитесь, что предыдущий env из шага 2 сохранён отдельно: текущий backup уже содержит новую метку.
5. Выполните миграцию и seed из раздела 8. При ошибке не запускайте новый backend и не скрывайте ошибку.
6. Запустите `fittracker-compose up -d --no-build --wait --wait-timeout 240 backend frontend`, затем `fittracker-compose up -d --no-build --wait nginx`.
7. Повторите readiness, version и Telegram smoke. Зафиксируйте время релиза, SHA и путь к pre-deploy dump.

Не запускайте `pull backend frontend` в этом сценарии: эти образы собираются локально. Если обновился IP контейнера backend/frontend, edge Nginx нужно пересоздать или перезапустить, чтобы обновить DNS upstream; описанная остановка/запуск это обеспечивает.

### Откат только приложения

Допустим, только если старая версия совместима с новой схемой БД:

1. Остановите `nginx frontend backend`.
2. Восстановите предыдущий `IMAGE_TAG` в env и при необходимости предыдущую конфигурацию deploy.
3. Проверьте наличие `docker image inspect fittracker-backend:ПРЕДЫДУЩИЙ_TAG` и аналогичного frontend.
4. Запустите backend/frontend, затем nginx командами из раздела 9 с `--no-build`.
5. Повторите smoke-проверки. Не пересобирайте старый тег из нового кода.

### Если нужен возврат БД

Не делайте безусловный `alembic downgrade`: миграции могут быть необратимыми. Остановите записи, сохраните аварийный дамп текущей базы, восстановите pre-deploy dump в **новую** БД по разделу 12. Укажите имя восстановленной базы в `POSTGRES_DB`, верните предыдущий `IMAGE_TAG`, затем запустите старое приложение и проверьте данные. Существующий volume PostgreSQL сохранится; изменение `POSTGRES_DB` само по себе не создаёт базу, поэтому `createdb` обязателен. Новые записи после даты дампа будут отсутствовать — перед переключением согласуйте допустимую потерю данных.

Изменение `POSTGRES_PASSWORD` в env также не меняет пароль уже созданной роли PostgreSQL: ротация требует отдельного изменения роли в БД и согласованного обновления API.

## 14. Эксплуатация и диагностика

```bash
fittracker-compose ps
fittracker-compose logs --tail=150 backend
fittracker-compose logs --tail=150 frontend nginx
fittracker-compose logs --tail=100 postgres redis
docker stats --no-stream
df -h
docker system df
```

| Симптом | Что проверить |
|---|---|
| `502 Bad Gateway` | Backend/frontend healthy, миграции, логи; после пересоздания upstream перезапустить nginx |
| `503` readiness | PostgreSQL/Redis, пароль, заполнение диска, лимиты памяти |
| Экран обслуживания при HTTP 200 | `/health/ready` должен отдавать JSON, не HTML SPA |
| `No config file ... alembic.ini` | Использовать `-c /app/embedded_migrations/alembic.ini` |
| Ошибка seed/table missing | Сначала успешный `upgrade head`; `REFERENCE_DATA_DIR=/app/reference_data` |
| `Invalid hash` / Telegram 401 | Совпадение бота/токена, свежее initData, правильное время сервера (`timedatectl`) |
| Старый API URL | `config.js`, no-store, пересоздание frontend после изменения env, повторное открытие Mini App |
| Бот молчит на `/start` | В этом сценарии bot runtime отключён; запускать Mini App кнопкой меню |
| Ошибка сертификата | DNS, права ключа, `nginx -t`, `certbot renew --dry-run`, timer/hooks |
| Сборка убита / OOM | RAM и диск, лог Docker; лимиты сборки не равны runtime mem_limit |
| `manifest unknown` | Для GHCR проверить точное имя тега; локальный сценарий использует `build` |

Внешний монитор должен проверять `/api/v1/system/ready`, срок TLS, место на диске и возраст последнего **внешнего** backup. Sentry опционален. Каталог `monitoring/` существует, но его сеть/доступы требуют отдельной настройки под этот Compose; не запускайте его вслепую с публичными панелями.

Для обычной остановки: `fittracker-compose stop`. Для запуска после неё повторите последовательность раздела 9. Сервисы имеют `restart: unless-stopped` и запускаются после перезагрузки ОС, если ранее не были явно остановлены.

## 15. Что ещё требуется для завершённого production-релиза

Эта инструкция покрывает установку, конфигурацию, первый запуск, HTTPS, Telegram, обслуживание и восстановление. Локальная статическая проверка `docker compose ... config --quiet` с примером env прошла; она проверяет структуру Compose, но не запускает контейнеры. `nginx -t`, сборка, миграции и серверная приёмка здесь не выполнялись. Фактический релиз считается завершённым только после сборки и тестирования на выбранном сервере, исправления авторизации legacy API, проверки актуальных зависимостей и прохождения приёмки.

Основной CI/CD проекта и этот ручной сценарий используют разные пути и имена образов. **Не включайте GitHub Deploy поверх этого сервера без адаптации workflow**: текущий workflow записывает собственный env/Compose и использует GHCR. Автоматизацию подключайте после успешного ручного развёртывания, сохранив проверенную последовательность backup → migrate → seed → up → verify.
