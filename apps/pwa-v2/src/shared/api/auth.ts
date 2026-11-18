/**
 * V2-02A: HTTP contract adapter only. No session persistence or UI auth gates.
 * Paths and response fields are based on FastAPI users/auth routes and schemas.
 * Never log auth payloads, OTP codes, raw Telegram initData or bearer tokens.
 */

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in?: number | null
}

export interface TelegramAuthResult {
  success: boolean
  message: string
  access_token?: string | null
  token?: string | null
  refresh_token?: string | null
  is_new_user: boolean
  onboarding_required: boolean
}

export interface AuthProfile {
  id: number
  email: string | null
  telegram_id: number | null
  first_name: string | null
  username: string | null
  is_admin: boolean
  profile: Record<string, unknown>
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export class AuthHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'AuthHttpError'
  }
}

export class AuthApiClient {
  constructor(
    private readonly transport: typeof fetch = fetch,
    private readonly prefix = '/api/v1/users/auth',
  ) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.transport(this.prefix + path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
    if (!response.ok) {
      let message = 'Ошибка запроса. Попробуйте ещё раз.'
      try {
        const body: unknown = await response.json()
        if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
          message = body.detail
        }
      } catch {
        // Do not expose or log raw server responses, tokens or request bodies.
      }
      throw new AuthHttpError(response.status, message)
    }
    return (await response.json()) as T
  }

  requestEmailCode(email: string): Promise<{ challenge_id: string }> {
    return this.request('/email/request', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })
  }

  verifyEmailCode(challenge_id: string, code: string): Promise<AuthTokens> {
    if (!/^[a-f0-9]{32}$/.test(challenge_id) || !/^[0-9]{6}$/.test(code)) {
      return Promise.reject(new Error('Некорректный формат кода подтверждения.'))
    }
    return this.request('/email/verify', {
      method: 'POST',
      body: JSON.stringify({ challenge_id, code }),
    })
  }

  loginTelegram(initData: string): Promise<TelegramAuthResult> {
    if (!initData) return Promise.reject(new Error('Данные Telegram отсутствуют.'))
    return this.request('/telegram', {
      method: 'POST',
      body: JSON.stringify({ init_data: initData }),
    })
  }

  getCurrentProfile(accessToken: string): Promise<AuthProfile> {
    if (!accessToken) return Promise.reject(new Error('Необходим вход.'))
    return this.request('/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }

  refresh(refreshToken: string): Promise<AuthTokens> {
    if (!refreshToken) return Promise.reject(new Error('Сессия не найдена.'))
    return this.request('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  }
}
