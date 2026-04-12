import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'
import {
    AnalyticsPageSkeleton,
    ProgressExercisesSkeleton,
    ProgressOverviewSkeleton,
    ProgressRecoverySkeleton,
} from '@shared/ui/page-skeletons'

const AnalyticsDashboardPage = lazy(() => import('@features/analytics/pages/AnalyticsDashboardPage'))
const ProgressOverviewPage = lazy(() => import('@features/analytics/pages/ProgressOverviewPage'))
const ExerciseProgressPage = lazy(() => import('@features/analytics/pages/ExerciseProgressPage'))
const RecoveryPage = lazy(() => import('@features/analytics/pages/RecoveryPage'))

export function analyticsRoutes() {
    return (
        <>
            <Route
                path="/analytics"
                element={
                    <RouteGuard screenTitle="Аналитика" skeleton={<AnalyticsPageSkeleton />}>
                        <AnalyticsDashboardPage />
                    </RouteGuard>
                }
            />
            <Route
                path="/progress"
                element={
                    <RouteGuard screenTitle="Прогресс" skeleton={<ProgressOverviewSkeleton />}>
                        <ProgressOverviewPage />
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
