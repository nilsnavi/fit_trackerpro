import { describe, expect, it } from 'vitest'
import {
  AuthApiClient, AuthContractError, AuthHttpError, AuthNetworkError, getTelegramAccessToken
} from './auth'

const access = 'a'.repeat(24)
const refreshToken = 'r'.repeat(48)
const tokens = { access_token: access, refresh_token: refreshToken, token_type: 'bearer', expires_in: 900 }
const stub = (value: unknown, status = 200): typeof fetch =>
  async () => new Response(JSON.stringify(value), { status })

describe('V2-02A validated FastAPI auth adapter', () => {
  it('normalizes email OTP and rejects malformed challenge responses', async () => {
    let url = ''
    let body: unknown
    const api = new AuthApiClient(async (input, options) => {
      url = String(input); body = JSON.parse(String(options?.body))
      return new Response(JSON.stringify({ challenge_id: 'a'.repeat(32) }))
    })
    expect(await api.requestEmailCode(' USER@EXAMPLE.COM ')).toEqual({ challenge_id: 'a'.repeat(32) })
    expect(url).toBe('/api/v1/users/auth/email/request')
    expect(body).toEqual({ email: 'user@example.com' })
    await expect(new AuthApiClient(stub({ challenge_id: 'invalid' })).requestEmailCode('a@b.co')).rejects.toBeInstanceOf(AuthContractError)
  })

  it('refuses malformed OTP locally and validates the token pair returned by backend', async () => {
    const never: typeof fetch = async () => { throw new Error('must not reach server') }
    await expect(new AuthApiClient(never).verifyEmailCode('bad', '12345')).rejects.toThrow('Некорректный')
    const api = new AuthApiClient(stub(tokens))
    expect(await api.verifyEmailCode('a'.repeat(32), '123456')).toEqual(tokens)
    for (const invalid of [{ ...tokens, refresh_token: '' }, { ...tokens, expires_in: '900' }, { ...tokens, access_token: null }, { ...tokens, token_type: 'Basic' }]) {
      await expect(new AuthApiClient(stub(invalid)).verifyEmailCode('a'.repeat(32), '123456')).rejects.toBeInstanceOf(AuthContractError)
    }
  })

  it('sends Telegram initData in JSON body, not URL, and never accepts success without token for session', async () => {
    let url = '', body: unknown
    const api = new AuthApiClient(async (input, options) => {
      url = String(input); body = JSON.parse(String(options?.body))
      return new Response(JSON.stringify({ success: true, message: 'OK', token: access, is_new_user: false, onboarding_required: false }))
    })
    const result = await api.loginTelegram('query_id=sample&hash=secret')
    expect(url).toBe('/api/v1/users/auth/telegram')
    expect(url).not.toContain('secret')
    expect(body).toEqual({ init_data: 'query_id=sample&hash=secret' })
    expect(getTelegramAccessToken(result)).toBe(access)
    const incomplete = await new AuthApiClient(stub({ success: true, message: 'ok', is_new_user: false, onboarding_required: false })).loginTelegram('sample')
    expect(() => getTelegramAccessToken(incomplete)).toThrow(AuthContractError)
    await expect(new AuthApiClient(stub({ success: true })).loginTelegram('sample')).rejects.toBeInstanceOf(AuthContractError)
  })

  it('sends bearer for /me and refuses invalid profiles', async () => {
    let bearer: string | null = null
    const valid = { id: 42, telegram_id: null, email: 'user@example.org', first_name: null,
      username: null, is_admin: false, profile: {}, settings: {}, created_at: '2026-01-01', updated_at: '2026-01-01' }
    const api = new AuthApiClient(async (_input, options) => {
      bearer = new Headers(options?.headers).get('Authorization')
      return new Response(JSON.stringify(valid))
    })
    expect((await api.getCurrentProfile('token')).id).toBe(42)
    expect(bearer).toBe('Bearer token')
    await expect(new AuthApiClient(stub({ id: 42 })).getCurrentProfile('token')).rejects.toBeInstanceOf(AuthContractError)
  })

  it('refreshes without bearer header and validates rotated tokens', async () => {
    let url = '', header: string | null = null, body: unknown
    const api = new AuthApiClient(async (input, options) => {
      url = String(input); header = new Headers(options?.headers).get('Authorization')
      body = JSON.parse(String(options?.body))
      return new Response(JSON.stringify(tokens))
    })
    expect(await api.refresh(refreshToken)).toEqual(tokens)
    expect(url).toBe('/api/v1/users/auth/refresh')
    expect(header).toBeNull()
    expect(body).toEqual({ refresh_token: refreshToken })
  })

  it.each([400, 401, 403, 422, 429, 500])('returns typed HTTP error for %i', async status => {
    await expect(new AuthApiClient(stub({ detail: 'Forbidden' }, status)).getCurrentProfile('token'))
      .rejects.toMatchObject({ name: 'AuthHttpError', status } satisfies Partial<AuthHttpError>)
  })

  it('reports network, empty JSON and malformed response safely', async () => {
    const offline: typeof fetch = async () => { throw new Error('sensitive transport detail') }
    await expect(new AuthApiClient(offline).requestEmailCode('a@b.co')).rejects.toBeInstanceOf(AuthNetworkError)
    const malformed: typeof fetch = async () => new Response('not-json', { status: 200 })
    await expect(new AuthApiClient(malformed).requestEmailCode('a@b.co')).rejects.toBeInstanceOf(AuthContractError)
    const empty: typeof fetch = async () => new Response(null, { status: 204 })
    await expect(new AuthApiClient(empty).requestEmailCode('a@b.co')).rejects.toBeInstanceOf(AuthContractError)
  })
})
