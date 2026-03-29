import * as Sentry from '@sentry/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryProvider } from './app/providers/QueryProvider'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { TelegramProvider } from './app/providers/TelegramProvider'
import { AppShell } from './app/layouts/AppShell'
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
import { WorkoutEditPage } from '@features/workouts/pages/WorkoutEditPage'
import { LoginPage } from '@features/auth/pages/LoginPage'
import WorkoutCalendarPage from '@features/workouts/pages/Calendar'

function SentryErrorFallback({
    resetError,
    error: _error,
    componentStack: _componentStack,
    eventId: _eventId,
}: {
    error: unknown
    componentStack: string
    eventId: string
    resetError(): void
}) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg font-medium text-foreground">Something went wrong</p>
            <button
                type="button"
                onClick={resetError}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
                Try again
            </button>
        </div>
    )
}

export default function App() {
    return (
        <QueryProvider>
            <Sentry.ErrorBoundary fallback={SentryErrorFallback} showDialog={false}>
                <TelegramProvider>
                    <ThemeProvider>
                        <BrowserRouter>
                            <Routes>
                                <Route element={<AppShell />}>
                                    <Route path="/" element={<Home />} />
                                    <Route path="/workouts" element={<WorkoutsPage />} />
                                    <Route path="/workouts/builder" element={<WorkoutBuilderPage />} />
                                    <Route path="/workouts/mode/:mode" element={<WorkoutModePage />} />
                                    <Route path="/workouts/calendar" element={<WorkoutCalendarPage />} />
                                    <Route path="/workouts/:id/edit" element={<WorkoutEditPage />} />
                                    <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route path="/exercises" element={<Catalog />} />
                                    <Route path="/exercises/add" element={<AddExercise />} />
                                    <Route path="/health" element={<HealthPage />} />
                                    <Route path="/analytics" element={<AnalyticsPage />} />
                                    <Route path="/profile" element={<ProfilePage />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Route>
                            </Routes>
                        </BrowserRouter>
                    </ThemeProvider>
                </TelegramProvider>
            </Sentry.ErrorBoundary>
        </QueryProvider>
    )
}
