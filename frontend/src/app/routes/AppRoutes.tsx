import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@app/layouts/AppShell'
import { RouteGuard } from '@shared/auth/RouteGuard'
import { ProfilePageSkeleton, RouteFallbackSpinner } from '@shared/ui/page-skeletons'
import { workoutRoutes } from '@features/workouts/routes'
import { analyticsRoutes } from '@features/analytics/routes'
import { profileRoutes } from '@features/profile/routes'
import { legalRoutes } from '@features/legal/routes'

const Home = lazy(() =>
    import('@features/home/pages/Home').then((m) => ({ default: m.Home })),
)
const LoginPage = lazy(() =>
    import('@features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const CoachRouteTree = lazy(() =>
    import('@features/coach/routes').then((m) => ({ default: m.CoachRouteTree })),
)
const ClientCoachPrograms = lazy(() =>
    import('@features/coach/pages/ClientCoachProgramsPage').then((m) => ({ default: m.ClientCoachProgramsPage })),
)

export function AppRoutes() {
    return (
        <Suspense fallback={<RouteFallbackSpinner />}>
            <Routes>
                <Route element={<AppShell />}>
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route
                        path="/home"
                        element={
                            <RouteGuard screenTitle="Главная" isPublic>
                                <Home />
                            </RouteGuard>
                        }
                    />
                    <Route
                        path="/login"
                        element={
                            <RouteGuard screenTitle="Вход" isPublic>
                                <LoginPage />
                            </RouteGuard>
                        }
                    />
                    {workoutRoutes()}
                    {analyticsRoutes()}
                    {profileRoutes()}
                    {legalRoutes()}
                    <Route path="/coach/*" element={<CoachRouteTree />} />
                    <Route
                        path="/client/coach-programs"
                        element={
                            <RouteGuard screenTitle="Программа тренера" skeleton={<ProfilePageSkeleton />}>
                                <ClientCoachPrograms />
                            </RouteGuard>
                        }
                    />
                    <Route path="*" element={<Navigate to="/home" replace />} />
                </Route>
            </Routes>
        </Suspense>
    )
}
