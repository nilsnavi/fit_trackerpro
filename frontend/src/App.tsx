import * as Sentry from '@sentry/react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryProvider } from './app/providers/QueryProvider'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { TelegramProvider } from './app/providers/TelegramProvider'
import { AppShell } from './app/layouts/AppShell'

const Home = lazy(() =>
    import('@features/home/pages/Home').then((m) => ({ default: m.Home })),
)
const WorkoutsPage = lazy(() =>
    import('@features/workouts/pages/WorkoutsPage').then((m) => ({ default: m.WorkoutsPage })),
)
const WorkoutBuilderPage = lazy(() =>
    import('@features/workouts/pages/WorkoutBuilderPage').then((m) => ({ default: m.WorkoutBuilderPage })),
)
const WorkoutDetailPage = lazy(() =>
    import('@features/workouts/pages/WorkoutDetailPage').then((m) => ({ default: m.WorkoutDetailPage })),
)
const ProfilePage = lazy(() => import('@features/profile/pages/ProfilePage'))
const HealthPage = lazy(() =>
    import('@features/health/pages/HealthPage').then((m) => ({ default: m.HealthPage })),
)
const AnalyticsPage = lazy(() => import('@features/analytics/pages/AnalyticsPage'))
const Catalog = lazy(() => import('@features/exercises/pages/Catalog'))
const AddExercise = lazy(() => import('@features/exercises/pages/AddExercise'))
const WorkoutModePage = lazy(() => import('@features/workouts/pages/WorkoutModePage'))
const WorkoutEditPage = lazy(() =>
    import('@features/workouts/pages/WorkoutEditPage').then((m) => ({ default: m.WorkoutEditPage })),
)
const LoginPage = lazy(() =>
    import('@features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const WorkoutCalendarPage = lazy(() => import('@features/workouts/pages/Calendar'))

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

function RoutePageFallback() {
    return (
        <div
            className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 p-6"
            aria-busy="true"
            aria-live="polite"
        >
            <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
                role="status"
                aria-label="Loading page"
            />
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
                            <Suspense fallback={<RoutePageFallback />}>
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
                            </Suspense>
                        </BrowserRouter>
                    </ThemeProvider>
                </TelegramProvider>
            </Sentry.ErrorBoundary>
        </QueryProvider>
    )
}
