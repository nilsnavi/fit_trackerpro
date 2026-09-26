import { TelegramAuthGate } from '@/components/TelegramAuthGate'
import { useAppTerminationStore } from '@/stores/appTerminationStore'
import { AccountDeletedScreen } from './components/AccountDeletedScreen'
import App from '../App'

/**
 * Root switch above every provider and auth gate: a terminal state (account deleted)
 * unmounts the entire app, so nothing can log in again or write user data back.
 */
export function AppRoot() {
    const reason = useAppTerminationStore((s) => s.reason)

    if (reason === 'account_deleted') {
        return <AccountDeletedScreen />
    }

    return (
        <TelegramAuthGate>
            <App />
        </TelegramAuthGate>
    )
}

export default AppRoot
