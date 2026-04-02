# FitTracker Pro - Чеклист готовности к запуску ✅

## 📋 Pre-flight проверка

Перед запуском проекта убедитесь, что все компоненты готовы.

---

## 1️⃣ Требования к окружению

### Обязательные требования
- [ ] Docker установлен (версия 27+)
- [ ] Docker Compose v5+
- [ ] Git установлен
- [ ] Есть доступ к интернету (для загрузки образов)

**Проверка:**
```bash
docker --version          # Должен быть 27.x
docker compose version    # Должен быть v5.x
git --version
```

---

## 2️⃣ Файлы окружения

### Backend (.env)
- [ ] Файл `backend/.env` существует
- [ ] `SECRET_KEY` установлен (минимум 32 символа)
- [ ] `TELEGRAM_BOT_TOKEN` установлен (если нужен бот)
- [ ] `TELEGRAM_WEBAPP_URL` настроен
- [ ] `DATABASE_URL` корректный
- [ ] `REDIS_URL` корректный
- [ ] `ENVIRONMENT` соответствует режиму (development/test/production)
- [ ] `DEBUG=true` для разработки, `false` для production
- [ ] `ALLOWED_ORIGINS` содержит нужные URL

**Генерация SECRET_KEY:**
```bash
# Windows (PowerShell)
python -c "import secrets; print(secrets.token_hex(32))"

# Unix/macOS
openssl rand -hex 32
```

### Frontend (.env)
- [ ] Файл `frontend/.env` существует
- [ ] `VITE_API_URL` указывает на правильный API endpoint
- [ ] `VITE_ENVIRONMENT` настроен

---

## 3️⃣ База данных

### PostgreSQL
- [ ] PostgreSQL доступен (в Docker или на хосте)
- [ ] Пользователь БД создан
- [ ] Пароль БД установлен
- [ ] База данных создана
- [ ] Порт правильный (15432 для Docker, 5432 для локального)

**Проверка подключения:**
```bash
# Для Docker
docker exec fittracker-postgres psql -U fittracker -d fittracker -c "SELECT version();"

# Для локальной БД
psql postgresql://fittracker:fittracker_password@localhost:5432/fittracker -c "SELECT version();"
```

### Миграции
- [ ] Alembic настроен
- [ ] Миграции применены (`alembic upgrade head`)
- [ ] Таблицы созданы

**Проверка миграций:**
```bash
docker compose exec backend alembic current
docker exec fittracker-postgres psql -U fittracker -d fittracker -c "\dt"
```

---

## 4️⃣ Redis

- [ ] Redis доступен (в Docker или на хосте)
- [ ] Порт правильный (16379 для Docker, 6379 для локального)
- [ ] Подключение работает

**Проверка:**
```bash
# Для Docker
docker exec fittracker-redis redis-cli ping

# Для локального
redis-cli ping
```

---

## 5️⃣ Telegram Bot (опционально)

- [ ] Бот создан через @BotFather
- [ ] Токен бота получен и добавлен в `.env`
- [ ] Web App URL настроен в @BotFather
- [ ] TELEGRAM_BOT_ENABLED=true (если нужен бот)

**Проверка токена:**
```bash
curl https://api.telegram.org/bot<ВАШ_ТОКЕН>/getMe
```

---

## 6️⃣ CORS и безопасность

### Development
- [ ] `ALLOWED_ORIGINS` содержит localhost порты
- [ ] `DEBUG=true`
- [ ] `ENVIRONMENT=development`

### Production
- [ ] `ALLOWED_ORIGINS` не содержит `*`
- [ ] `ALLOWED_ORIGINS` содержит только HTTPS URL
- [ ] `DEBUG=false`
- [ ] `ENVIRONMENT=production`
- [ ] `SECRET_KEY` уникальный (не дефолтный)
- [ ] `DATABASE_URL` использует PostgreSQL (не SQLite)
- [ ] `TELEGRAM_BOT_TOKEN` реальный (не дефолтный)
- [ ] `TELEGRAM_WEBAPP_URL` production домен

---

## 7️⃣ Запуск Docker

### Старт
- [ ] Все контейнеры запущены
- [ ] Контейнеры в статусе "healthy"

**Команды:**
```bash
# Запустить весь стек
docker compose --env-file backend/.env --env-file frontend/.env up -d --build

# Проверить статус
docker compose ps

# Посмотреть логи
docker compose logs -f
```

### Ожидаемый статус
```
NAME                  STATUS              PORTS
fittracker-backend    Up (healthy)        0.0.0.0:18000->8000/tcp
fittracker-frontend   Up (healthy)        0.0.0.0:18080->80/tcp
fittracker-postgres   Up (healthy)        0.0.0.0:15432->5432/tcp
fittracker-redis      Up (healthy)        0.0.0.0:16379->6379/tcp
```

