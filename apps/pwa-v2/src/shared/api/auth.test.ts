import { describe, expect, it } from 'vitest'
import { AuthApiClient, AuthHttpError } from './auth'

describe('V2-02 auth API contracts', () => {
  it('requests email OTP with canonical endpoint and trimmed email', async () => {
    let capturedUrl = ''
    let capturedBody = ''
    const transport: typeof fetch = async (input, options) => {
      capturedUrl = String(input)
      capturedBody = String(options?.body)
      return new Response(JSON.stringify({ challenge_id: 'a'.repeat(32) }), { status: 200 })
    }
    const api = new AuthApiClient(transport)
    expect(await api.requestEmailCode(' USER@EXAMPLE.COM ')).toEqual({ challenge_id: 'a'.repeat(32) })
    expect(capturedUrl).toBe('/api/v1/users/auth/email/request')
    expect(JSON.parse(capturedBody)).toEqual({ email: 'user@example.com' })
  })

  it('does not submit invalid OTP format to backend', async () => {
    const transport: typeof fetch = async () => { throw new Error('Must not call server') }
    const api = new AuthApiClient(transport)
    await expect(api.verifyEmailCode('invalid', '12345')).rejects.toThrow('Некорректный')
  })

  it('posts the raw Telegram initData only as JSON body', async () => {
    let url = ''
    let body: unknown
    const transport: typeof fetch = async (input, options) => {
      url = String(input)
      body = JSON.parse(String(options?.body))
      return new Response(JSON.stringify({
        success: true, message: 'ok', access_token: 'test', refresh_token: 'refresh',
        is_new_user: false, onboarding_required: false,
      }), { status: 200 })
    }
    const api = new AuthApiClient(transport)
    await api.loginTelegram('query_id=sample&hash=secret')
    expect(url).toBe('/api/v1/users/auth/telegram')
    expect(body).toEqual({ init_data: 'query_id=sample&hash=secret' })
    expect(url).not.toContain('secret')
  })

  it('sends Authorization bearer for /me and handles forbidden status', async () => {
    let authHeader: string | null = null
    const transport: typeof fetch = async (_input, options) => {
      authHeader = new Headers(options?.headers).get('Authorization')
      return new Response(JSON.stringify({ detail: 'Forbidden' }), { status: 403 })
    }
    await expect(new AuthApiClient(transport).getCurrentProfile('access-test')).rejects.toMatchObject({
      name: 'AuthHttpError', status: 403,
    } satisfies Partial<AuthHttpError>)
    expect(authHeader).toBe('Bearer access-test')
  })

  it('uses refresh endpoint without Authorization header', async () => {
    let actualUrl = ''
    let actualHeaders: Headers | undefined
    const transport: typeof fetch = async (input, options) => {
      actualUrl = String(input)
      actualHeaders = new Headers(options?.headers)
      return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'b', token_type: 'bearer' }), { status: 200 })
    }
    await new AuthApiClient(transport).refresh('refresh-test')
    expect(actualUrl).toBe('/api/v1/users/auth/refresh')
    expect(actualHeaders?.has('Authorization')).toBe(false)
  })
})
