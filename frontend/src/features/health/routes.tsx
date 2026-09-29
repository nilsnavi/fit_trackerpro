import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'

const HealthPage = lazy(() =>
    import('@features/health/pages/HealthPage').then((m) => ({ default: m.HealthPage })),
)
const HealthWaterPage = lazy(() =>
    import('@features/health/pages/HealthWaterPage').then((m) => ({ default: m.HealthWaterPage })),
)
const HealthGlucosePage = lazy(() =>
    import('@features/health/pages/HealthGlucosePage').then((m) => ({ default: m.HealthGlucosePage })),
)
const HealthWellnessPage = lazy(() =>
    import('@features/health/pages/HealthWellnessPage').then((m) => ({ default: m.HealthWellnessPage })),
)
const HealthMeasurementsPage = lazy(() =>
    import('@features/health/pages/HealthMeasurementsPage').then((m) => ({ default: m.HealthMeasurementsPage })),
)

/** Feature-local health routes. Register this factory in the app route tree. */
export function healthRoutes() {
    return (
        <>
            <Route path="/health" element={<RouteGuard screenTitle="Здоровье" isPublic><HealthPage /></RouteGuard>} />
            <Route path="/health/water" element={<RouteGuard screenTitle="Вода" isPublic><HealthWaterPage /></RouteGuard>} />
            <Route path="/health/glucose" element={<RouteGuard screenTitle="Глюкоза" isPublic><HealthGlucosePage /></RouteGuard>} />
            <Route path="/health/wellness" element={<RouteGuard screenTitle="Самочувствие" isPublic><HealthWellnessPage /></RouteGuard>} />
            <Route path="/health/measurements" element={<RouteGuard screenTitle="Замеры тела" isPublic><HealthMeasurementsPage /></RouteGuard>} />
        </>
    )
}