---

## 8️⃣ Применение миграций

- [ ] Миграции выполнены успешно

**Команда:**
```bash
docker compose --env-file backend/.env --env-file frontend/.env exec backend alembic upgrade head
```

**Ожидаемый вывод:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade -> <revision>
...
OK
```

---

## 9️⃣ Проверка API

### Health Check
- [ ] `/api/v1/system/health` возвращает `{"status": "healthy"}`

**Проверка:**
```bash
curl http://localhost:18000/api/v1/system/health
```

**Ожидаемый ответ:**
```json
{"status": "healthy"}
```

### Version
- [ ] `/api/v1/system/version` возвращает версию

**Проверка:**
```bash
curl http://localhost:18000/api/v1/system/version
```

**Ожидаемый ответ:**
```json
{
  "name": "FitTracker Pro API",
  "version": "1.0.0",
  "commit_sha": null,
  "build_timestamp": null
}
```

### Root
- [ ] `/` возвращает информацию о API

**Проверка:**
```bash
curl http://localhost:18000/
```

**Ожидаемый ответ:**
```json
{
  "message": "FitTracker Pro API",
  "version": "1.0.0",
  "docs": "/docs"
}
```

---

## 🔟 Проверка фронтенда

- [ ] Фронтенд загружается
- [ ] Нет ошибок в консоли браузера
- [ ] API вызовы работают

**Проверка:**
```bash
curl http://localhost:18080/
```

**В браузере:**
- Открыть http://localhost:18080
- Проверить консоль разработчика (F12) на наличие ошибок
- Проверить Network tab на наличие failed запросов

---

## 1️⃣1️⃣ Логи и мониторинг

### Логи без ошибок
- [ ] Backend логи чистые (ERROR level отсутствует)
- [ ] Frontend логи чистые
- [ ] Database логи без ошибок

**Проверка:**
```bash
# Backend
docker logs fittracker-backend --tail 100 | Select-String "ERROR|CRITICAL|FATAL"

# Frontend
docker logs fittracker-frontend --tail 100 | Select-String "error|critical"

# PostgreSQL
docker logs fittracker-postgres --tail 100 | Select-String "error|fatal"
```

---

## 1️⃣2️⃣ Интеграция с Telegram (если используется)

- [ ] Бот отвечает на `/start`
- [ ] Mini App открывается в Telegram
- [ ] WebApp initData валидируется
- [ ] Аутентификация работает

**Проверка:**
1. Открыть бота в Telegram
2. Нажать `/start`
3. Кликнуть на Menu Button или перейти по ссылке Web App
4. Проверить авторизацию

---

## 🎯 Финальный чеклист

### Development готов
- [ ] Все сервисы запущены
- [ ] API доступно (health check проходит)
- [ ] Фронтенд работает
- [ ] База данных мигрирована
- [ ] Можно начинать разработку

### Production готов
- [ ] Все pre-flight проверки пройдены
- [ ] ENVIRONMENT=production
- [ ] DEBUG=false
- [ ] Все секреты установлены
- [ ] Миграции применены
- [ ] Health check проходит
- [ ] Мониторинг настроен (Sentry, Prometheus)
- [ ] Бэкапы настроены
- [ ] SSL/TLS настроен
- [ ] Можно деплоить

---

## 🆘 Если что-то не прошло

### Контейнеры не запускаются
```bash
# Посмотреть логи всех сервисов
docker compose logs

# Пересобрать
docker compose build

# Начать заново
docker compose down -v
docker compose up -d --build
```

### Миграции не применяются
```bash
# Проверить текущую ревизию
docker compose exec backend alembic current

# Откатиться и применить заново
docker compose exec backend alembic downgrade base
docker compose exec backend alembic upgrade head
```

### API не отвечает
```bash
# Проверить health check внутри контейнера
docker exec fittracker-backend curl http://127.0.0.1:8000/api/v1/system/health

# Перезапустить backend
docker compose restart backend
```

### Фронтенд не грузится
```bash
# Проверить конфиг
docker exec fittracker-frontend cat /usr/share/nginx/html/config.js

# Пересобрать фронтенд
docker compose build frontend
docker compose restart frontend
```

---

## 📚 Дополнительная информация

- [QUICKSTART.md](./QUICKSTART.md) - быстрая инструкция
- [LAUNCH_GUIDE.md](./LAUNCH_GUIDE.md) - подробный гайд
- [README.md](./README.md) - основная документация
- [docs/deployment.md](./docs/deployment.md) - production деплой
