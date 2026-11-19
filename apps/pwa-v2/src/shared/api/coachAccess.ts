import { AuthContractError, AuthHttpError } from './auth'

export interface CoachProfile { id: number; user_id: number; is_active: boolean; display_name: string }
export interface CoachSubscription { plan: string; status: string; upgrade_required: boolean }
export interface CoachClientLink { client_id: number; status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'REVOKED'; permissions: Record<string, unknown> }

export class CoachAccessClient {
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  private async get(path: string, token: string, signal?: AbortSignal): Promise<unknown> {
    if (!token) throw new AuthHttpError(401, 'Требуется вход.')
    let response: Response
    try {
      response = await this.transport.call(globalThis, '/api/v1/coach' + path, {
        method: 'GET', credentials: 'same-origin', cache: 'no-store',
        signal, headers: { Authorization: `Bearer ${token}` },
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new AuthHttpError(0, 'Нет соединения с сервером.')
    }
    if (!response.ok) throw new AuthHttpError(response.status, 'Сервер не подтвердил права тренера.')
    try { return await response.json() } catch { throw new AuthContractError() }
  }

  /** Backend requires FEATURE_COACH and COACH role. User identity must match /me. */
  async verifyRole(token: string, expectedUserId: number, signal?: AbortSignal): Promise<CoachProfile> {
    const data = await this.get('/profile', token, signal)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AuthContractError()
    const profile = data as Record<string, unknown>
    if (profile.user_id !== expectedUserId || profile.is_active !== true ||
      typeof profile.id !== 'number' || typeof profile.display_name !== 'string') throw new AuthContractError()
    return data as CoachProfile
  }

  /** Server-authorized subscription. No client data can be requested before this check. */
  async verifySubscription(token: string, signal?: AbortSignal): Promise<CoachSubscription> {
    const data = await this.get('/subscription', token, signal)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AuthContractError()
    const result = data as Record<string, unknown>
    if (typeof result.plan !== 'string' || typeof result.status !== 'string' ||
      typeof result.upgrade_required !== 'boolean') throw new AuthContractError()
    return data as CoachSubscription
  }

  /**
   * Relationship metadata ONLY. ACTIVE does not prove monitoring/health consent.
   * All records are already scoped by current coach on the backend.
   */
  async listActiveLinks(token: string, signal?: AbortSignal): Promise<CoachClientLink[]> {
    const data = await this.get('/clients', token, signal)
    if (!Array.isArray(data)) throw new AuthContractError()
    const rows: CoachClientLink[] = []
    for (const value of data as unknown[]) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AuthContractError()
      const record = value as Record<string, unknown>
      if (typeof record.client_id !== 'number' || !Number.isSafeInteger(record.client_id) ||
        record.client_id <= 0 || !['ACTIVE','PAUSED','ARCHIVED','REVOKED'].includes(String(record.status)) ||
        !record.permissions || typeof record.permissions !== 'object' ||
        Array.isArray(record.permissions)) throw new AuthContractError()
      if (record.status === 'ACTIVE') rows.push({
        client_id: record.client_id, status: 'ACTIVE', permissions: record.permissions as Record<string, unknown>,
      })
    }
    return rows
  }
}
