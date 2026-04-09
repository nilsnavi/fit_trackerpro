import { useMemo } from 'react'
import { useExercisesCatalogQuery } from '@features/exercises/hooks/useExercisesCatalogQuery'

export interface OneRMExercise {
    id: number
    name: string
    category: string
}

export function useOneRMExercises() {
    const { data: exercises = [], isLoading, isError } = useExercisesCatalogQuery()

    const mapped = useMemo(
        () =>
            exercises.map(
                (e): OneRMExercise => ({ id: e.id, name: e.name, category: e.category }),
            ),
        [exercises],
    )

    return { exercises: mapped, isLoading, isError }
}
