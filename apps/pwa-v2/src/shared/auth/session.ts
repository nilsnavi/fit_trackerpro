import { create } from 'zustand'
import { AuthApiClient, AuthHttpError, type AuthProfile, type AuthTokens } from '../api/auth'

export type AuthPhase = 'anonymous' | 'checking' | 'authenticated'
export interface SessionState {
  phase: AuthPhase
  profile: AuthProfile | null
  accessToken: string | null
  refreshToken: string | null
}
export const useSessionStore = create<SessionState>(() => ({
  phase: 'anonymous', profile: null, accessToken: null, refreshToken: null,
}))

/** Memory only, never writes tokens or profiles to browser storage. */
export class SessionManager {
  private generation = 0
  private refreshInFlight: Promise<string | null> | null = null
  private readonly pending = new Set<AbortController>()

  constructor(
    private readonly api: AuthApiClient = new AuthApiClient(),
    private readonly clearUserCache: () => void = () => {},
  ) {}

  private revokePending() {
    for (const request of this.pending) request.abort()
    this.pending.clear()
  }

  private invalidate() {
    ++this.generation
    this.refreshInFlight = null
    this.revokePending()
    useSessionStore.setState({ phase: 'anonymous', profile: null, accessToken: null, refreshToken: null })
    this.clearUserCache()
  }

  async establish(tokens: AuthTokens): Promise<AuthProfile> {
    this.invalidate()
    const id = this.generation
    const controller = new AbortController()
    this.pending.add(controller)
    useSessionStore.setState({ phase: 'checking' })
    try {
      const profile = await this.api.getCurrentProfile(tokens.access_token, controller.signal)
      if (id !== this.generation) throw new Error('Сессия была завершена.')
      useSessionStore.setState({
        phase: 'authenticated', profile,
        accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
      })
      return profile
    } catch (error) {
      if (id === this.generation) this.invalidate()
      throw error
    } finally {
      this.pending.delete(controller)
    }
  }

  /**
   * Single flight refresh. The token belongs to a generation; older refresh
   * responses cannot restore access after logout or identity switch.
   */
  async refresh(): Promise<string | null> {
    if (this.refreshInFlight) return this.refreshInFlight
    const current = useSessionStore.getState()
    if (!current.refreshToken || current.phase !== 'authenticated') return null
    const id = this.generation
    const controller = new AbortController()
    this.pending.add(controller)
    const token = current.refreshToken
    const task = (async () => {
      try {
        const result = await this.api.refresh(token, controller.signal)
        if (id !== this.generation) return null
        useSessionStore.setState({ accessToken: result.access_token, refreshToken: result.refresh_token })
        return result.access_token
      } catch {
        if (id === this.generation) this.invalidate()
        return null
      } finally {
        this.pending.delete(controller)
      }
    })()
    this.refreshInFlight = task
    void task.finally(() => {
      if (this.refreshInFlight === task) this.refreshInFlight = null
    })
    return task
  }

  async getProfile(): Promise<AuthProfile | null> {
    const state = useSessionStore.getState()
    if (!state.accessToken || state.phase !== 'authenticated') return null
    const id = this.generation
    const controller = new AbortController()
    this.pending.add(controller)
    try {
      try {
        const result = await this.api.getCurrentProfile(state.accessToken, controller.signal)
        return id === this.generation ? result : null
      } catch (error) {
        if (!(error instanceof AuthHttpError) || error.status !== 401) throw error
        const token = await this.refresh()
        if (!token || id !== this.generation) return null
        const result = await this.api.getCurrentProfile(token, controller.signal)
        return id === this.generation ? result : null
      }
    } catch (error) {
      if (id === this.generation && error instanceof AuthHttpError && error.status === 401) this.invalidate()
      throw error
    } finally {
      this.pending.delete(controller)
    }
  }

  async logout(): Promise<void> {
    const { accessToken, refreshToken } = useSessionStore.getState()
    this.invalidate()
    if (accessToken) {
      try {
        await this.api.logout(accessToken, refreshToken)
      } catch {
        // Local logout succeeds even when remote revocation is unavailable.
        // The backend may still retain the session until its token expires.
      }
    }
  }

  /** Deliberately not exported as a role check. Coach access is server owned. */
  resetForTests() { this.invalidate() }
}
