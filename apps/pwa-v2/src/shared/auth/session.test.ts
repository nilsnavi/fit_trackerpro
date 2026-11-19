import { afterEach, describe, expect, it } from 'vitest'
import { SessionManager, useSessionStore } from './session'
import type { AuthProfile, AuthTokens } from '../api/auth'
import { AuthHttpError } from '../api/auth'
const tokens: AuthTokens = { access_token: 'a'.repeat(24), refresh_token: 'r'.repeat(48),
  token_type: 'bearer', expires_in: 900 }
const profile: AuthProfile = { id: 3, email: 'x@example.com', telegram_id: null,
  first_name: 'X', username: null, is_admin: false, profile: {}, settings: {},
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }

function fakeApi(parts: Record<string, unknown> = {}) {
  return {
    getCurrentProfile: async () => profile,
    refresh: async () => tokens,
    logout: async () => {},
    ...parts,
  } as unknown as import('../api/auth').AuthApiClient
}
afterEach(() => useSessionStore.setState({
  phase: 'anonymous', profile: null, accessToken: null, refreshToken: null
}))

describe('V2-02B memory-only session manager', () => {
  it('requires validated profile before establishing session and clears cache on logout', async () => {
    let clears = 0, revokes = 0
    const manager = new SessionManager(fakeApi({ logout: async () => { revokes++ } }), () => clears++)
    expect(await manager.establish(tokens)).toEqual(profile)
    expect(useSessionStore.getState().phase).toBe('authenticated')
    await manager.logout()
    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(useSessionStore.getState().profile).toBeNull()
    expect(revokes).toBe(1)
    expect(clears).toBeGreaterThanOrEqual(2)
  })

  it('cannot restore session when login response arrives after logout', async () => {
    let release: ((value: AuthProfile) => void) | undefined
    const pending = new Promise<AuthProfile>(resolve => { release = resolve })
    const manager = new SessionManager(fakeApi({ getCurrentProfile: () => pending }))
    const attempt = manager.establish(tokens)
    await manager.logout()
    release?.(profile)
    await expect(attempt).rejects.toThrow('Сессия была завершена.')
    expect(useSessionStore.getState().phase).toBe('anonymous')
  })

  it('uses one refresh call for parallel requests and rotates tokens', async () => {
    let calls = 0
    const next: AuthTokens = { ...tokens, access_token: 'new-access-token', refresh_token: 'new-refresh-token-rotated-0000000000000' }
    const manager = new SessionManager(fakeApi({ refresh: async () => { calls++; return next } }))
    await manager.establish(tokens)
    const [first, second] = await Promise.all([manager.refresh(), manager.refresh()])
    expect(first).toBe(next.access_token)
    expect(second).toBe(next.access_token)
    expect(calls).toBe(1)
    expect(useSessionStore.getState().refreshToken).toBe(next.refresh_token)
  })

  it('invalidates local identity after rejected refresh', async () => {
    const manager = new SessionManager(fakeApi({ refresh: async () => { throw new AuthHttpError(401, 'expired') } }))
    await manager.establish(tokens)
    expect(await manager.refresh()).toBeNull()
    expect(useSessionStore.getState().phase).toBe('anonymous')
  })
})
