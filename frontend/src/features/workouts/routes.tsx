import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { RouteGuard } from '@shared/auth/RouteGuard'
import {
    ActiveWorkoutSkeleton,
    CatalogPageSkeleton,
    TemplateBuilderSkeleton,
    TemplatesPageSkeleton,
    WorkoutHistorySkeleton,
    WorkoutsPageSkeleton,
} from '@shared/ui/page-skeletons'

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
const WorkoutSummaryPage = lazy(() =>
    import('@features/workouts/pages/WorkoutSummaryPage').then((m) => ({ default: m.WorkoutSummaryPage })),
)
const WorkoutModePage = lazy(() => import('@features/workouts/pages/WorkoutModePage'))
const WorkoutCalendarPage = lazy(() => import('@features/workouts/pages/Calendar'))
const Catalog = lazy(() => import('@features/exercises/pages/Catalog'))
const AddExercise = lazy(() => import('@features/exercises/pages/AddExercise'))

export function workoutRoutes() {
    return (
        <>
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
                path="/workouts/active/:id/summary"
                element={
                    <RouteGuard screenTitle="Итог тренировки" skeleton={<ActiveWorkoutSkeleton />}>
                        <WorkoutSummaryPage />
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
                element={<Navigate to=".." relative="path" replace />}
            />
            <Route
                path="/workouts/active/:id/edit"
                element={<Navigate to=".." relative="path" replace />}
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
        </>
    )
}
