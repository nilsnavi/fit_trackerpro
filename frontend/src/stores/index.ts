/**
 * Обратная совместимость: предпочтительно импортировать из @/state/local или @/state.
 */
export {
    useActiveWorkoutStore,
    useSessionStore,
    useUiStore,
    useWorkoutDraftStore,
    useWorkoutQuickIncrementsStore,
    useWorkoutRestPresetsStore,
    useWorkoutSessionDraftStore,
} from '../state/local'
export type { AnalyticsRange } from '../state/local'
