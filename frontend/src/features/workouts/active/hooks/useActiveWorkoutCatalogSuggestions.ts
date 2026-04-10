import { useMemo } from 'react'
import type { Exercise as CatalogExercise } from '@features/exercises/types/catalogUi'
import type { WorkoutHistoryItem } from '@features/workouts/types/workouts'

export type ExerciseCatalogFilter = 'all' | 'strength' | 'cardio' | 'flexibility'

export interface UseActiveWorkoutCatalogSuggestionsParams {
    catalogExercises: CatalogExercise[]
    historyItems: WorkoutHistoryItem[] | undefined
    workoutTitle: string
    filter: ExerciseCatalogFilter
    query: string
}

export interface UseActiveWorkoutCatalogSuggestionsResult {
    filteredCatalogExercises: CatalogExercise[]
    favoriteCatalogExercises: CatalogExercise[]
    recentCatalogExercises: CatalogExercise[]
    suggestedCatalogExercises: CatalogExercise[]
}

export function getPreferredCategoriesFromTitle(titleLower: string): Array<'strength' | 'cardio' | 'flexibility'> {
    if (titleLower.includes('кардио')) return ['cardio']
    if (titleLower.includes('йога') || titleLower.includes('мобил')) return ['flexibility']
    if (titleLower.includes('функц')) return ['strength', 'cardio']
    return ['strength']
}

export function useActiveWorkoutCatalogSuggestions({
    catalogExercises,
    historyItems,
    workoutTitle,
    filter,
    query,
}: UseActiveWorkoutCatalogSuggestionsParams): UseActiveWorkoutCatalogSuggestionsResult {
    const filteredCatalogExercises = useMemo(() => {
        const q = query.trim().toLowerCase()
        return catalogExercises.filter((exercise) => {
            const matchesCategory = filter === 'all' || exercise.category === filter
            if (!matchesCategory) return false
            if (!q) return true
            return (
                exercise.name.toLowerCase().includes(q) ||
                exercise.primaryMuscles.some((muscle) => muscle.toLowerCase().includes(q)) ||
                exercise.secondaryMuscles.some((muscle) => muscle.toLowerCase().includes(q))
            )
        })
    }, [catalogExercises, filter, query])

    const favoriteCatalogExercises = useMemo(() => {
        const counts = new Map<string, number>()
        for (const item of historyItems ?? []) {
            for (const exercise of item.exercises) {
                const key = exercise.name.trim().toLowerCase()
                if (!key) continue
                counts.set(key, (counts.get(key) ?? 0) + 1)
            }
        }

        return [...catalogExercises]
            .sort((a, b) => (
                (counts.get(b.name.trim().toLowerCase()) ?? 0) - (counts.get(a.name.trim().toLowerCase()) ?? 0)
            ))
            .filter((exercise) => (counts.get(exercise.name.trim().toLowerCase()) ?? 0) > 1)
            .slice(0, 6)
    }, [catalogExercises, historyItems])

    const recentCatalogExercises = useMemo(() => {
        const recentNames = new Set<string>()
        const items = historyItems ?? []

        for (const item of items.slice(0, 5)) {
            for (const exercise of item.exercises) {
                if (recentNames.size >= 8) break
                const key = exercise.name.trim().toLowerCase()
                if (key) recentNames.add(key)
            }
        }

        if (recentNames.size === 0) return [] as CatalogExercise[]

        return catalogExercises
            .filter((exercise) => recentNames.has(exercise.name.trim().toLowerCase()))
            .slice(0, 6)
    }, [catalogExercises, historyItems])

    const suggestedCatalogExercises = useMemo(() => {
        const titleLower = workoutTitle.toLowerCase()
        const preferredCategories = getPreferredCategoriesFromTitle(titleLower)

        return catalogExercises
            .filter((exercise) =>
                preferredCategories.includes((exercise.category as 'strength' | 'cardio' | 'flexibility') ?? 'strength'),
            )
            .slice(0, 6)
    }, [catalogExercises, workoutTitle])

    return {
        filteredCatalogExercises,
        favoriteCatalogExercises,
        recentCatalogExercises,
        suggestedCatalogExercises,
    }
}

