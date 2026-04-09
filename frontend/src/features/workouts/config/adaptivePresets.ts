import type { WorkoutPreset } from '../types/workoutTypeConfig'
import type { WorkoutMode } from './workoutTypeConfigs'

type FitnessGoal = 'strength' | 'weight_loss' | 'endurance'
type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

function p(id: string, label: string, value: number, unit: 'minutes' | 'rounds'): WorkoutPreset {
    return { id, label, value, unit }
}

const min = (id: string, v: number) => p(id, `${v} мин`, v, 'minutes')
const rnd = (id: string, v: number) => {
    const word = v === 1 ? 'подход' : v < 5 ? 'подхода' : 'подходов'
    return p(id, `${v} ${word}`, v, 'rounds')
}

/**
 * Adaptive presets: mode × goal × experience → preset overrides.
 * If a combination is missing, the caller falls back to the static config.presets.
 */
const ADAPTIVE_PRESETS: Record<
    string,
    Partial<Record<FitnessGoal, Partial<Record<ExperienceLevel, WorkoutPreset[]>>>>
> = {
    cardio: {
        strength: {
            beginner:     [min('c-s-b-15', 15), min('c-s-b-20', 20), min('c-s-b-30', 30)],
            intermediate: [min('c-s-i-20', 20), min('c-s-i-30', 30), min('c-s-i-40', 40)],
            // advanced: falls back to default 20/30/45
        },
        weight_loss: {
            beginner:     [min('c-wl-b-15', 15), min('c-wl-b-20', 20), min('c-wl-b-30', 30)],
            intermediate: [min('c-wl-i-25', 25), min('c-wl-i-35', 35), min('c-wl-i-45', 45)],
            advanced:     [min('c-wl-a-30', 30), min('c-wl-a-40', 40), min('c-wl-a-50', 50)],
        },
        endurance: {
            beginner:     [min('c-e-b-20', 20), min('c-e-b-30', 30), min('c-e-b-40', 40)],
            intermediate: [min('c-e-i-30', 30), min('c-e-i-40', 40), min('c-e-i-50', 50)],
            advanced:     [min('c-e-a-30', 30), min('c-e-a-45', 45), min('c-e-a-60', 60)],
        },
    },
    strength: {
        strength: {
            beginner:     [rnd('s-s-b-2', 2), rnd('s-s-b-3', 3), rnd('s-s-b-4', 4)],
            // intermediate: default 3/4/5
            advanced:     [rnd('s-s-a-4', 4), rnd('s-s-a-5', 5), rnd('s-s-a-6', 6)],
        },
        weight_loss: {
            beginner:     [rnd('s-wl-b-2', 2), rnd('s-wl-b-3', 3), rnd('s-wl-b-4', 4)],
            // intermediate & advanced: default 3/4/5
        },
        endurance: {
            // beginner & intermediate: default 3/4/5
            advanced:     [rnd('s-e-a-4', 4), rnd('s-e-a-5', 5), rnd('s-e-a-6', 6)],
        },
    },
    functional: {
        weight_loss: {
            beginner:     [rnd('f-wl-b-3', 3), rnd('f-wl-b-4', 4), rnd('f-wl-b-5', 5)],
            intermediate: [rnd('f-wl-i-4', 4), rnd('f-wl-i-5', 5), rnd('f-wl-i-6', 6)],
            advanced:     [rnd('f-wl-a-5', 5), rnd('f-wl-a-7', 7), rnd('f-wl-a-9', 9)],
        },
        strength: {
            // beginner & intermediate: default 3/5/7
            advanced:     [rnd('f-s-a-5', 5), rnd('f-s-a-7', 7), rnd('f-s-a-9', 9)],
        },
        endurance: {
            // beginner: default 3/5/7
            intermediate: [rnd('f-e-i-5', 5), rnd('f-e-i-7', 7), rnd('f-e-i-9', 9)],
            advanced:     [rnd('f-e-a-5', 5), rnd('f-e-a-7', 7), rnd('f-e-a-10', 10)],
        },
    },
    yoga: {
        strength: {
            beginner:     [min('y-s-b-10', 10), min('y-s-b-15', 15), min('y-s-b-20', 20)],
            advanced:     [min('y-s-a-20', 20), min('y-s-a-30', 30), min('y-s-a-45', 45)],
        },
        weight_loss: {
            beginner:     [min('y-wl-b-10', 10), min('y-wl-b-15', 15), min('y-wl-b-20', 20)],
            advanced:     [min('y-wl-a-20', 20), min('y-wl-a-30', 30), min('y-wl-a-45', 45)],
        },
        endurance: {
            beginner:     [min('y-e-b-10', 10), min('y-e-b-15', 15), min('y-e-b-20', 20)],
            advanced:     [min('y-e-a-20', 20), min('y-e-a-30', 30), min('y-e-a-45', 45)],
        },
    },
}

/**
 * Resolve adaptive presets for a given mode, fitness goal, and experience level.
 * Returns `null` when there is no override — the caller should fall back to `config.presets`.
 */
export function getAdaptivePresets(
    mode: WorkoutMode | string | undefined,
    fitnessGoal?: FitnessGoal | string,
    experienceLevel?: ExperienceLevel | string,
): WorkoutPreset[] | null {
    if (!mode || !fitnessGoal) return null
    const modeEntry = ADAPTIVE_PRESETS[mode]
    if (!modeEntry) return null
    const goalEntry = modeEntry[fitnessGoal as FitnessGoal]
    if (!goalEntry) return null
    const level = (experienceLevel || 'intermediate') as ExperienceLevel
    return goalEntry[level] ?? null
}
