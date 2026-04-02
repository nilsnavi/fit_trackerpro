import {
    buildTemplateExercises,
    mapTemplateExercisesToBlocks,
} from '@features/workouts/lib/templateMappers'
import type { ExerciseInTemplate } from '@features/workouts/types/workouts'

describe('templateMappers', () => {
    test('preserves exercises structure on round trip for edit mode', () => {
        const source: ExerciseInTemplate[] = [
            {
                exercise_id: 101,
                name: 'Жим лёжа',
                sets: 4,
                reps: 8,
                rest_seconds: 120,
                weight: 80,
                notes: 'Контролировать технику',
            },
            {
                exercise_id: 202,
                name: 'Бег на дорожке',
                sets: 1,
                duration: 15 * 60,
                rest_seconds: 0,
                notes: 'Пульс 140-150',
            },
        ]

        const blocks = mapTemplateExercisesToBlocks(source)
        const mappedBack = buildTemplateExercises(blocks)

        expect(mappedBack).toHaveLength(source.length)

        expect(mappedBack[0]).toMatchObject({
            exercise_id: 101,
            name: 'Жим лёжа',
            sets: 4,
            reps: 8,
            rest_seconds: 120,
            weight: 80,
            notes: 'Контролировать технику',
        })

        expect(mappedBack[1]).toMatchObject({
            exercise_id: 202,
            name: 'Бег на дорожке',
            sets: 1,
            duration: 15 * 60,
            rest_seconds: 0,
            notes: 'Пульс 140-150',
        })
    })

    test('does not lose short cardio duration when converting to builder block', () => {
        const source: ExerciseInTemplate[] = [
            {
                exercise_id: 303,
                name: 'Спринт',
                sets: 1,
                duration: 20,
                rest_seconds: 10,
            },
        ]

        const blocks = mapTemplateExercisesToBlocks(source)

        expect(blocks[0].type).toBe('cardio')
        expect(blocks[0].config?.duration).toBe(1)
    })

    test('keeps original order and notes after edit-mode round trip', () => {
        const source: ExerciseInTemplate[] = [
            {
                exercise_id: 11,
                name: 'Тяга верхнего блока',
                sets: 3,
                reps: 12,
                rest_seconds: 90,
                notes: 'Локти вниз',
            },
            {
                exercise_id: 12,
                name: 'Планка',
                sets: 2,
                duration: 90,
                rest_seconds: 30,
                notes: 'Держать корпус ровно',
            },
            {
                exercise_id: 13,
                name: 'Отжимания',
                sets: 4,
                reps: 15,
                rest_seconds: 60,
                notes: 'Полная амплитуда',
            },
        ]

        const blocks = mapTemplateExercisesToBlocks(source)

        expect(blocks.map((b) => b.order)).toEqual([0, 1, 2])
        expect(blocks.map((b) => b.exercise?.name)).toEqual(source.map((e) => e.name))
        expect(blocks.map((b) => b.config?.note)).toEqual(source.map((e) => e.notes))

        const mappedBack = buildTemplateExercises(blocks)

        expect(mappedBack.map((e) => e.exercise_id)).toEqual(source.map((e) => e.exercise_id))
        expect(mappedBack.map((e) => e.name)).toEqual(source.map((e) => e.name))
        expect(mappedBack.map((e) => e.notes)).toEqual(source.map((e) => e.notes))
    })
})
