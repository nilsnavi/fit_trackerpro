import { PropsWithChildren, createContext, useContext, useMemo } from 'react'
import { Theme, useTheme } from '@hooks/useTheme'

interface ThemeProviderValue {
    theme: Theme
    resolvedTheme: 'light' | 'dark'
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeProviderValue | null>(null)

export function ThemeProvider({ children }: PropsWithChildren) {
    const themeState = useTheme()
    const value = useMemo(
        () => ({
            theme: themeState.theme,
            resolvedTheme: themeState.resolvedTheme,
            setTheme: themeState.setTheme,
            toggleTheme: themeState.toggleTheme,
        }),
        [themeState],
    )

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useThemeContext must be used inside ThemeProvider')
    }
    return context
}
