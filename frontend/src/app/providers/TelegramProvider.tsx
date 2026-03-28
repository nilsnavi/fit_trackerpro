import { PropsWithChildren, createContext, useContext, useEffect, useMemo } from 'react'
import { UseTelegramWebAppReturn, useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

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

    const {
        isTelegram,
        init,
        expand,
        enableClosingConfirmation,
        setHeaderColor,
        setBackgroundColor,
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
