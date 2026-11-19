/**
 * V2-02A — transport and runtime contract validation only.
 * No token storage, user sessions or client-side authorization decisions.
 */
export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
}

export interface TelegramAuthResult {
  success: boolean
  message: string
  access_token?: string | null
  token?: string | null
  refresh_token?: string | null
  is_new_user: boolean
  onboarding_required: boolean
  token_type: 'bearer'
  expires_in?: number | null
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

export class AuthContractError extends Error {
  constructor() {
    super('Сервер вернул некорректный ответ авторизации.')
    this.name = 'AuthContractError'
  }
}

export class AuthNetworkError extends Error {
  constructor() {
    super('Нет соединения с сервером. Попробуйте ещё раз.')
    this.name = 'AuthNetworkError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isBearer(value: unknown): boolean {
  return typeof value === 'string' && value.toLowerCase() === 'bearer'
}

function isNumberInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function parseChallenge(value: unknown): { challenge_id: string } {
  if (!isRecord(value) || !isString(value.challenge_id) || !/^[a-f0-9]{32}$/.test(value.challenge_id)) {
    throw new AuthContractError()
  }
  return { challenge_id: value.challenge_id }
}

function parseTokens(value: unknown): AuthTokens {
  if (!isRecord(value)
    || !isString(value.access_token) || value.access_token.length < 10
    || !isString(value.refresh_token) || value.refresh_token.length < 32
    || !isBearer(value.token_type)
    || !isNumberInRange(value.expires_in, 60, 86400 * 365)) {
    throw new AuthContractError()
  }
  return { access_token: value.access_token, refresh_token: value.refresh_token,
    token_type: 'bearer', expires_in: value.expires_in as number }
}

function parseTelegram(value: unknown): TelegramAuthResult {
  if (!isRecord(value)
    || typeof value.success !== 'boolean'
    || typeof value.message !== 'string'
    || typeof value.is_new_user !== 'boolean'
    || typeof value.onboarding_required !== 'boolean'
    || (value.token !== undefined && !isNullableString(value.token))
    || (value.access_token !== undefined && !isNullableString(value.access_token))
    || (value.refresh_token !== undefined && !isNullableString(value.refresh_token))
    || (value.token_type !== undefined && !isBearer(value.token_type))
    || (value.expires_in !== undefined && value.expires_in !== null
      && !isNumberInRange(value.expires_in, 0, 86400 * 365))) {
    throw new AuthContractError()
  }
  return {
    success: value.success, message: value.message,
    is_new_user: value.is_new_user, onboarding_required: value.onboarding_required,
    token: value.token as string | null | undefined,
    access_token: value.access_token as string | null | undefined,
    refresh_token: value.refresh_token as string | null | undefined,
    token_type: 'bearer', expires_in: value.expires_in as number | null | undefined,
  }
}

/** Never create a session from success:true alone. */
export function getTelegramAccessToken(result: TelegramAuthResult): string {
  const token = result.access_token || result.token
  if (!result.success || !token || token.length < 10) throw new AuthContractError()
  return token
}

function parseProfile(value: unknown): AuthProfile {
  if (!isRecord(value)
    || !isNumberInRange(value.id, 1, Number.MAX_SAFE_INTEGER)
    || !isNullableString(value.email)
    || !(value.telegram_id === null || isNumberInRange(value.telegram_id, 1, Number.MAX_SAFE_INTEGER))
    || !isNullableString(value.first_name) || !isNullableString(value.username)
    || typeof value.is_admin !== 'boolean'
    || !isRecord(value.profile) || !isRecord(value.settings)
    || !isString(value.created_at) || !isString(value.updated_at)) {
    throw new AuthContractError()
  }
  return value as unknown as AuthProfile
}

export class AuthApiClient {
  constructor(
    private readonly transport: typeof fetch = fetch,
    private readonly prefix = '/api/v1/users/auth',
  ) {}

  private async request<T>(path: string, init: RequestInit, parse: (value: unknown) => T): Promise<T> {
    let response: Response
    try {
      response = await this.transport(this.prefix + path, {
        credentials: 'same-origin', cache: 'no-store', ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers },
      })
    } catch {
      // Do not expose raw transport errors; they can contain sensitive URL or request data.
      throw new AuthNetworkError()
    }
    if (!response.ok) {
      let message = 'Ошибка запроса. Попробуйте ещё раз.'
      try {
        const body: unknown = await response.json()
        if (isRecord(body) && typeof body.detail === 'string') message = body.detail
      } catch { /* No raw error logging */ }
      throw new AuthHttpError(response.status, message)
    }
    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new AuthContractError()
    }
    return parse(data)
  }

  requestEmailCode(email: string): Promise<{ challenge_id: string }> {
    return this.request('/email/request', {
      method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }, parseChallenge)
  }

  verifyEmailCode(challenge_id: string, code: string): Promise<AuthTokens> {
    if (!/^[a-f0-9]{32}$/.test(challenge_id) || !/^[0-9]{6}$/.test(code)) {
      return Promise.reject(new Error('Некорректный формат кода подтверждения.'))
    }
    return this.request('/email/verify', {
      method: 'POST', body: JSON.stringify({ challenge_id, code }),
    }, parseTokens)
  }

  loginTelegram(initData: string): Promise<TelegramAuthResult> {
    if (!initData || initData.length > 16384) {
      return Promise.reject(new Error('Данные Telegram отсутствуют или некорректны.'))
    }
    return this.request('/telegram', {
      method: 'POST', body: JSON.stringify({ init_data: initData }),
    }, parseTelegram)
  }

  getCurrentProfile(accessToken: string, signal?: AbortSignal): Promise<AuthProfile> {
    if (!accessToken) return Promise.reject(new Error('Необходим вход.'))
    return this.request('/me', {
      method: 'GET', signal, headers: { Authorization: `Bearer ${accessToken}` },
    }, parseProfile)
  }

  refresh(refreshToken: string, signal?: AbortSignal): Promise<AuthTokens> {
    if (!refreshToken) return Promise.reject(new Error('Сессия не найдена.'))
    return this.request('/refresh', {
      method: 'POST', signal, body: JSON.stringify({ refresh_token: refreshToken }),
    }, parseTokens)
  }
  async logout(accessToken: string, refreshToken: string | null): Promise<void> {
    const response = await this.transport(this.prefix + '/logout', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!response.ok) throw new AuthHttpError(response.status, 'Не удалось отозвать серверную сессию.')
  }
}
