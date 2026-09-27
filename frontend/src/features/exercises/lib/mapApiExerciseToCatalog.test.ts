import { mapApiExerciseToCatalog } from './mapApiExerciseToCatalog'
import type { ExerciseApiItem } from '@features/exercises/types/exerciseApi'

function apiExercise(overrides: Partial<ExerciseApiItem> = {}): ExerciseApiItem {
    return {
        id: 10,
        name: 'Жим штанги лёжа',
        description: 'Лягте на скамью.\nОпустите штангу к груди.\nВыжмите штангу вверх.',
        category: 'strength',
        equipment: ['barbell'],
        muscle_group: 'chest',
        muscle_groups: ['chest', 'triceps'],
        aliases: ['barbell bench press'],
        risk_flags: {
            high_blood_pressure: false,
            diabetes: false,
            joint_problems: false,
            back_problems: false,
            heart_conditions: false,
        },
        media_url: null,
        status: 'active',
        author_user_id: null,
        created_at: '2026-09-24T00:00:00Z',
        updated_at: '2026-09-24T00:00:00Z',
        ...overrides,
    }
}

describe('mapApiExerciseToCatalog', () => {
    it('maps GIF media and Russian description lines to catalog instructions', () => {
        const exercise = mapApiExerciseToCatalog(
            apiExercise({
                media_url: '/exercise-media/0025-demo.gif',
                attribution: '© Gym visual — https://gymvisual.com/',
            }),
        )

        expect(exercise.gifUrl).toBe('/exercise-media/0025-demo.gif')
        expect(exercise.imageUrl).toBeUndefined()
        expect(exercise.instructions).toEqual([
            'Лягте на скамью.',
            'Опустите штангу к груди.',
            'Выжмите штангу вверх.',
        ])
        expect(exercise.aliases).toEqual(['barbell bench press'])
        expect(exercise.attribution).toContain('Gym visual')
    })

    it('keeps a null-media exercise renderable with a Russian placeholder description', () => {
        const exercise = mapApiExerciseToCatalog(
            apiExercise({ description: '', media_url: null }),
        )

        expect(exercise.gifUrl).toBeUndefined()
        expect(exercise.imageUrl).toBeUndefined()
        expect(exercise.videoUrl).toBeUndefined()
        expect(exercise.description).toBe('Описание пока не заполнено.')
        expect(exercise.instructions).toEqual(['Описание уточняется.'])
    })
})
