# Telegram WebApp Integration Setup Guide

## Overview

This guide covers the setup and configuration of Telegram WebApp integration for FitTracker Pro, including authentication, theme support, and haptic feedback.

## Files Created

### Frontend
- `frontend/src/hooks/useTelegramWebApp.ts` - Main hook for Telegram WebApp integration
- `frontend/src/types/telegram.ts` - TypeScript types for Telegram WebApp API
- `frontend/src/components/auth/TelegramAuthExample.tsx` - Example usage component

### Backend
- `backend/app/utils/telegram_auth.py` - Telegram initData validation utilities
- `backend/app/api/auth.py` - Authentication endpoints

## Bot Token Setup

### 1. Create a Bot with BotFather

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Start a conversation and send `/newbot`
3. Follow the prompts to name your bot
4. Save the **HTTP API Token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Configure WebApp

1. Send `/mybots` to BotFather
2. Select your bot
3. Click **Bot Settings** → **Menu Button** → **Configure menu button**
4. Send the URL where your WebApp is hosted (e.g., `https://yourdomain.com`)

### 3. Set Environment Variables

Create or update `backend/.env`:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBAPP_URL=https://yourdomain.com

# Security (generate a strong secret key)
SECRET_KEY=your-super-secret-key-here-min-32-chars
```

Generate a secure secret key:
```bash
# Linux/Mac
openssl rand -hex 32

# Python
python -c "import secrets; print(secrets.token_hex(32))"
```

## API Endpoints

### Authentication

#### POST `/api/v1/auth/telegram`
Authenticate user with Telegram initData.

**Request:**
```json
{
  "init_data": "query_id=...&user={...}&auth_date=...&hash=..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "user": {
    "id": 123456789,
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "language_code": "en",
    "is_premium": false,
    "photo_url": "https://t.me/i/userpic/...",
    "allows_write_to_pm": true
  },
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### POST `/api/v1/auth/validate`
Validate initData without creating a session.

**Request:**
```json
{
  "init_data": "query_id=...&user={...}&auth_date=...&hash=..."
}
```

#### GET `/api/v1/auth/me`
Get current user info (requires Authorization header).

#### POST `/api/v1/auth/refresh`
Refresh access token.

#### POST `/api/v1/auth/logout`
Logout user.

## useTelegramWebApp Hook Usage

### Basic Setup

```tsx
import { useTelegramWebApp } from './hooks/useTelegramWebApp'

function App() {
  const tg = useTelegramWebApp()

  useEffect(() => {
    if (tg.isTelegram) {
      tg.init()
    }
  }, [tg])

  if (!tg.isTelegram) {
    return <div>Please open in Telegram</div>
  }

  return <div>Welcome, {tg.user?.first_name}!</div>
}
```

### Authentication Flow

```tsx
const handleAuth = async () => {
  if (!tg.webApp?.initData) return

  const response = await fetch('/api/v1/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ init_data: tg.webApp.initData })
  })

  const data = await response.json()
  localStorage.setItem('auth_token', data.access_token)
}
```

### Haptic Feedback

```tsx
// Impact feedback
tg.hapticFeedback({ type: 'impact', style: 'light' })
tg.hapticFeedback({ type: 'impact', style: 'medium' })
tg.hapticFeedback({ type: 'impact', style: 'heavy' })

// Notification feedback
tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
tg.hapticFeedback({ type: 'notification', notificationType: 'error' })
tg.hapticFeedback({ type: 'notification', notificationType: 'warning' })

// Selection feedback
tg.hapticFeedback({ type: 'selection' })
```

### Theme Integration

```tsx
const theme = tg.getTheme()

// Apply CSS variables
document.documentElement.style.setProperty(
  '--tg-theme-bg-color', 
  theme?.bg_color || '#ffffff'
)
document.documentElement.style.setProperty(
  '--tg-theme-text-color', 
  theme?.text_color || '#000000'
)
```

### Main Button

```tsx
tg.showMainButton('Save', () => {
  // Handle click
  tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
})

tg.hideMainButton()
tg.showMainButtonProgress()
tg.hideMainButtonProgress()
```

### Cloud Storage

```tsx
// Save data
await tg.cloudStorage.setItem('user_pref', JSON.stringify({ theme: 'dark' }))

// Read data
const data = await tg.cloudStorage.getItem('user_pref')

// Get all keys
const keys = await tg.cloudStorage.getKeys()

// Remove item
await tg.cloudStorage.removeItem('user_pref')
```

## Validation Process

The backend validates initData using the following steps:

1. **Parse initData**: Split query string into key-value pairs
2. **Extract hash**: Remove `hash` parameter for verification
3. **Create data-check-string**: Sort remaining parameters alphabetically and join with newlines
4. **Generate secret key**: HMAC-SHA256("WebAppData", bot_token)
5. **Calculate hash**: HMAC-SHA256(secret_key, data-check-string)
6. **Compare**: Use constant-time comparison to verify hash
7. **Timestamp check**: Ensure auth_date is within 5 minutes

## Security Considerations

1. **Never expose bot token** in frontend code
2. **Always validate initData** on the backend
3. **Use HTTPS** for production WebApp
4. **Set short expiration** for access tokens
5. **Validate timestamps** to prevent replay attacks
6. **Use constant-time comparison** for hash verification

## Testing

### Local Development

1. Use [ngrok](https://ngrok.com/) or similar to expose localhost:
   ```bash
   ngrok http 5173
   ```

2. Update BotFather with the ngrok URL

3. Open WebApp in Telegram:
   - Send `/start` to your bot
   - Click the menu button

### Test initData Validation

```bash
curl -X POST http://localhost:8000/api/v1/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"init_data": "your_init_data_here"}'
```

## Troubleshooting

### "Not running in Telegram WebApp"
- Ensure you're opening the app through Telegram
- Check that `window.Telegram.WebApp` is available

### "Invalid hash signature"
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Check that initData hasn't been modified
- Ensure timestamp is recent (within 5 minutes)

### Theme not applying
- Call `tg.init()` before accessing theme
- Check that `themeParams` is available in WebApp

### Haptic feedback not working
- Ensure device supports haptic feedback
- Check that `HapticFeedback` API is available

## Additional Resources

- [Telegram WebApp Documentation](https://core.telegram.org/bots/webapps)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Mini Apps Guide](https://core.telegram.org/bots/webapps#initializing-mini-apps)
