import type { Exercise } from '@shared/types'
import type { CompletedExercise } from '@features/workouts/types/workouts'

/**
 * Дорожка: каталог cardio + оборудование treadmill, либо эвристика по названию.
 */
export function isTreadmillExercise(exercise: CompletedExercise, catalog?: Exercise | null): boolean {
    if (catalog) {
        return catalog.category === 'cardio' && catalog.equipment.includes('treadmill')
    }
    const n = exercise.name.toLowerCase()
    return (
        n.includes('treadmill') ||
        n.includes('дорожк') ||
        n.includes('бегов') ||
        n.includes('беговая')
    )
}
