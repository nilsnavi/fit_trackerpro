import { PropsWithChildren, createContext, useContext, useEffect, useMemo } from 'react'
import { UseTelegramWebAppReturn, useTelegramWebApp } from '@hooks/useTelegramWebApp'
import { useThemeContext } from './ThemeProvider'

const TelegramContext = createContext<UseTelegramWebAppReturn | null>(null)

/** App-level Telegram Mini App setup (ready, layout, chrome). */
function bootstrapTelegramWebApp(
    tg: Pick<
        UseTelegramWebAppReturn,
        'init' | 'expand' | 'enableClosingConfirmation' | 'setHeaderColor' | 'setBackgroundColor'
    >,
) {
    tg.init()
    tg.expand()
    tg.enableClosingConfirmation()
    tg.setHeaderColor('bg_color')
    tg.setBackgroundColor('bg_color')
}

export function TelegramProvider({ children }: PropsWithChildren) {
    const telegram = useTelegramWebApp()
    const { setTheme } = useThemeContext()

    const {
        isTelegram,
        init,
        expand,
        enableClosingConfirmation,
        setHeaderColor,
        setBackgroundColor,
        colorScheme,
    } = telegram

    useEffect(() => {
        if (!isTelegram) {
            return
        }
        bootstrapTelegramWebApp({
            init,
            expand,
            enableClosingConfirmation,
            setHeaderColor,
            setBackgroundColor,
        })
    }, [
        isTelegram,
        init,
        expand,
        enableClosingConfirmation,
        setHeaderColor,
        setBackgroundColor,
    ])

    useEffect(() => {
        if (isTelegram && colorScheme) {
            setTheme(colorScheme)
        }
    }, [isTelegram, colorScheme, setTheme])

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
