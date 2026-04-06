import { useLocation } from 'react-router-dom'
import { cn } from '@shared/lib/cn'
import { useTelegramContext } from '../providers/TelegramProvider'
import { useAppShellLayoutContext } from './AppShellLayoutContext'
import { getAppShellTitle } from './appShellTitles'

export function AppShellHeader() {
    const { pathname } = useLocation()
    const { isTelegram } = useTelegramContext()
    const { headerRight } = useAppShellLayoutContext()
    const title = getAppShellTitle(pathname)

    return (
        <header
            className={cn(
                'app-shell-header shrink-0 border-b border-border bg-telegram-bg/95 backdrop-blur-md',
                'safe-area-top',
                isTelegram && 'shadow-sm shadow-black/10',
            )}
            role="banner"
        >
            <div className="flex min-h-[var(--app-shell-header-inner-h)] items-center justify-between gap-3 px-4">
                <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-telegram-text">
                    {title}
                </h1>
                <div className="flex min-w-0 shrink-0 items-center justify-end">{headerRight}</div>
            </div>
        </header>
    )
}
