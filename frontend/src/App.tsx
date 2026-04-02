import * as Sentry from '@sentry/react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PwaUpdatePrompt } from './app/components/PwaUpdatePrompt'
import { QueryProvider } from './app/providers/QueryProvider'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { TelegramProvider } from './app/providers/TelegramProvider'
import { AppShell } from './app/layouts/AppShell'
import { RouteGuard } from '@shared/auth/RouteGuard'
import {
    ActiveWorkoutSkeleton,
    CatalogPageSkeleton,
    ProfilePageSkeleton,
    ProgressExercisesSkeleton,
    ProgressOverviewSkeleton,
    ProgressRecoverySkeleton,
    RouteFallbackSpinner,
    TemplateBuilderSkeleton,
    TemplatesPageSkeleton,
    WorkoutHistorySkeleton,
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
const WorkoutTemplatesPage = lazy(() =>
    import('@features/workouts/pages/WorkoutTemplatesPage').then((m) => ({ default: m.WorkoutTemplatesPage })),
)
const WorkoutTemplateDetailPage = lazy(() =>
    import('@features/workouts/pages/WorkoutTemplateDetailPage').then((m) => ({ default: m.WorkoutTemplateDetailPage })),
)
const WorkoutHistoryPage = lazy(() =>
    import('@features/workouts/pages/WorkoutHistoryPage').then((m) => ({ default: m.WorkoutHistoryPage })),
)
const WorkoutDetailPage = lazy(() =>
    import('@features/workouts/pages/WorkoutDetailPage').then((m) => ({ default: m.WorkoutDetailPage })),
)
const ActiveWorkoutPage = lazy(() =>
    import('@features/workouts/pages/ActiveWorkoutPage').then((m) => ({ default: m.ActiveWorkoutPage })),
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

export default function App() {
    return (
        <QueryProvider>
            <Sentry.ErrorBoundary fallback={SentryErrorFallback} showDialog={false}>
                <TelegramProvider>
                    <ThemeProvider>
                        <BrowserRouter>
                            <PwaUpdatePrompt />
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
                                            path="/workouts"
                                            element={
                                                <RouteGuard screenTitle="Тренировки" skeleton={<WorkoutsPageSkeleton />}>
                                                    <WorkoutsPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/templates"
                                            element={
                                                <RouteGuard screenTitle="Шаблоны тренировок" skeleton={<TemplatesPageSkeleton />}>
                                                    <WorkoutTemplatesPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/templates/new"
                                            element={
                                                <RouteGuard screenTitle="Конструктор тренировки" skeleton={<TemplateBuilderSkeleton />}>
                                                    <WorkoutBuilderPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/mode/:mode"
                                            element={
                                                <RouteGuard screenTitle="Режим тренировки">
                                                    <WorkoutModePage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/templates/:id"
                                            element={
                                                <RouteGuard screenTitle="Шаблон тренировки" skeleton={<TemplatesPageSkeleton />}>
                                                    <WorkoutTemplateDetailPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/templates/:id/edit"
                                            element={
                                                <RouteGuard screenTitle="Редактирование шаблона" skeleton={<TemplateBuilderSkeleton />}>
                                                    <WorkoutBuilderPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/history"
                                            element={
                                                <RouteGuard screenTitle="История тренировок" skeleton={<WorkoutHistorySkeleton />}>
                                                    <WorkoutHistoryPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/calendar"
                                            element={
                                                <RouteGuard screenTitle="Календарь" skeleton={<WorkoutHistorySkeleton />}>
                                                    <WorkoutCalendarPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/active/:id"
                                            element={
                                                <RouteGuard screenTitle="Тренировка" skeleton={<ActiveWorkoutSkeleton />}>
                                                    <ActiveWorkoutPage />
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
                                        <Route
                                            path="/exercises"
                                            element={
                                                <RouteGuard screenTitle="Каталог упражнений" skeleton={<CatalogPageSkeleton />}>
                                                    <Catalog />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/exercises/add"
                                            element={
                                                <RouteGuard screenTitle="Новое упражнение">
                                                    <AddExercise />
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
                                            path="/progress/exercises"
                                            element={
                                                <RouteGuard screenTitle="Прогресс упражнений" skeleton={<ProgressExercisesSkeleton />}>
                                                    <AnalyticsPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/progress/recovery"
                                            element={
                                                <RouteGuard screenTitle="Восстановление" skeleton={<ProgressRecoverySkeleton />}>
                                                    <AnalyticsPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/analytics"
                                            element={<Navigate to="/progress" replace />}
                                        />
                                        <Route
                                            path="/progress"
                                            element={
                                                <RouteGuard screenTitle="Прогресс" skeleton={<ProgressOverviewSkeleton />}>
                                                    <AnalyticsPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/builder"
                                            element={<Navigate to="/workouts/templates/new" replace />}
                                        />
                                        <Route
                                            path="/workouts/:id"
                                            element={
                                                <RouteGuard screenTitle="Тренировка" skeleton={<ActiveWorkoutSkeleton />}>
                                                    <WorkoutDetailPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/:id/edit"
                                            element={
                                                <RouteGuard screenTitle="Редактирование тренировки">
                                                    <WorkoutEditPage />
                                                </RouteGuard>
                                            }
                                        />
                                        <Route
                                            path="/workouts/active/:id/edit"
                                            element={
                                                <RouteGuard screenTitle="Редактирование тренировки">
                                                    <WorkoutEditPage />
                                                </RouteGuard>
                                            }
                                        />
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
                                            path="/sandbox/rest-timer"
                                            element={
                                                <RouteGuard screenTitle="Sandbox · Rest timer" isPublic>
                                                    <RestTimerSandboxPage />
                                                </RouteGuard>
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
