import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'
import {
    AnalyticsPageSkeleton,
    ProgressExercisesSkeleton,
    ProgressRecoverySkeleton,
} from '@shared/ui/page-skeletons'

const AnalyticsDashboardPage = lazy(() => import('@features/analytics/pages/AnalyticsDashboardPage'))
const ExerciseProgressPage = lazy(() =>
    import('@features/analytics/pages/ExerciseProgressPage').then((m) => ({ default: m.ExerciseProgressPage })),
)
const RecoveryPage = lazy(() => import('@features/analytics/pages/RecoveryPage'))

export function analyticsRoutes() {
    return (
        <>
            {/* Legacy alias: единый дашборд прогресса живёт на /progress. */}
            <Route path="/analytics" element={<Navigate to="/progress" replace />} />
            <Route
                path="/progress"
                element={
                    <RouteGuard screenTitle="Прогресс" skeleton={<AnalyticsPageSkeleton />}>
                        <AnalyticsDashboardPage />
                    </RouteGuard>
                }
            />
            <Route
                path="/progress/exercises"
                element={
                    <RouteGuard screenTitle="Прогресс упражнений" skeleton={<ProgressExercisesSkeleton />}>
                        <ExerciseProgressPage />
                    </RouteGuard>
                }
            />
            <Route
                path="/progress/recovery"
                element={
                    <RouteGuard screenTitle="Восстановление" skeleton={<ProgressRecoverySkeleton />}>
                        <RecoveryPage />
                    </RouteGuard>
                }
            />
        </>
    )
}
