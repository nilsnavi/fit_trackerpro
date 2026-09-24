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

// Smart Settings Store
export {
    useWorkoutSmartSettingsStore,
    useGhostMode,
    useSmartRest,
    useAutoStartRest,
    useOneTapLogging,
    useHapticIntensity,
    useShowFeatureHints,
} from './workoutSmartSettingsStore'
export type { HapticIntensity, WorkoutSmartSettings } from './workoutSmartSettingsStore'
