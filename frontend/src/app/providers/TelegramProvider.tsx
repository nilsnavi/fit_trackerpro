import { PropsWithChildren, createContext, useContext, useEffect, useMemo } from 'react'
import { UseTelegramWebAppReturn, useTelegramWebApp } from '@hooks/useTelegramWebApp'
import { useThemeContext } from './ThemeProvider'

const TelegramContext = createContext<UseTelegramWebAppReturn | null>(null)

export function TelegramProvider({ children }: PropsWithChildren) {
    const telegram = useTelegramWebApp()
    const { setTheme } = useThemeContext()

    useEffect(() => {
        if (!telegram.isTelegram) {
            return
        }
        telegram.init()
        telegram.expand()
        telegram.enableClosingConfirmation()
        telegram.setHeaderColor('bg_color')
        telegram.setBackgroundColor('bg_color')
    }, [telegram])

    useEffect(() => {
        if (telegram.isTelegram && telegram.colorScheme) {
            setTheme(telegram.colorScheme)
        }
    }, [telegram.isTelegram, telegram.colorScheme, setTheme])

    const value = useMemo(() => telegram, [telegram])
    return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>
}

export function useTelegramContext() {
    const context = useContext(TelegramContext)
    if (!context) {
        throw new Error('useTelegramContext must be used inside TelegramProvider')
    }
    return context
}
