import * as Sentry from '@sentry/react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PwaUpdatePrompt } from './app/components/PwaUpdatePrompt'
import { QueryProvider } from './app/providers/QueryProvider'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { TelegramProvider } from './app/providers/TelegramProvider'
import { AppShell } from './app/layouts/AppShell'
import { RouteErrorBoundary } from '@shared/ui/RouteErrorBoundary'
import { ProtectedRoute } from '@shared/auth/ProtectedRoute'
import {
    AnalyticsPageSkeleton,
    CatalogPageSkeleton,
    ProfilePageSkeleton,
    RouteFallbackSpinner,
    WorkoutsPageSkeleton,
} from '@shared/ui/page-skeletons'

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
const AchievementsPage = lazy(() => import('@features/achievements/pages/AchievementsPage'))
const RestTimerSandboxPage = lazy(() => import('@features/sandbox/pages/RestTimerDemo'))

function SentryErrorFallback({
    resetError,
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
    const { pathname } = useLocation()
    if (pathname === '/profile') return <ProfilePageSkeleton />
    if (pathname === '/exercises') return <CatalogPageSkeleton />
    if (pathname === '/workouts') return <WorkoutsPageSkeleton />
    if (pathname === '/analytics') return <AnalyticsPageSkeleton />
    return <RouteFallbackSpinner />
}

export default function App() {
    return (
        <QueryProvider>
            <Sentry.ErrorBoundary fallback={SentryErrorFallback} showDialog={false}>
                <TelegramProvider>
                    <ThemeProvider>
                        <BrowserRouter>
                            <PwaUpdatePrompt />
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
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Тренировки">
                                                        <WorkoutsPage />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route
                                            path="/workouts/builder"
                                            element={
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Конструктор тренировки">
                                                        <WorkoutBuilderPage />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route
                                            path="/workouts/mode/:mode"
                                            element={
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Режим тренировки">
                                                        <WorkoutModePage />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route
                                            path="/workouts/calendar"
                                            element={
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Календарь">
                                                        <WorkoutCalendarPage />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route
                                            path="/workouts/:id/edit"
                                            element={
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Редактирование тренировки">
                                                        <WorkoutEditPage />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route
                                            path="/workouts/:id"
                                            element={
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Тренировка">
                                                        <WorkoutDetailPage />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
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
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Каталог упражнений">
                                                        <Catalog />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route
                                            path="/exercises/add"
                                            element={
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Новое упражнение">
                                                        <AddExercise />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
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
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Аналитика">
                                                        <AnalyticsPage />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route
                                            path="/profile"
                                            element={
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Профиль">
                                                        <ProfilePage />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route
                                            path="/achievements"
                                            element={
                                                <ProtectedRoute>
                                                    <RouteErrorBoundary screenTitle="Достижения">
                                                        <AchievementsPage />
                                                    </RouteErrorBoundary>
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route
                                            path="/sandbox/rest-timer"
                                            element={
                                                <RouteErrorBoundary screenTitle="Sandbox · Rest timer">
                                                    <RestTimerSandboxPage />
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
