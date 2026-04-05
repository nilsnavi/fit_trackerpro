import { PropsWithChildren, createContext, useContext, useEffect, useMemo } from 'react'
import { Theme, useTheme } from '@shared/hooks/useTheme'
import { useTelegramContext } from './TelegramProvider'

interface ThemeProviderValue {
    theme: Theme
    resolvedTheme: 'light' | 'dark'
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeProviderValue | null>(null)

export function ThemeProvider({ children }: PropsWithChildren) {
    const themeState = useTheme()
    const { isTelegram, colorScheme } = useTelegramContext()
    const { theme, resolvedTheme, setTheme, toggleTheme } = themeState

    useEffect(() => {
        if (isTelegram && colorScheme) {
            setTheme(colorScheme)
        }
    }, [isTelegram, colorScheme, setTheme])

    const value = useMemo(
        () => ({
            theme,
            resolvedTheme,
            setTheme,
            toggleTheme,
        }),
        [theme, resolvedTheme, setTheme, toggleTheme],
    )

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThemeContext() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useThemeContext must be used inside ThemeProvider')
    }
    return context
}
