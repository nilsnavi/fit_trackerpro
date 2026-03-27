import { Outlet } from 'react-router-dom'
import { Navigation } from '@components/common/Navigation'

export function AppShell() {
    return (
        <div className="min-h-screen bg-telegram-bg text-telegram-text transition-colors duration-200">
            <main className="pb-20">
                <Outlet />
            </main>
            <Navigation />
        </div>
    )
}
