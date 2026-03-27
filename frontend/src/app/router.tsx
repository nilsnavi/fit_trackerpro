import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { HomePage } from '@pages/HomePage'
import { WorkoutsPage } from '@pages/WorkoutsPage'
import { WorkoutBuilderPage } from '@pages/WorkoutBuilderPage'
import { WorkoutDetailPage } from '@pages/WorkoutDetailPage'
import { ProfilePage } from '@pages/ProfilePage'
import { HealthPage } from '@pages/HealthPage'
import AnalyticsPage from '@pages/AnalyticsPage'
import { Catalog } from '@pages/Catalog'
import { AddExercise } from '@pages/AddExercise'
import WorkoutModePage from '@pages/WorkoutModePage'

export function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<AppShell />}>
                    <Route path="/" element={<HomePage />} />
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
