import { AuthContractError, AuthHttpError, type AuthProfile } from './auth'

export interface AthleteStats {
  active_days: number
  total_workouts: number
  current_streak: number
  longest_streak: number
  total_duration: number
}
export interface WorkoutHistoryEntry {
  id: number
  date: string
  status: string
  duration: number | null
  tags: string[]
}
export interface WorkoutHistoryPage {
  items: WorkoutHistoryEntry[]
  total: number
  page: number
  page_size: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function integer(value: unknown, min = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min
}
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export class AthleteDataClient {
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  private async get(path: string, accessToken: string, signal?: AbortSignal): Promise<unknown> {
    if (!accessToken) throw new AuthHttpError(401, 'Необходим вход.')
    let response: Response
    try {
      response = await this.transport.call(globalThis, '/api/v1' + path, {
        method: 'GET', cache: 'no-store', credentials: 'same-origin', signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new AuthHttpError(0, 'Нет соединения с сервером.')
    }
    if (!response.ok) throw new AuthHttpError(response.status, 'Не удалось загрузить данные.')
    try { return await response.json() } catch { throw new AuthContractError() }
  }

  async getStats(token: string, signal?: AbortSignal): Promise<AthleteStats> {
    const value = await this.get('/users/me/stats', token, signal)
    if (!isObject(value) || !integer(value.active_days) || !integer(value.total_workouts) ||
      !integer(value.current_streak) || !integer(value.longest_streak) ||
      !integer(value.total_duration)) throw new AuthContractError()
    return {
      active_days: value.active_days, total_workouts: value.total_workouts,
      current_streak: value.current_streak, longest_streak: value.longest_streak,
      total_duration: value.total_duration,
    }
  }

  async getWorkoutHistory(token: string, signal?: AbortSignal): Promise<WorkoutHistoryPage> {
    const value = await this.get('/workouts/history?page=1&page_size=5', token, signal)
    if (!isObject(value) || !Array.isArray(value.items) || !integer(value.total) ||
      !integer(value.page, 1) || !integer(value.page_size, 1)) throw new AuthContractError()
    const items: WorkoutHistoryEntry[] = value.items.map((row: unknown) => {
      if (!isObject(row) || !integer(row.id, 1) || !validDate(row.date) ||
        typeof row.status !== 'string' || !(row.duration === null || integer(row.duration)) ||
        !Array.isArray(row.tags) || !row.tags.every(item => typeof item === 'string')) {
        throw new AuthContractError()
      }
      // Explicit allowlist: health measurements, glucose and exercise details
      // contained in legacy API responses do not propagate to this dashboard.
      return { id: row.id, date: row.date, status: row.status, duration: row.duration, tags: row.tags }
    })
    return { items, total: value.total, page: value.page, page_size: value.page_size }
  }

  async getProfile(token: string, signal?: AbortSignal): Promise<AuthProfile> {
    const value = await this.get('/users/me', token, signal)
    if (!isObject(value) || !integer(value.id, 1) ||
      !(typeof value.email === 'string' || value.email === null) ||
      !(typeof value.first_name === 'string' || value.first_name === null)) throw new AuthContractError()
    // On /me we intentionally allow the documented extended settings/profile
    // payload without fabricating values. Only public-facing fields are displayed.
    return value as unknown as AuthProfile
  }
}
