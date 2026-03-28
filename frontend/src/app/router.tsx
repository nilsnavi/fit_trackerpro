import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { Home } from '@features/home/pages/Home'
import { WorkoutsPage } from '@features/workouts/pages/WorkoutsPage'
import { WorkoutBuilderPage } from '@features/workouts/pages/WorkoutBuilderPage'
import { WorkoutDetailPage } from '@features/workouts/pages/WorkoutDetailPage'
import { ProfilePage } from '@features/profile/pages/ProfilePage'
import { HealthPage } from '@features/health/pages/HealthPage'
import AnalyticsPage from '@features/analytics/pages/AnalyticsPage'
import { Catalog } from '@features/exercises/pages/Catalog'
import { AddExercise } from '@features/exercises/pages/AddExercise'
import WorkoutModePage from '@features/workouts/pages/WorkoutModePage'

export function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<AppShell />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/workouts" element={<WorkoutsPage />} />
                    <Route path="/workouts/builder" element={<WorkoutBuilderPage />} />
                    <Route path="/workouts/mode/:mode" element={<WorkoutModePage />} />
                    <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
                    <Route path="/exercises" element={<Catalog />} />
                    <Route path="/exercises/add" element={<AddExercise />} />
                    <Route path="/health" element={<HealthPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
