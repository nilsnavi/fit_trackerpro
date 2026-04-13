/**
 * Клиентское состояние (Zustand).
 *
 * useUiStore и useSessionStore — зарезервированы; экраны их не импортируют (подключение
 * только после явного рефакторинга). Серверные данные — TanStack Query (state/queryHooks, state/server).
 *
 * useWorkoutDraftStore — конструктор тренировки (персист).
 * useWorkoutSessionDraftStore — черновик сессии и useWorkoutSessionDraftCloudSync.
 */
export { useSessionStore } from '../stores/sessionStore'
export { useUiStore } from '../stores/uiStore'
export type { AnalyticsRange } from '../stores/uiStore'
export { useWorkoutDraftStore } from '../stores/workoutDraftStore'
export { useWorkoutSessionDraftStore } from '../stores/workoutSessionDraftStore'
export { useWorkoutTemplatePinsStore } from '../stores/workoutTemplatePinsStore'
export { useWorkoutRestPresetsStore } from '../stores/workoutRestPresetsStore'
export { useWorkoutQuickIncrementsStore } from '../stores/workoutQuickIncrementsStore'
export { useActiveWorkoutStore } from '../stores/activeWorkoutStore'
export type { ActiveWorkoutSyncState, ActiveWorkoutRestTimerState } from '../stores/activeWorkoutStore'
export {
    useActiveWorkoutStateSlice,
    useActiveWorkoutActions,
} from '../stores/activeWorkoutStore'
export { useWorkoutSessionUiStore } from '../stores/workoutSessionUiStore'
