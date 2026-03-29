import * as Sentry from '@sentry/react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryProvider } from './app/providers/QueryProvider'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { TelegramProvider } from './app/providers/TelegramProvider'
import { AppShell } from './app/layouts/AppShell'
import { RouteErrorBoundary } from '@shared/ui/RouteErrorBoundary'

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
                                        <Route
                                            path="/"
                                            element={
                                                <RouteErrorBoundary screenTitle="Главная">
                                                    <Home />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/workouts"
                                            element={
                                                <RouteErrorBoundary screenTitle="Тренировки">
                                                    <WorkoutsPage />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/workouts/builder"
                                            element={
                                                <RouteErrorBoundary screenTitle="Конструктор тренировки">
                                                    <WorkoutBuilderPage />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/workouts/mode/:mode"
                                            element={
                                                <RouteErrorBoundary screenTitle="Режим тренировки">
                                                    <WorkoutModePage />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/workouts/calendar"
                                            element={
                                                <RouteErrorBoundary screenTitle="Календарь">
                                                    <WorkoutCalendarPage />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/workouts/:id/edit"
                                            element={
                                                <RouteErrorBoundary screenTitle="Редактирование тренировки">
                                                    <WorkoutEditPage />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/workouts/:id"
                                            element={
                                                <RouteErrorBoundary screenTitle="Тренировка">
                                                    <WorkoutDetailPage />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/login"
                                            element={
                                                <RouteErrorBoundary screenTitle="Вход">
                                                    <LoginPage />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/exercises"
                                            element={
                                                <RouteErrorBoundary screenTitle="Каталог упражнений">
                                                    <Catalog />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/exercises/add"
                                            element={
                                                <RouteErrorBoundary screenTitle="Новое упражнение">
                                                    <AddExercise />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/health"
                                            element={
                                                <RouteErrorBoundary screenTitle="Здоровье">
                                                    <HealthPage />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/analytics"
                                            element={
                                                <RouteErrorBoundary screenTitle="Аналитика">
                                                    <AnalyticsPage />
                                                </RouteErrorBoundary>
                                            }
                                        />
                                        <Route
                                            path="/profile"
                                            element={
                                                <RouteErrorBoundary screenTitle="Профиль">
                                                    <ProfilePage />
                                                </RouteErrorBoundary>
                                            }
                                        />
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
