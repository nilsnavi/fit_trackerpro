import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'
import { ProfilePageSkeleton } from '@shared/ui/page-skeletons'

const ProfilePage = lazy(() => import('@features/profile/pages/ProfilePage'))
const PreferencesPage = lazy(() => import('@features/profile/pages/PreferencesPage'))
const MeasurementsPage = lazy(() => import('@features/profile/pages/MeasurementsPage'))
const AccountPrivacyPage = lazy(() => import('@features/profile/pages/AccountPrivacyPage'))
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
            <Route
                path="/profile/preferences"
                element={
                    <RouteGuard screenTitle="Настройки" skeleton={<ProfilePageSkeleton />}>
                        <PreferencesPage />
                    </RouteGuard>
                }
            />
            <Route
                path="/profile/measurements"
                element={
                    <RouteGuard screenTitle="Замеры тела" skeleton={<ProfilePageSkeleton />}>
                        <MeasurementsPage />
                    </RouteGuard>
                }
            />
            <Route
                path="/profile/account"
                element={
                    <RouteGuard screenTitle="Аккаунт и приватность" skeleton={<ProfilePageSkeleton />}>
                        <AccountPrivacyPage />
                    </RouteGuard>
                }
            />
        </>
    )
}
