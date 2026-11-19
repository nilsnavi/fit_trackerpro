import { describe, expect, it } from 'vitest'
import { authenticateTelegram, readTelegramInitData } from './telegram'
import type { AuthApiClient } from '../api/auth'
import type { SessionManager } from './session'

describe('Telegram native runtime handoff', () => {
  it('accepts only raw Telegram.WebApp.initData', () => {
    expect(readTelegramInitData({ Telegram: { WebApp: { initData: 'hash=signature' } } })).toBe('hash=signature')
    expect(readTelegramInitData({ Telegram: { WebApp: {} } })).toBeNull()
    expect(readTelegramInitData(undefined)).toBeNull()
    expect(readTelegramInitData({ Telegram: { WebApp: { initData: 'x'.repeat(16385) } } })).toBeNull()
  })
  it('establishes session only after server exchange returns complete tokens', async () => {
    let established = 0
    const session = { establish: async () => { established++ } } as unknown as SessionManager
    const api = { loginTelegram: async () => ({
      success: true, message: 'OK', access_token: 'a'.repeat(24),
      refresh_token: 'r'.repeat(48), expires_in: 900,
      is_new_user: false, onboarding_required: false, token_type: 'bearer',
    }) } as unknown as AuthApiClient
    await authenticateTelegram('hash=verified-on-server', session, api)
    expect(established).toBe(1)
  })
  it('never establishes session for incomplete Telegram token pair', async () => {
    let established = 0
    const session = { establish: async () => { established++ } } as unknown as SessionManager
    const api = { loginTelegram: async () => ({
      success: true, message: 'OK', token: 'a'.repeat(24),
      is_new_user: false, onboarding_required: false, token_type: 'bearer',
    }) } as unknown as AuthApiClient
    await expect(authenticateTelegram('hash=sample', session, api)).rejects.toThrow()
    expect(established).toBe(0)
  })
})
