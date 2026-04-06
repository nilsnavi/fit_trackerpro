import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_INCREMENT_BASE = 1.25
const QUICK_INCREMENTS_STORAGE_VERSION = 2

interface WorkoutQuickIncrementsPersistedV1 {
    incrementBaseByScope?: Record<string, unknown>
}

interface WorkoutQuickIncrementsState {
    incrementBaseByScope: Record<string, number>
    getIncrementBase: (scopeKey: string) => number
    setIncrementBase: (scopeKey: string, base: number) => void
}

function normalizeBase(base: number): number {
    const rounded = Number(base.toFixed(2))
    if (!Number.isFinite(rounded)) return DEFAULT_INCREMENT_BASE
    return Math.max(0.25, Math.min(10, rounded))
}

function normalizePersistedMap(rawMap: Record<string, unknown> | undefined): Record<string, number> {
    if (!rawMap) return {}

    const entries = Object.entries(rawMap)
        .filter(([scopeKey]) => typeof scopeKey === 'string' && scopeKey.trim().length > 0)
        .map(([scopeKey, rawValue]) => [scopeKey, normalizeBase(Number(rawValue))] as const)

    return Object.fromEntries(entries)
}

function migratePersistedState(
    persistedState: unknown,
    version: number,
): Pick<WorkoutQuickIncrementsState, 'incrementBaseByScope'> {
    const legacy = (persistedState ?? {}) as WorkoutQuickIncrementsPersistedV1

    if (version < QUICK_INCREMENTS_STORAGE_VERSION) {
        return {
            incrementBaseByScope: normalizePersistedMap(legacy.incrementBaseByScope),
        }
    }

    return {
        incrementBaseByScope: normalizePersistedMap(legacy.incrementBaseByScope),
    }
}

export const useWorkoutQuickIncrementsStore = create<WorkoutQuickIncrementsState>()(
    persist(
        (set, get) => ({
            incrementBaseByScope: {},
            getIncrementBase: (scopeKey) => get().incrementBaseByScope[scopeKey] ?? DEFAULT_INCREMENT_BASE,
            setIncrementBase: (scopeKey, base) =>
                set((state) => ({
                    incrementBaseByScope: {
                        ...state.incrementBaseByScope,
                        [scopeKey]: normalizeBase(base),
                    },
                })),
        }),
        {
            name: 'workout-quick-increments',
            version: QUICK_INCREMENTS_STORAGE_VERSION,
            migrate: migratePersistedState,
        },
    ),
)
