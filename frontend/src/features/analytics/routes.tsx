import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'
import {
    ProgressExercisesSkeleton,
    ProgressOverviewSkeleton,
    ProgressRecoverySkeleton,
} from '@shared/ui/page-skeletons'

const ProgressOverviewPage = lazy(() => import('@features/analytics/pages/ProgressOverviewPage'))
const ExerciseProgressPage = lazy(() => import('@features/analytics/pages/ExerciseProgressPage'))
const RecoveryPage = lazy(() => import('@features/analytics/pages/RecoveryPage'))

export function analyticsRoutes() {
    return (
        <>
            <Route
                path="/analytics"
                element={<Navigate to="/progress" replace />}
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
