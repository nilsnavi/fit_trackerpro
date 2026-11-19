import { describe, expect, it } from 'vitest'
import { fetchCoachDashboard } from './coachDashboard'
import { CoachAccessClient } from './coachAccess'
import { AuthContractError, AuthHttpError } from './auth'

const profile = { id: 5, user_id: 9, is_active: true, display_name: 'Тренер QA' }
const subscription = {
  plan: 'TRAINER_PRO', status: 'TRIAL', upgrade_required: false,
  trial_days_remaining: 8, grace_days_remaining: null,
  active_clients: { used: 3, limit: 20, remaining: 17 },
  active_programs: { used: 4, limit: 50, remaining: 46 },
  features: { client_monitoring: true, program_assignments: true, advanced_monitoring_filters: false },
}
const relationships = [
  { client_id: 12, status: 'ACTIVE', permissions: {}, health_note: 'must never propagate' },
  { client_id: 13, status: 'REVOKED', permissions: {} },
  { client_id: 14, status: 'PAUSED', permissions: {} },
]
function api(onRequest: (url: string) => Response): CoachAccessClient {
  return new CoachAccessClient(async input => onRequest(String(input)))
}
describe('V2-03B server-sourced Coach overview', () => {
  it('displays only server counters and ACTIVE links, never sensitive fields', async () => {
    const paths: string[] = []
    const service = api(url => {
      paths.push(url)
      return new Response(JSON.stringify(url.endsWith('/profile') ? profile :
        url.endsWith('/subscription') ? subscription : relationships))
    })
    const dashboard = await fetchCoachDashboard('access', 9, service)
    expect(paths).toEqual(['/api/v1/coach/profile', '/api/v1/coach/subscription', '/api/v1/coach/clients'])
    expect(dashboard.activeClients).toBe(1)
    expect(dashboard.activePrograms).toBe(4)
    expect(dashboard.clientLimit).toBe(20)
    expect(dashboard.allowedClientIds).toEqual([12])
    expect(JSON.stringify(dashboard)).not.toContain('health_note')
  })

  it('never requests subscription or clients when role is denied', async () => {
    const paths: string[] = []
    await expect(fetchCoachDashboard('access', 9, api(url => {
      paths.push(url)
      return new Response('{}', { status: 403 })
    }))).rejects.toBeInstanceOf(AuthHttpError)
    expect(paths).toEqual(['/api/v1/coach/profile'])
  })
  it('never requests clients when subscription is denied', async () => {
    const paths: string[] = []
    await expect(fetchCoachDashboard('access', 9, api(url => {
      paths.push(url)
      return url.endsWith('/profile') ? new Response(JSON.stringify(profile)) : new Response('{}', { status: 403 })
    }))).rejects.toBeInstanceOf(AuthHttpError)
    expect(paths).toEqual(['/api/v1/coach/profile', '/api/v1/coach/subscription'])
  })
  it('requires correct user identity, refuses invented counts', async () => {
    const paths: string[] = []
    await expect(fetchCoachDashboard('access', 10, api(url => {
      paths.push(url)
      return new Response(JSON.stringify(profile))
    }))).rejects.toBeInstanceOf(AuthContractError)
    expect(paths).toEqual(['/api/v1/coach/profile'])
    await expect(fetchCoachDashboard('access', 9, api(url =>
      new Response(JSON.stringify(url.endsWith('/profile') ? profile : { ...subscription, active_programs: { used: '4', limit: 50, remaining: 46 } }))
    ))).rejects.toBeInstanceOf(AuthContractError)
  })
})
