# Frontend Performance Prelaunch Report

Date: 2026-04-03
Scope: ActiveWorkoutPage, Zustand subscriptions, DnD exercise lists, AddExerciseSheet catalog, route-level loading, analytics/progress.

## 1. Lint delta (only new warnings/errors after changes)

Checked files:
- `frontend/src/features/analytics/pages/Analytics.tsx`
- `frontend/src/features/workouts/pages/ActiveWorkoutPage.tsx`
- `frontend/src/features/workouts/pages/WorkoutModePage.tsx`
- `frontend/src/features/workouts/workoutMode/AddExerciseSheet.tsx`
- `frontend/src/features/workouts/workoutMode/WorkoutModeExerciseList.tsx`
- `frontend/src/features/workouts/workoutMode/WorkoutModeExerciseCard.tsx`
- `frontend/src/features/workouts/active/components/ActiveExerciseList.tsx`
- `frontend/src/features/workouts/active/components/ExerciseSetRow.tsx`
- `frontend/src/features/workouts/active/components/WorkoutSyncIndicator.tsx`
- `frontend/src/features/workouts/components/CurrentExerciseCard.tsx`

Result:
- New lint warnings: **0**
- New lint errors: **0**

Note:
- ESLint printed environment warning about unsupported TypeScript version for `@typescript-eslint/typescript-estree` (TS 5.9.3 vs supported `<5.4.0`). This is tooling/environment warning, not a code warning from changed files.

## 2. Implemented optimizations (summary)

### Zustand and rerender isolation
- Replaced broad active-workout state subscription with selector-based field reads in ActiveWorkoutPage.
- Isolated frequently-updating state consumers (sync indicator, rest timer section) into memoized subcomponents.
- Reduced parent-page rerenders caused by `syncState` and rest timer ticks.

### DnD list performance
- Added `React.memo` boundaries for heavy list rows/cards and list wrappers.
- Memoized sortable IDs for DnD contexts.
- Stabilized callbacks (`useCallback`) to reduce prop churn and unnecessary child rerenders.

### AddExerciseSheet catalog performance
- Kept debounced search and fixed filtering to depend on debounced query.
- Added pre-indexed lowercase fields to reduce repeated string processing.
- Added incremental rendering window (`visibleCount` + load more) as virtualization-ready strategy for large lists.

### Active workout rendering cost
- Removed duplicate delete-confirm modal mount.
- Switched heavy modals to conditional mount-on-open to reduce initial render and idle memory pressure.

### Route-level / analytics
- Lazy-loaded OneRM calculator with `React.lazy` + `Suspense`.
- Confirmed separate calculator chunk in production build (not included in initial analytics route payload).

## 3. Impact ranking

1. High: ActiveWorkout rerender isolation around timer/sync updates.
2. High: DnD list memoization and callback stabilization.
3. Medium: AddExerciseSheet large-catalog filtering/render strategy.
4. Medium: Conditional modal mounting and duplicate modal removal.
5. Medium: Analytics calculator lazy-loading.

## 4. Expected effect on mobile

- Smoother interaction on active workout screens during rest-timer activity.
- Lower chance of frame drops while reordering/editing exercise lists.
- Faster perceived response in add-exercise flow for large catalogs.
- Reduced initial route work for analytics (calculator loaded only on demand).
- Slightly lower memory/CPU pressure due to fewer mounted hidden modals.

## 5. Validation status

- Type check: passed (`npm run typecheck`).
- Production build: passed (`npm run build`).
- Targeted lint on changed files: passed (0 new warnings/errors).
