import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'
import { ProfilePageSkeleton } from '@shared/ui/page-skeletons'

const ProfilePage = lazy(() => import('@features/profile/pages/ProfilePage'))
const HealthPage = lazy(() =>
    import('@features/health/pages/HealthPage').then((m) => ({ default: m.HealthPage })),
)
const AchievementsPage = lazy(() => import('@features/achievements/pages/AchievementsPage'))
// SPEC-006 §58: accepted targets whose automatic prefill is switched off.
const ProgressionTargetsPage = lazy(() =>
    import('@features/workouts/pages/ProgressionTargetsPage').then((m) => ({
        default: m.ProgressionTargetsPage,
    })),
)

export function profileRoutes() {
    return (
        <>
            <Route
                path="/profile"
                element={
                    <RouteGuard screenTitle="Профиль" skeleton={<ProfilePageSkeleton />}>
                        <ProfilePage />
                    </RouteGuard>
                }
            />
            <Route
                path="/health"
                element={
                    <RouteGuard screenTitle="Здоровье" isPublic>
                        <HealthPage />
                    </RouteGuard>
                }
            />
            <Route
                path="/achievements"
                element={
                    <RouteGuard screenTitle="Достижения">
                        <AchievementsPage />
                    </RouteGuard>
                }
            />
            <Route
                path="/profile/progression-targets"
                element={
                    <RouteGuard screenTitle="Цели прогрессии" skeleton={<ProfilePageSkeleton />}>
                        <ProgressionTargetsPage />
                    </RouteGuard>
                }
            />
        </>
    )
}
