import { describe, expect, it } from 'vitest'
import { AuthContractError, AuthHttpError } from './auth'
import { CoachAccessClient } from './coachAccess'

function api(handler: (url: string, init?: RequestInit) => Response) {
  return new CoachAccessClient(async (input, init) => handler(String(input), init))
}
describe('V2-02C Coach server authority', () => {
  it('denies access on server 403/404 without client fallback', async () => {
    for (const status of [403, 404]) {
      const client = api(() => new Response('{}', { status }))
      await expect(client.verifyRole('jwt', 12)).rejects.toBeInstanceOf(AuthHttpError)
    }
  })
  it('rejects profile belonging to another identity or inactive coach', async () => {
    for (const profile of [
      { id: 1, user_id: 999, is_active: true, display_name: 'Coach' },
      { id: 1, user_id: 12, is_active: false, display_name: 'Coach' },
    ]) {
      await expect(api(() => new Response(JSON.stringify(profile))).verifyRole('jwt', 12)).rejects.toBeInstanceOf(AuthContractError)
    }
  })
  it('checks server profile and subscription and never invents coach role from admin', async () => {
    const client = api(url => new Response(JSON.stringify(url.endsWith('/profile')
      ? { id: 2, user_id: 12, is_active: true, display_name: 'Coach' }
      : { plan: 'FREE', status: 'ACTIVE', upgrade_required: false })))
    expect((await client.verifyRole('jwt', 12)).user_id).toBe(12)
    expect((await client.verifySubscription('jwt')).plan).toBe('FREE')
  })
  it('reads only active server-scoped links and no health data', async () => {
    const client = api(() => new Response(JSON.stringify([
      { client_id: 1, status: 'ACTIVE', permissions: {}, medical_details: 'must not leak' },
      { client_id: 2, status: 'REVOKED', permissions: {} },
      { client_id: 3, status: 'PAUSED', permissions: {} },
    ])))
    expect(await client.listActiveLinks('jwt')).toEqual([{ client_id: 1, status: 'ACTIVE', permissions: {} }])
  })
  it('rejects malformed client list rather than falling back to sample clients', async () => {
    await expect(api(() => new Response(JSON.stringify([{ client_id: 'wrong', status: 'ACTIVE', permissions: {} }]))).listActiveLinks('jwt')).rejects.toBeInstanceOf(AuthContractError)
  })
})
