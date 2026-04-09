import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useProfile } from '@features/profile/hooks/useProfile'
import { useWorkoutTemplatesQuery } from '@features/workouts/hooks/useWorkoutTemplatesQuery'
import { useCreateWorkoutTemplateMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { exercisesApi } from '@shared/api/domains/exercisesApi'
import { getGoalPrograms } from '../config/goalProgramCatalog'
import type { ProgramPreset } from '../config/goalProgramCatalog'
import type { ExerciseInTemplate } from '../types/workouts'

export function useGoalPrograms() {
    const { profile } = useProfile()
    const fitnessGoal = profile?.profile?.fitness_goal
    const { data: templatesData } = useWorkoutTemplatesQuery()
    const createMutation = useCreateWorkoutTemplateMutation()
    const queryClient = useQueryClient()
    const [adoptingId, setAdoptingId] = useState<string | null>(null)

    const programs = useMemo(
        () => (fitnessGoal ? getGoalPrograms(fitnessGoal) : []),
        [fitnessGoal],
    )

    const adoptedNames = useMemo(() => {
        const names = new Set<string>()
        for (const t of templatesData?.items ?? []) {
            names.add(t.name)
        }
        return names
    }, [templatesData?.items])

    const adoptProgram = useCallback(
        async (preset: ProgramPreset) => {
            if (adoptedNames.has(preset.name)) return
            setAdoptingId(preset.id)
            try {
                const slugs = preset.exercises.map((e) => e.slug)
                const slugToId = await exercisesApi.getBySlugs(slugs)

                const exercises: ExerciseInTemplate[] = preset.exercises
                    .filter((e) => slugToId[e.slug] != null)
                    .map((e) => ({
                        exercise_id: slugToId[e.slug],
                        name: e.name,
                        sets: e.sets,
                        reps: e.reps,
                        duration: e.duration,
                        rest_seconds: e.rest_seconds,
                    }))

                if (exercises.length === 0) return

                await createMutation.mutateAsync({
                    name: preset.name,
                    type: preset.workoutType,
                    exercises,
                    is_public: false,
                })

                await queryClient.invalidateQueries({ queryKey: ['workouts'] })
            } finally {
                setAdoptingId(null)
            }
        },
        [adoptedNames, createMutation, queryClient],
    )

    return {
        programs,
        adoptedNames,
        isAdopting: adoptingId !== null,
        adoptingId,
        adoptProgram,
        fitnessGoal,
    }
}
