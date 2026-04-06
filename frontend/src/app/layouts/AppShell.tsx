import { Outlet } from 'react-router-dom'
import { ConnectivitySyncBar } from '@app/components/ConnectivitySyncBar'
import { Navigation } from '@app/components/Navigation'
import { ActiveWorkoutBanner } from '@app/components/ActiveWorkoutBanner'
import { useTelegramContext } from '../providers/TelegramProvider'
import { useWorkoutSessionDraftCloudSync } from '@shared/hooks/useWorkoutSessionDraftCloudSync'
import { cn } from '@shared/lib/cn'
import { AppShellHeader } from './AppShellHeader'
import { AppShellLayoutProvider } from './AppShellLayoutContext'

export function AppShell() {
    const { isTelegram } = useTelegramContext()
    useWorkoutSessionDraftCloudSync()

    return (
        <AppShellLayoutProvider>
            <div
                className={cn(
                    'app-shell telegram-viewport-stable flex min-h-screen min-h-[100dvh] flex-col bg-telegram-bg text-telegram-text antialiased',
                    'safe-area-x transition-colors duration-200',
                    isTelegram && 'overscroll-y-contain',
                )}
                data-app-shell
                data-telegram={isTelegram ? 'true' : 'false'}
            >
                <AppShellHeader />
                <ConnectivitySyncBar />
                <main
                    className={cn(
                        'app-shell-main min-h-0 flex-1 overflow-x-hidden overflow-y-auto',
                        'pb-[calc(var(--app-shell-nav-h)+env(safe-area-inset-bottom,0px)+var(--active-workout-banner-h))]',
                    )}
                >
                    <Outlet />
                </main>
                <ActiveWorkoutBanner />
                <Navigation />
            </div>
        </AppShellLayoutProvider>
    )
}
