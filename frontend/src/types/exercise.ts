/**
 * Canonical exercise shapes for the exercise catalog API (`GET /api/v1/exercises`).
 */

export interface Exercise {
    id: number
    name: string
    category: string
    muscle_group: string | null
    equipment: string[]
    description: string | null
}

/** Minimal list payload shape (pagination fields may still be present on the wire). */
export interface ExercisesResponse {
    items: Exercise[]
    total: number
}
