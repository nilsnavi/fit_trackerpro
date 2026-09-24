import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'

const LegalPage = lazy(() =>
    import('@features/legal/pages/LegalPage').then((m) => ({ default: m.LegalPage })),
)

/** Публично доступные правовые документы: нужны и до, и после онбординга. */
export function legalRoutes() {
    return (
        <>
            <Route
                path="/legal/:doc"
                element={
                    <RouteGuard screenTitle="Правовая информация" isPublic>
                        <LegalPage />
                    </RouteGuard>
                }
            />
        </>
    )
}
