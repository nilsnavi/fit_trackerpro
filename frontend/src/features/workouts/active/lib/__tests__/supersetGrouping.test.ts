import {
    groupExerciseWithNext,
    supersetSlots,
    ungroupExercise,
} from '../supersetGrouping'
import type {
    CompletedExercise,
    WorkoutBlockPayload,
    WorkoutHistoryItem,
} from '@features/workouts/types/workouts'

function exercise(name: string, blockId?: number | string | null): CompletedExercise {
    return {
        exercise_id: name.length,
        name,
        sets_completed: [{ set_number: 1, set_type: 'working', reps: 10, weight: 50, completed: true }],
        block_id: blockId ?? null,
    }
}

function workout(
    exercises: CompletedExercise[],
    blocks?: WorkoutBlockPayload[],
): WorkoutHistoryItem {
    return {
        id: 1,
        date: '2026-09-14',
        exercises,
        tags: [],
        created_at: '2026-09-14T10:00:00.000Z',
        blocks,
    }
}

describe('supersetGrouping (SPEC-005 §21)', () => {
    it('groups an exercise with the next one into a SUPERSET block', () => {
        const result = groupExerciseWithNext(workout([exercise('A'), exercise('B')]), 0)

        expect(result.blocks).toHaveLength(1)
        expect(result.blocks?.[0].type).toBe('SUPERSET')
        expect(result.blocks?.[0].client_id).toBe('superset-1')
        expect(result.exercises[0].block_id).toBe(result.blocks?.[0].client_id)
        expect(result.exercises[1].block_id).toBe(result.blocks?.[0].client_id)
    })

    it('labels block members as A1/A2 with a single header on the first member', () => {
        const result = groupExerciseWithNext(workout([exercise('A'), exercise('B')]), 0)
        const slots = supersetSlots(result)

        expect(slots[0]).toEqual({ header: 'SUPERSET A', label: 'A1' })
        expect(slots[1]).toEqual({ header: null, label: 'A2' })
    })

    it('does nothing when the exercise has no next one', () => {
        const source = workout([exercise('A')])
        expect(groupExerciseWithNext(source, 0)).toBe(source)
        expect(groupExerciseWithNext(source, 5)).toBe(source)
    })

    it('is idempotent when both exercises already share a block', () => {
        const grouped = groupExerciseWithNext(workout([exercise('A'), exercise('B')]), 0)
        expect(groupExerciseWithNext(grouped, 0)).toBe(grouped)
    })

    it('extends the current block instead of creating a second one', () => {
        const three = workout([exercise('A'), exercise('B'), exercise('C')])
        const pair = groupExerciseWithNext(three, 0)
        const triset = groupExerciseWithNext(pair, 1)

        expect(triset.blocks).toHaveLength(1)
        expect(triset.blocks?.[0].client_id).toBe('superset-1')
        expect(supersetSlots(triset).map((slot) => slot.label)).toEqual(['A1', 'A2', 'A3'])
    })

    it('detaches the next exercise from its own block and dissolves the lone leftover', () => {
        const four = workout([exercise('A'), exercise('B'), exercise('C'), exercise('D')])
        const first = groupExerciseWithNext(four, 0) // A + B
        const second = groupExerciseWithNext(first, 2) // C + D
        expect(second.blocks).toHaveLength(2)

        const bridged = groupExerciseWithNext(second, 1) // B + C

        expect(bridged.blocks).toHaveLength(1)
        expect(bridged.blocks?.[0].client_id).toBe(second.blocks?.[0].client_id)
        expect(supersetSlots(bridged).map((slot) => slot.label)).toEqual(['A1', 'A2', 'A3', null])
        // D was left alone in its old block, so its reference was released.
        expect(bridged.exercises[3].block_id).toBeNull()
    })

    it('dissolves the block when ungrouping leaves a single member', () => {
        const grouped = groupExerciseWithNext(workout([exercise('A'), exercise('B')]), 0)
        const ungrouped = ungroupExercise(grouped, 0)

        expect(ungrouped.blocks).toEqual([])
        expect(ungrouped.exercises[0].block_id).toBeNull()
        expect(ungrouped.exercises[1].block_id).toBeNull()
    })

    it('keeps the block while two members remain after ungrouping', () => {
        const three = workout([exercise('A'), exercise('B'), exercise('C')])
        const triset = groupExerciseWithNext(groupExerciseWithNext(three, 0), 1)
        const ungrouped = ungroupExercise(triset, 0)

        expect(ungrouped.blocks).toHaveLength(1)
        expect(ungrouped.exercises[0].block_id).toBeNull()
        expect(ungrouped.exercises[1].block_id).toBe(ungrouped.blocks?.[0].client_id)
        expect(ungrouped.exercises[2].block_id).toBe(ungrouped.blocks?.[0].client_id)
    })

    it('resolves membership from the persisted block row id', () => {
        const persisted = workout(
            [exercise('A', 7), exercise('B', 7), exercise('C')],
            [{ id: 7, type: 'SUPERSET', order: 0, rounds: 1, rest_seconds: null }],
        )

        // Membership is observable through the presentation slots.
        expect(supersetSlots(persisted).map((slot) => slot.label)).toEqual(['A1', 'A2', null])

        // Extending a persisted block reuses it instead of creating a second one.
        const extended = groupExerciseWithNext(persisted, 1)
        expect(extended.blocks).toHaveLength(1)
        expect(extended.exercises[2].block_id).toBe(7)
    })

    it('reports no label for exercises outside any block', () => {
        const slots = supersetSlots(workout([exercise('A'), exercise('B')]))
        expect(slots).toEqual([
            { header: null, label: null },
            { header: null, label: null },
        ])
    })
})
