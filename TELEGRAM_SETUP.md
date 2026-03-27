# Telegram Mini App Setup

Current setup guide for FitTracker Pro Telegram authentication and Mini App launch.

## 1) Create and configure bot

1. Open [@BotFather](https://t.me/BotFather)
2. Create a bot with `/newbot`
3. Save the token (`TELEGRAM_BOT_TOKEN`)
4. Open `/mybots` -> your bot -> **Bot Settings** -> **Menu Button**
5. Set Mini App URL to your frontend domain (for example `https://fit.example.com`)

## 2) Environment variables

`backend/.env`:

```env
TELEGRAM_BOT_TOKEN=123456789:your_token
TELEGRAM_WEBAPP_URL=https://fit.example.com
SECRET_KEY=change-me-to-strong-secret
```

`frontend/.env`:

```env
VITE_API_URL=https://fit.example.com/api/v1
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
```

## 3) Backend endpoints (current)

- `POST /api/v1/auth/telegram` - validate `init_data`, create/update user, return JWT pair
- `GET /api/v1/auth/me` - current user profile
- `PUT /api/v1/auth/me` - update profile
- `POST /api/v1/auth/refresh` - refresh token
- `POST /api/v1/auth/logout` - logout

## 4) Frontend auth flow

1. Get `initData` from Telegram WebApp SDK
2. Send it to `POST /api/v1/auth/telegram`
3. Store access/refresh tokens
4. Use access token as `Authorization: Bearer <token>`
5. Refresh via `/auth/refresh` on 401/expiry

## 5) Validation model used by backend

Backend verifies Telegram payload with:
- HMAC-SHA256 signature validation (`hash`)
- `auth_date` freshness check
- safe parsing of user data from `init_data`

Implementation lives in `backend/app/utils/telegram_auth.py` and is consumed by the auth service layer.

## 6) Local testing

Telegram requires HTTPS for real WebApp launch. For local validation:

- Run app locally (`docker-compose up -d`)
- Expose frontend with tunnel (`ngrok`/`cloudflared`)
- Put tunnel HTTPS URL into BotFather menu button
- Re-open Mini App from Telegram

## 7) Troubleshooting

- **Invalid hash**: wrong `TELEGRAM_BOT_TOKEN` or modified `init_data`
- **Mini App does not open**: URL in BotFather not HTTPS or mismatched domain
- **401 from `/auth/me`**: expired/missing token or wrong `Authorization` header
- **CORS errors**: check `ALLOWED_ORIGINS` in backend env

## 8) Security notes

- Never expose `TELEGRAM_BOT_TOKEN` in frontend
- Keep short token TTLs and rotate `SECRET_KEY` when needed
- Always use HTTPS in production
