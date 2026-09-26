/**
 * Backend Health Check Gate
 *
 * Shows the maintenance screen only when the backend itself reports an outage
 * *before* the app has started. Offline, network errors and a misrouted probe never
 * block the UI (offline-first: workouts are recorded locally and synced later).
 *
 * Once the app has rendered, the tree is never swapped out again — unmounting it
 * would wipe in-progress UI state such as an active workout (SPEC-005 §48). A later
 * outage is shown as a non-blocking banner instead.
 */

import React, { useRef } from 'react'
import { useBackendHealth } from '@shared/hooks/useBackendHealth'
import { MaintenanceScreen } from '../components/MaintenanceScreen'

interface HealthCheckGateProps {
    children: React.ReactNode
    /** Show a spinner until the first check resolves (only before the app has started). */
    showLoadingWhileChecking?: boolean
}

function BackendOutageBanner() {
    return (
        <div
            role="status"
            aria-live="polite"
            data-testid="backend-outage-banner"
            className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-lg px-3 [padding-top:max(0.5rem,env(safe-area-inset-top))]"
        >
            <div className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-center text-sm font-medium text-telegram-text shadow-sm backdrop-blur">
                Сервер временно недоступен — изменения сохранятся на устройстве и синхронизируются позже
            </div>
        </div>
    )
}

export const HealthCheckGate: React.FC<HealthCheckGateProps> = ({
    children,
    showLoadingWhileChecking = true,
}) => {
    const { status } = useBackendHealth({ checkIntervalMs: 5000, initialCheckDelayMs: 500 })

    const hasStartedRef = useRef(false)

    if (!hasStartedRef.current) {
        if (status === 'not_ready') {
            return <MaintenanceScreen message="Техническое обслуживание" showDetails />
        }
        if (status === 'checking' && showLoadingWhileChecking) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
                    <div className="text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
                        </div>
                        <p className="text-slate-300">Загрузка...</p>
                    </div>
                </div>
            )
        }
        hasStartedRef.current = true
    }

    return (
        <>
            {status === 'not_ready' && <BackendOutageBanner />}
            {children}
        </>
    )
}

export default HealthCheckGate
