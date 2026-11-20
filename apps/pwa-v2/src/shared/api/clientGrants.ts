import { AuthContractError, AuthHttpError } from './auth'

export const GRANT_VERSION = 'v2-03c-1' as const
export type GrantScope = 'training_summary.read' | 'workout_history.read'
export interface ClientGrant {
  id: string
  coach_id: number
  scope: GrantScope
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  consent_version: string
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
}
const scopes: readonly string[] = ['training_summary.read', 'workout_history.read']
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}
function parseGrant(v: unknown): ClientGrant {
  if (!object(v) || typeof v.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id) ||
    typeof v.coach_id !== 'number' || !Number.isSafeInteger(v.coach_id) || v.coach_id <= 0 ||
    !scopes.includes(String(v.scope)) ||
    !['ACTIVE','REVOKED','EXPIRED'].includes(String(v.status)) ||
    typeof v.consent_version !== 'string' || typeof v.granted_at !== 'string' ||
    !(v.expires_at === null || typeof v.expires_at === 'string') ||
    !(v.revoked_at === null || typeof v.revoked_at === 'string')) throw new AuthContractError()
  return {
    id: v.id, coach_id: v.coach_id, scope: v.scope as GrantScope,
    status: v.status as ClientGrant['status'], consent_version: v.consent_version,
    granted_at: v.granted_at, expires_at: v.expires_at, revoked_at: v.revoked_at,
  }
}
export interface AvailableCoach { coach_id: number; display_name: string }
function parseAvailableCoach(v: unknown): AvailableCoach {
  if (!object(v) || typeof v.coach_id !== 'number' || !Number.isSafeInteger(v.coach_id) ||
    v.coach_id <= 0 || typeof v.display_name !== 'string' || !v.display_name.trim()) {
    throw new AuthContractError()
  }
  return { coach_id: v.coach_id, display_name: v.display_name }
}
export class ClientGrantApi {
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args)) {}
  private async request(token: string, path: string, init: RequestInit): Promise<unknown> {
    if (!token) throw new AuthHttpError(401, 'Необходим вход.')
    let response: Response
    try {
      response = await this.transport.call(globalThis, '/api/v1/client/coach-grants' + path, {
        ...init, credentials: 'same-origin', cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      })
    } catch (error) {
      if (init.signal?.aborted) throw error
      throw new AuthHttpError(0, 'Не удалось связаться с сервером.')
    }
    if (!response.ok) throw new AuthHttpError(response.status, 'Операция недоступна. Повторите попытку.')
    if (response.status === 204) return null
    try { return await response.json() } catch { throw new AuthContractError() }
  }
  async availableCoaches(token: string, signal?: AbortSignal): Promise<AvailableCoach[]> {
    const data = await this.request(token, '/available-coaches', { method: 'GET', signal })
    if (!Array.isArray(data)) throw new AuthContractError()
    return data.map(parseAvailableCoach)
  }
  async list(token: string, signal?: AbortSignal): Promise<ClientGrant[]> {
    const data = await this.request(token, '', { method: 'GET', signal })
    if (!Array.isArray(data)) throw new AuthContractError()
    return data.map(parseGrant)
  }
  async revoke(token: string, id: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AuthContractError()
    await this.request(token, '/' + encodeURIComponent(id), { method: 'DELETE' })
  }
  async regrant(token: string, coachId: number, scope: GrantScope, expiresAt: string | null): Promise<ClientGrant> {
    if (!Number.isSafeInteger(coachId) || coachId <= 0 || !scopes.includes(scope)) throw new AuthContractError()
    const data = await this.request(token, '', {
      method: 'POST',
      body: JSON.stringify({
        coach_id: coachId, scope, consent_version: GRANT_VERSION,
        expires_at: expiresAt,
      }),
    })
    return parseGrant(data)
  }
}
