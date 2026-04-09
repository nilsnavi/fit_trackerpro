import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'
import { ProfilePageSkeleton } from '@shared/ui/page-skeletons'

const ProfilePage = lazy(() => import('@features/profile/pages/ProfilePage'))
const HealthPage = lazy(() =>
    import('@features/health/pages/HealthPage').then((m) => ({ default: m.HealthPage })),
)
const AchievementsPage = lazy(() => import('@features/achievements/pages/AchievementsPage'))

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
        </>
    )
}
