import { create } from 'zustand'

const ACCESS_TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

function safeGet(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function safeSet(key: string, value: string | null): void {
    try {
        if (!value) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
    } catch {
        // ignore storage failures (private mode, blocked storage)
    }
}

export interface AuthState {
    accessToken: string | null
    refreshToken: string | null
    isAuthenticated: boolean
    setTokens: (tokens: { accessToken: string; refreshToken?: string | null }) => void
    clear: () => void
}

export const useAuthStore = create<AuthState>((set, get) => {
    const accessToken = safeGet(ACCESS_TOKEN_KEY)
    const refreshToken = safeGet(REFRESH_TOKEN_KEY)

    return {
        accessToken,
        refreshToken,
        isAuthenticated: Boolean(accessToken),
        setTokens: ({ accessToken, refreshToken }) => {
            safeSet(ACCESS_TOKEN_KEY, accessToken)
            if (refreshToken !== undefined) safeSet(REFRESH_TOKEN_KEY, refreshToken)
            set({
                accessToken,
                refreshToken: refreshToken === undefined ? get().refreshToken : refreshToken,
                isAuthenticated: Boolean(accessToken),
            })
        },
        clear: () => {
            safeSet(ACCESS_TOKEN_KEY, null)
            safeSet(REFRESH_TOKEN_KEY, null)
            set({ accessToken: null, refreshToken: null, isAuthenticated: false })
        },
    }
})

/** Non-hook accessor for modules (e.g. API client interceptors). */
export function getAuthTokens(): { accessToken: string | null; refreshToken: string | null } {
    const s = useAuthStore.getState()
    return { accessToken: s.accessToken, refreshToken: s.refreshToken }
}

