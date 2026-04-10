# FitTracker Pro - Telegram Mini App через Ngrok (snapshot)

> Snapshot-документ: содержит временный ngrok URL и состояние на момент создания.
> Для канонической настройки Telegram Mini App используйте `docs/product/telegram-setup.md`.

## ✅ Статус системы

- **Frontend**: ✅ Работает
- **Backend API**: ✅ Работает
- **Database (PostgreSQL)**: ✅ Работает
- **Cache (Redis)**: ✅ Работает
- **Ngrok Tunnel**: ✅ Работает

## 🔗 URLs для доступа

- **Frontend (Telegram Mini App)**: https://postcardiac-uneruptive-dung.ngrok-free.dev
- **Backend API**: https://postcardiac-uneruptive-dung.ngrok-free.dev/api/v1
- **API Health Check**: https://postcardiac-uneruptive-dung.ngrok-free.dev/api/v1/system/ready
- **API Documentation**: https://postcardiac-uneruptive-dung.ngrok-free.dev/docs
- **Ngrok Dashboard**: http://localhost:4040

## 📱 Настройка Telegram Mini App

### Шаг 1: Настройка через BotFather

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/mybots`
3. Выберите вашего бота
4. Нажмите `Bot Settings` > `Menu Button`
5. Нажмите `Configure menu button`
6. Отправьте URL: `https://postcardiac-uneruptive-dung.ngrok-free.dev`
7. Введите название кнопки (например, `FitTracker`)

### Шаг 2: Проверка работы

1. Откройте вашего бота в Telegram
2. Нажмите на кнопку меню (внизу слева)
3. Приложение FitTracker Pro должно открыться внутри Telegram

## 🛠 Управление сервисами

### Запуск системы

```bash
# Запуск всех сервисов с ngrok туннелем
docker-compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d

# Проверка статуса
docker ps --filter "name=fittracker"

# Просмотр URL-адресов ngrok
curl -s http://localhost:4040/api/tunnels | python -m json.tool
```

### Остановка системы

```bash
# Остановка всех сервисов
docker-compose -f docker-compose.yml -f docker-compose.tunnel.yml down

# Или с удалением орфанных контейнеров
docker-compose -f docker-compose.yml -f docker-compose.tunnel.yml down --remove-orphans
```

### Перезапуск ngrok туннеля

```bash
# Перезапуск только туннеля
docker-compose -f docker-compose.yml -f docker-compose.tunnel.yml restart tunnel

# Получение новых URL (если изменились)
curl -s http://localhost:4040/api/tunnels | python -m json.tool
```

### Просмотр логов

```bash
# Backend логи
docker logs fittracker-backend -f

# Frontend логи
docker logs fittracker-frontend -f

# Ngrok логи
docker logs fittracker-ngrok -f
```

## ⚙️ Конфигурация

### Текущие настройки (.env)

```
VITE_API_URL=https://postcardiac-uneruptive-dung.ngrok-free.dev/api/v1
TELEGRAM_WEBAPP_URL=https://postcardiac-uneruptive-dung.ngrok-free.dev
ALLOWED_ORIGINS=https://postcardiac-uneruptive-dung.ngrok-free.dev
```

### Ngrok конфигурация

Конфигурация туннеля находится в `ngrok.fittracker.yml`:

```yaml
version: "2"
tunnels:
  fittracker-frontend:
    proto: http
    addr: frontend:80
  fittracker-backend:
    proto: http
    addr: backend:8000
```

## 🔍 Проверка работы API

```bash
# Health check
curl -s https://postcardiac-uneruptive-dung.ngrok-free.dev/api/v1/system/ready

# API Documentation (Swagger)
# Откройте в браузере: https://postcardiac-uneruptive-dung.ngrok-free.dev/docs

# Версия сервиса
curl -s https://postcardiac-uneruptive-dung.ngrok-free.dev/api/v1/system/version
```

## ⚠️ Важные замечания

1. **Ngrok URL может измениться** при перезапуске туннеля. Если это произойдет:
   - Проверьте новый URL: `curl -s http://localhost:4040/api/tunnels`
   - Обновите URL в BotFather
   - Обновите `.env` файл и перезапустите frontend

2. **Сессия ngrok бесплатной версии** ограничена:
   - Туннель работает до 8 часов
   - URL меняется при каждом перезапуске
   - Для постоянного URL используйте платную версию ngrok

3. **Безопасность**:
   - Ngrok URL публично доступен
   - Не храните чувствительные данные в открытом доступе
   - Используйте аутентификацию для продакшена

## 🐛 Решение проблем

### Frontend не загружается
```bash
# Проверьте статус контейнера
docker ps fittracker-frontend

# Просмотрите логи
docker logs fittracker-frontend

# Перезапустите
docker-compose restart frontend
```

### API не отвечает
```bash
# Проверьте backend
docker ps fittracker-backend

# Проверьте health endpoint напрямую
curl -s http://localhost:18000/health/ready

# Просмотрите логи
docker logs fittracker-backend
```

### Ngrok туннель не работает
```bash
# Проверьте статус туннеля
docker ps fittracker-ngrok

# Проверьте API ngrok
curl -s http://localhost:4040/api/tunnels

# Перезапустите туннель
docker-compose -f docker-compose.yml -f docker-compose.tunnel.yml restart tunnel
```

## 📊 Архитектура текущего запуска

```
Telegram App
    ↓
https://postcardiac-uneruptive-dung.ngrok-free.dev
    ↓
Ngrok Container (fittracker-ngrok)
    ↓
Frontend Nginx (fittracker-frontend:80)
    ├→ Static Files (React App)
    └→ /api/* → Backend (fittracker-backend:8000)
         ├→ PostgreSQL (fittracker-postgres:5432)
         └→ Redis (fittracker-redis:6379)
```

---

**Дата создания**: 2026-04-09  
**Версия**: 1.0.0

