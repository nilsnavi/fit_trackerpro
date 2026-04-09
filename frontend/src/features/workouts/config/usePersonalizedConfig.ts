import { useMemo } from 'react'
import { useProfile } from '@features/profile/hooks/useProfile'
import { getAdaptivePresets } from './adaptivePresets'
import type { WorkoutTypeConfig } from '../types/workoutTypeConfig'

/**
 * Returns a `WorkoutTypeConfig` with presets adapted to the user's
 * fitness goal and experience level. Falls back to the original
 * config when no adaptive override exists.
 */
export function usePersonalizedConfig(config: WorkoutTypeConfig): WorkoutTypeConfig {
    const { profile } = useProfile()
    const fitnessGoal = profile?.profile?.fitness_goal
    const experienceLevel = profile?.profile?.experience_level

    return useMemo(() => {
        const presets = getAdaptivePresets(config.mode, fitnessGoal, experienceLevel)
        if (!presets) return config
        return { ...config, presets }
    }, [config, fitnessGoal, experienceLevel])
}
