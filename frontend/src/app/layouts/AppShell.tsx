import { Outlet } from 'react-router-dom'
import { Navigation } from '@app/components/Navigation'
import { useTelegramContext } from '../providers/TelegramProvider'
import { cn } from '@shared/lib/cn'

export function AppShell() {
    const { isTelegram } = useTelegramContext()

    return (
        <div
            className={cn(
                'flex min-h-screen min-h-[100dvh] flex-col bg-telegram-bg text-telegram-text antialiased',
                'safe-area-x transition-colors duration-200',
                isTelegram && 'overscroll-y-contain',
            )}
            data-app-shell
            data-telegram={isTelegram ? 'true' : 'false'}
        >
            <main
                className={cn(
                    'min-h-0 flex-1 overflow-x-hidden overflow-y-auto safe-area-top',
                    // h-16 nav + same bottom inset the fixed bar reserves via safe-area-bottom
                    'pb-[calc(4rem+env(safe-area-inset-bottom,0px))]',
                )}
            >
                <Outlet />
            </main>
            <Navigation />
        </div>
    )
}
