# Dead code reachability report

Generated: 2026-09-30T18:35:08.093Z
Total files: 493, reachable: 398, unreachable: 95 (prod: 0, test-infra: 95)

## Unreachable prod modules

_None. All production modules are reachable from entry points._

## Unreachable test infrastructure (informational, not gated)

- `app/components/__tests__/ConnectivitySyncBar.test.tsx`
- `app/components/__tests__/SyncStatusToastBridge.test.tsx`
- `app/providers/__tests__/HealthCheckGate.test.tsx`
- `app/__tests__/AppRoot.test.tsx`
- `features/analytics/api/__tests__/analyticsDomain.test.ts`
- `features/analytics/components/exercise-progress/ExerciseMetrics.test.tsx`
- `features/analytics/components/__tests__/LoadTables.test.tsx`
- `features/analytics/components/__tests__/MuscleSignalsCard.test.tsx`
- `features/analytics/hooks/__tests__/useLoadTables.test.tsx`
- `features/coach/api/coachApi.test.ts`
- `features/coach/hooks/useCoachQueries.test.tsx`
- `features/coach/pages/CoachPages.test.tsx`
- `features/emergency/components/__tests__/EmergencyButton.test.tsx`
- `features/emergency/components/__tests__/EmergencyContactsSection.test.tsx`
- `features/emergency/lib/__tests__/contactForm.test.ts`
- `features/exercises/components/__tests__/ExerciseModerationSection.test.tsx`
- `features/exercises/hooks/__tests__/useExerciseMutations.test.tsx`
- `features/exercises/lib/mapApiExerciseToCatalog.test.ts`
- `features/health/components/__tests__/BodyMeasurementsCard.test.tsx`
- `features/health/lib/__tests__/bodyMeasurementSeries.test.ts`
- `features/health/pages/__tests__/HealthPage.test.tsx`
- `features/home/components/__tests__/HomeHealthSection.test.tsx`
- `features/home/hooks/__tests__/useHomeHealthWidgets.test.tsx`
- `features/home/lib/__tests__/mapHealthToDashboard.test.ts`
- `features/profile/components/__tests__/DeleteAccountSection.test.tsx`
- `features/workouts/active/components/ProgressionPrefillNotice.test.tsx`
- `features/workouts/active/components/ProgressionRecommendationCard.test.tsx`
- `features/workouts/active/components/WorkoutSyncQueueStatus.test.tsx`
- `features/workouts/active/hooks/__tests__/useActiveWorkoutCatalogSuggestions.test.ts`
- `features/workouts/active/hooks/__tests__/useActiveWorkoutCompletion.test.tsx`
- `features/workouts/active/hooks/__tests__/useActiveWorkoutRestFlow.test.tsx`
- `features/workouts/active/hooks/__tests__/useActiveWorkoutSync.offline.test.tsx`
- `features/workouts/active/hooks/__tests__/useActiveWorkoutSync.test.tsx`
- `features/workouts/active/hooks/__tests__/useProgressionRecommendation.test.tsx`
- `features/workouts/active/hooks/__tests__/useWorkoutSetWrites.test.tsx`
- `features/workouts/active/lib/__tests__/activeWorkoutUtils.sets.test.ts`
- `features/workouts/active/lib/__tests__/plateCalculator.test.ts`
- `features/workouts/active/lib/__tests__/previousResult.test.ts`
- `features/workouts/active/lib/__tests__/supersetGrouping.test.ts`
- `features/workouts/history/components/WorkoutHistoryCard.test.tsx`
- `features/workouts/hooks/__tests__/useCompleteWorkoutMutation.offline.test.tsx`
- `features/workouts/hooks/__tests__/useWorkoutCalendarQuery.test.tsx`
- `features/workouts/hooks/__tests__/useWorkoutSessionStarter.test.tsx`
- `features/workouts/lib/__tests__/progressionBulkDraft.test.ts`
- `features/workouts/lib/__tests__/progressionBulkOutcome.test.ts`
- `features/workouts/lib/__tests__/progressionTargetDraft.test.ts`
- `features/workouts/lib/__tests__/templateMappers.test.ts`
- `features/workouts/lib/__tests__/workoutModeEditorMappers.test.ts`
- `features/workouts/pages/__tests__/ProgressionTargetsPage.test.tsx`
- `features/workouts/pages/__tests__/WorkoutSummaryPage.accept.test.tsx`
- `features/workouts/workoutMode/hooks/__tests__/useWorkoutModeHandlers.test.tsx`
- `features/workouts/__tests__/noPlaceholderTodos.test.ts`
- `features/workouts/__tests__/workoutsRelativeRedirects.test.tsx`
- `hooks/__tests__/useOnboardingSubmit.test.tsx`
- `hooks/__tests__/useTelegramAuthExchange.test.tsx`
- `shared/api/domains/__tests__/usersApi.test.ts`
- `shared/api/generated/openapi.d.ts`
- `shared/api/__tests__/client.coach-token-safety.test.ts`
- `shared/api/__tests__/client.terminated.test.ts`
- `shared/config/__tests__/readinessUrl.test.ts`
- `shared/errors/parseFastApiDetail.test.ts`
- `shared/errors/__tests__/normalizeError.test.ts`
- `shared/hooks/__tests__/useBackendHealth.test.tsx`
- `shared/hooks/__tests__/useSyncQueue.test.tsx`
- `shared/lib/__tests__/chartTheme.test.ts`
- `shared/lib/__tests__/saveBlobAsFile.test.ts`
- `shared/lib/__tests__/telegramEnv.test.ts`
- `shared/lib/__tests__/wipeLocalUserData.test.ts`
- `shared/offline/syncQueue/__tests__/engine.offline.test.ts`
- `shared/offline/syncQueue/__tests__/engine.test.ts`
- `shared/offline/syncQueue/__tests__/executeWorkoutSyncOp.test.ts`
- `shared/offline/__tests__/offlineQueryPersist.idb.test.ts`
- `shared/offline/__tests__/offlineQueue.test.ts`
- `shared/offline/__tests__/workoutOfflineEnqueue.test.ts`
- `shared/ui/__tests__/RouteErrorBoundary.test.tsx`
- `stores/__tests__/activeWorkoutStore.test.ts`
- `stores/__tests__/workoutSessionUiStore.test.ts`
- `types/telegram.d.ts`
- `vite-env.d.ts`
- `__mocks__/jest.globals.ts`
- `__mocks__/shared-config-runtime.ts`
- `__mocks__/virtual-pwa-register-react.ts`
- `__tests__/architecture/eslintNetworkBoundary.test.ts`
- `__tests__/architecture/networkBoundary.test.ts`
- `__tests__/auth/authFlow.test.tsx`
- `__tests__/auth/authStore.test.ts`
- `__tests__/auth/routeGuard.test.tsx`
- `__tests__/auth/TelegramAuthBootstrapGate.test.tsx`
- `__tests__/components/Button.test.tsx`
- `__tests__/onboardingConsent.test.tsx`
- `__tests__/shared/useWorkoutSessionDraftCloudSync.test.ts`
- `__tests__/smoke/routing.smoke.test.tsx`
- `__tests__/TelegramAuthGate.test.tsx`
- `__tests__/workouts/WorkoutDetailPage.test.tsx`
- `__tests__/workouts/WorkoutsPage.test.tsx`
