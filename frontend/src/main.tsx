import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TelegramAuthGate } from '@/components/TelegramAuthGate'
import { initSentry } from './app/sentry'
import { installWorkoutSyncTelemetryInfrastructure } from './app/workoutSyncTelemetryBootstrap'
import App from './App'
import './styles/globals.css'

try {
    window.Telegram?.WebApp?.ready()
} catch {
    // non-Telegram environments
}

initSentry()
installWorkoutSyncTelemetryInfrastructure()

if (import.meta.env.DEV) {
    // Динамический импорт: не тянуть debug-хелперы в production-бандл.
    void import('@shared/offline/observability/workoutSyncDebug').then((m) => {
        m.installWorkoutSyncDebugHelpers()
    })
}

const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error('Root element "#root" not found')
}

createRoot(rootElement).render(
    <StrictMode>
        <TelegramAuthGate>
            <App />
        </TelegramAuthGate>
    </StrictMode>,
)
