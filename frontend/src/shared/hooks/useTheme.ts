/**
 * Хук для управления темой приложения
 * Поддерживает светлую, темную и системную темы
 */
import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'

interface UseThemeReturn {
    theme: Theme
    resolvedTheme: 'light' | 'dark'
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
}

const STORAGE_KEY = 'fittracker-theme'

export function useTheme(): UseThemeReturn {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === 'undefined') return 'system'
        return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system'
    })

    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

    // Применение темы к документу
    const applyTheme = useCallback((newTheme: Theme) => {
        const root = document.documentElement
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        const resolved = newTheme === 'system' ? systemTheme : newTheme

        setResolvedTheme(resolved)

        if (resolved === 'dark') {
            root.classList.add('dark')
            root.classList.add('telegram-dark')
        } else {
            root.classList.remove('dark')
            root.classList.remove('telegram-dark')
        }
    }, [])

    // Установка темы
    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme)
        localStorage.setItem(STORAGE_KEY, newTheme)
        applyTheme(newTheme)
    }, [applyTheme])

    // Переключение между светлой и темной темой
    const toggleTheme = useCallback(() => {
        const newTheme = resolvedTheme === 'light' ? 'dark' : 'light'
        setTheme(newTheme)
    }, [resolvedTheme, setTheme])

    // Инициализация темы при загрузке
    useEffect(() => {
        applyTheme(theme)
    }, [theme, applyTheme])

    // Слушатель изменения системной темы
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
            if (theme === 'system') {
                applyTheme('system')
            }
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [theme, applyTheme])

    return {
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
    }
}
