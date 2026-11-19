import { describe, expect, it } from 'vitest'
import { AthleteDataClient } from './athleteData'
import { AuthContractError, AuthHttpError } from './auth'

function mock(handler: (path: string, init?: RequestInit) => Response): AthleteDataClient {
  return new AthleteDataClient(async (url, init) => handler(String(url), init))
}
const stats = { active_days: 3, total_workouts: 7, current_streak: 2,
  longest_streak: 4, total_duration: 310 }
const history = { items: [{
  id: 12, date: '2026-11-14', status: 'COMPLETED', duration: 45, tags: ['strength'],
  glucose_before: 6.3, exercises: [{ id: 99 }],
}], total: 1, page: 1, page_size: 5 }

describe('V2-03 Athlete data source', () => {
  it('fetches only the authenticated current user stats', async () => {
    const client = mock((path, init) => {
      expect(path).toBe('/api/v1/users/me/stats')
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access')
      return new Response(JSON.stringify(stats))
    })
    expect(await client.getStats('access')).toEqual(stats)
  })
  it('renders no placeholder metrics and rejects malformed stats', async () => {
    await expect(mock(() => new Response('{}')).getStats('access')).rejects.toBeInstanceOf(AuthContractError)
  })
  it('projects history into a non-health allowlist', async () => {
    const client = mock((path) => {
      expect(path).toBe('/api/v1/workouts/history?page=1&page_size=5')
      return new Response(JSON.stringify(history))
    })
    const page = await client.getWorkoutHistory('access')
    expect(page.items).toEqual([{ id: 12, date: '2026-11-14', status: 'COMPLETED',
      duration: 45, tags: ['strength'] }])
    expect(JSON.stringify(page)).not.toContain('glucose')
    expect(JSON.stringify(page)).not.toContain('exercises')
  })
  it('rejects malformed history and server authorization failure', async () => {
    await expect(mock(() => new Response(JSON.stringify({ items: [{ id: 'broken' }], total: 1, page: 1, page_size: 5 }))).getWorkoutHistory('access'))
      .rejects.toBeInstanceOf(AuthContractError)
    await expect(mock(() => new Response('{}', { status: 403 })).getStats('access'))
      .rejects.toBeInstanceOf(AuthHttpError)
  })
  it('refuses unauthenticated fetch before any network call', async () => {
    const client = new AthleteDataClient(async () => { throw new Error('Unexpected call') })
    await expect(client.getStats('')).rejects.toMatchObject({ status: 401 })
  })
})
