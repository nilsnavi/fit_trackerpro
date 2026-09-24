import type {
    CompletedExercise,
    WorkoutBlockPayload,
    WorkoutHistoryItem,
} from '@features/workouts/types/workouts'

const SUPERSET_CLIENT_ID_PREFIX = 'superset-'

/** Block reference stored on an exercise: client id while local, row id once synced. */
type BlockRef = number | string | null | undefined

/** Reference that links exercises to the given block (client id wins while local). */
function blockRef(block: WorkoutBlockPayload): string | number {
    return block.client_id ?? block.id ?? ''
}

function matchesRef(ref: BlockRef, block: WorkoutBlockPayload): boolean {
    if (ref == null) return false
    if (block.client_id != null && block.client_id === ref) return true
    return block.id != null && block.id === ref
}

/** Index of the block the exercise belongs to, or null (§21). */
function blockIndexOfExercise(
    workout: Pick<WorkoutHistoryItem, 'exercises' | 'blocks'>,
    exerciseIndex: number,
): number | null {
    const exercise = workout.exercises[exerciseIndex]
    if (!exercise) return null
    const index = (workout.blocks ?? []).findIndex((block) => matchesRef(exercise.block_id, block))
    return index >= 0 ? index : null
}

/** «SUPERSET A», «SUPERSET B», … for a block index. */
function supersetHeaderLabel(blockIndex: number): string {
    return `SUPERSET ${String.fromCharCode(65 + (Math.max(0, blockIndex) % 26))}`
}

export interface SupersetSlot {
    /** Header rendered above the first member («SUPERSET A»), null otherwise. */
    header: string | null
    /** Position inside the block: A1, A2, … (null when the exercise is not grouped). */
    label: string | null
}

/**
 * Per-exercise block presentation, so the screen stays free of grouping logic.
 * Members are ordered by `block_order` when the server provided it, otherwise by
 * their order inside the session.
 */
export function supersetSlots(
    workout: Pick<WorkoutHistoryItem, 'exercises' | 'blocks'>,
): SupersetSlot[] {
    const blocks = workout.blocks ?? []
    const slots: SupersetSlot[] = workout.exercises.map(() => ({ header: null, label: null }))

    blocks.forEach((block, blockIndex) => {
        const members = workout.exercises
            .map((exercise, index) => ({ exercise, index }))
            .filter(({ exercise }) => matchesRef(exercise.block_id, block))
            .sort((a, b) => {
                const orderA = a.exercise.block_order
                const orderB = b.exercise.block_order
                if (typeof orderA === 'number' && typeof orderB === 'number') return orderA - orderB
                return a.index - b.index
            })
        if (members.length === 0) return

        const letter = String.fromCharCode(65 + (blockIndex % 26))
        members.forEach(({ index }, position) => {
            slots[index] = {
                header: position === 0 ? supersetHeaderLabel(blockIndex) : null,
                label: `${letter}${position + 1}`,
            }
        })
    })

    return slots
}

function setBlockRef(
    exercises: CompletedExercise[],
    index: number,
    ref: string | number | null,
): CompletedExercise[] {
    return exercises.map((exercise, exerciseIndex) =>
        exerciseIndex === index ? { ...exercise, block_id: ref } : exercise,
    )
}

/** Clear the block reference of every member of the given block. */
function clearBlockRefs(
    exercises: CompletedExercise[],
    block: WorkoutBlockPayload,
): CompletedExercise[] {
    return exercises.map((exercise) =>
        matchesRef(exercise.block_id, block) ? { ...exercise, block_id: null } : exercise,
    )
}

/**
 * Drop blocks that no longer group at least two exercises, releasing the
 * remaining member so the session never keeps a half-empty superset.
 */
function dissolveSparseBlocks(
    exercises: CompletedExercise[],
    blocks: WorkoutBlockPayload[],
): { exercises: CompletedExercise[]; blocks: WorkoutBlockPayload[] } {
    let nextExercises = exercises
    const keptBlocks = blocks.filter((block) => {
        const members = nextExercises.filter((exercise) => matchesRef(exercise.block_id, block))
        if (members.length >= 2) return true
        nextExercises = clearBlockRefs(nextExercises, block)
        return false
    })
    return { exercises: nextExercises, blocks: keptBlocks }
}

/**
 * SPEC-005 §21: group the exercise with the following one into a SUPERSET block.
 * Session-only — the source template/program is never mutated. No-op when there is
 * no next exercise or the two already share a block.
 */
export function groupExerciseWithNext(
    workout: WorkoutHistoryItem,
    exerciseIndex: number,
): WorkoutHistoryItem {
    const nextIndex = exerciseIndex + 1
    if (exerciseIndex < 0 || nextIndex >= workout.exercises.length) return workout

    let exercises = workout.exercises
    const blocks = [...(workout.blocks ?? [])]

    const scoped = { exercises, blocks }
    const currentBlockIndex = blockIndexOfExercise(scoped, exerciseIndex)
    const nextBlockIndex = blockIndexOfExercise(scoped, nextIndex)
    if (currentBlockIndex != null && currentBlockIndex === nextBlockIndex) return workout

    // Detach the following exercise from any other block first.
    if (nextBlockIndex != null) {
        exercises = clearBlockRefs(exercises, blocks[nextBlockIndex])
    }

    let targetIndex = currentBlockIndex
    if (targetIndex == null) {
        blocks.push({
            client_id: `${SUPERSET_CLIENT_ID_PREFIX}${blocks.length + 1}`,
            type: 'SUPERSET',
            order: blocks.length,
            rounds: 1,
            rest_seconds: null,
        })
        targetIndex = blocks.length - 1
    }

    const ref = blockRef(blocks[targetIndex])
    exercises = setBlockRef(exercises, exerciseIndex, ref)
    exercises = setBlockRef(exercises, nextIndex, ref)

    const dissolved = dissolveSparseBlocks(exercises, blocks)
    return { ...workout, exercises: dissolved.exercises, blocks: dissolved.blocks }
}

/** SPEC-005 §21: remove the exercise from its block (dissolving a lone leftover). */
export function ungroupExercise(
    workout: WorkoutHistoryItem,
    exerciseIndex: number,
): WorkoutHistoryItem {
    const blockIndex = blockIndexOfExercise(workout, exerciseIndex)
    if (blockIndex == null) return workout

    const blocks = [...(workout.blocks ?? [])]
    const exercises = setBlockRef(workout.exercises, exerciseIndex, null)
    const dissolved = dissolveSparseBlocks(exercises, blocks)
    return { ...workout, exercises: dissolved.exercises, blocks: dissolved.blocks }
}
