import { create } from 'zustand'

const ACCESS_TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

/**
 * One-time read: e2e / legacy browser sessions may have seeded localStorage before
 * the app switched to in-memory tokens. We never write tokens back to localStorage.
 */
function readLegacyTokensOnce(): { accessToken: string | null; refreshToken: string | null } {
    if (typeof window === 'undefined') {
        return { accessToken: null, refreshToken: null }
    }
    try {
        return {
            accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
            refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
        }
    } catch {
        return { accessToken: null, refreshToken: null }
    }
}

function clearLegacyStorage(): void {
    if (typeof window === 'undefined') return
    try {
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
    } catch {
        // ignore
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
    const { accessToken: legacyAccess, refreshToken: legacyRefresh } = readLegacyTokensOnce()
    if (legacyAccess || legacyRefresh) {
        clearLegacyStorage()
    }

    return {
        accessToken: legacyAccess,
        refreshToken: legacyRefresh,
        isAuthenticated: Boolean(legacyAccess),
        setTokens: ({ accessToken, refreshToken }) => {
            clearLegacyStorage()
            set({
                accessToken,
                refreshToken: refreshToken === undefined ? get().refreshToken : refreshToken,
                isAuthenticated: Boolean(accessToken),
            })
        },
        clear: () => {
            clearLegacyStorage()
            set({ accessToken: null, refreshToken: null, isAuthenticated: false })
        },
    }
})

/** Non-hook accessor for modules (e.g. API client interceptors). */
export function getAuthTokens(): { accessToken: string | null; refreshToken: string | null } {
    const s = useAuthStore.getState()
    return { accessToken: s.accessToken, refreshToken: s.refreshToken }
}

