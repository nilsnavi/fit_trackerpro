import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@app/layouts/AppShell'
import { RouteGuard } from '@shared/auth/RouteGuard'
import { RouteFallbackSpinner } from '@shared/ui/page-skeletons'
import { workoutRoutes } from '@features/workouts/routes'
import { analyticsRoutes } from '@features/analytics/routes'
import { profileRoutes } from '@features/profile/routes'

const Home = lazy(() =>
    import('@features/home/pages/Home').then((m) => ({ default: m.Home })),
)
const LoginPage = lazy(() =>
    import('@features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)

export function AppRoutes() {
    return (
        <Suspense fallback={<RouteFallbackSpinner />}>
            <Routes>
                <Route element={<AppShell />}>
                    <Route
                        path="/"
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
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </Suspense>
    )
}
