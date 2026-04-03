import { useState } from 'react'
import { parseOptionalNumber } from '@features/workouts/lib/workoutDetailFormatters'
import type { CompletedExercise, WorkoutHistoryItem } from '@features/workouts/types/workouts'

export type StructureEditorState = {
    exerciseIndex: number
    sets: string
    reps: string
    weight: string
    duration: string
} | null

interface UseWorkoutStructureEditorParams {
    exercises: CompletedExercise[]
    patchItem: (recipe: (prev: WorkoutHistoryItem) => WorkoutHistoryItem) => void
}

export function useWorkoutStructureEditor({ exercises, patchItem }: UseWorkoutStructureEditorParams) {
    const [structureEditor, setStructureEditor] = useState<StructureEditorState>(null)

    const openStructureEditor = (exerciseIndex: number) => {
        const exercise = exercises[exerciseIndex]
        if (!exercise) return
        const firstSet = exercise.sets_completed[0]

        setStructureEditor({
            exerciseIndex,
            sets: String(Math.max(1, exercise.sets_completed.length)),
            reps: firstSet?.reps != null ? String(firstSet.reps) : '',
            weight: firstSet?.weight != null ? String(firstSet.weight) : '',
            duration: firstSet?.duration != null ? String(firstSet.duration) : '',
        })
    }

    const closeStructureEditor = () => {
        setStructureEditor(null)
    }

    const handleSaveStructure = () => {
        if (!structureEditor) return
        const exercise = exercises[structureEditor.exerciseIndex]
        if (!exercise) return

        const setCount = Math.max(1, Number.parseInt(structureEditor.sets, 10) || 1)
        const reps = parseOptionalNumber(structureEditor.reps)
        const weight = parseOptionalNumber(structureEditor.weight)
        const duration = parseOptionalNumber(structureEditor.duration)

        patchItem((prev) => ({
            ...prev,
            exercises: prev.exercises.map((item: CompletedExercise, index: number) => {
                if (index !== structureEditor.exerciseIndex) return item
                return {
                    ...item,
                    sets_completed: Array.from({ length: setCount }, (_, setIndex) => {
                        const existingSet = item.sets_completed[setIndex]
                        return {
                            set_number: setIndex + 1,
                            completed: existingSet?.completed ?? false,
                            reps,
                            weight,
                            duration,
                            rpe: existingSet?.rpe,
                            rir: existingSet?.rir,
                            distance: existingSet?.distance,
                        }
                    }),
                }
            }),
        }))

        closeStructureEditor()
    }

    return {
        structureEditor,
        setStructureEditor,
        openStructureEditor,
        closeStructureEditor,
        handleSaveStructure,
    }
}
