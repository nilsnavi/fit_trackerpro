import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { WorkoutType } from '@shared/types'
import type {
    CalendarWorkout,
    CompletedExercise,
    CompletedSet,
    WorkoutCompleteRequest,
    WorkoutCompleteResponse,
    WorkoutHistoryItem,
    WorkoutHistoryResponse,
    WorkoutStartRequest,
    WorkoutStartResponse,
    WorkoutStartType,
    WorkoutTemplateCreateRequest,
    WorkoutTemplateListResponse,
    WorkoutTemplateResponse,
} from '@features/workouts/types/workouts'

export const workoutTemplatesDefaultListParams = { page: 1, page_size: 20 } as const

export function nextOptimisticNegativeId(): number {
    return -Math.abs(Date.now())
}

export function calendarKeyMatchesScheduledAt(queryKey: QueryKey, scheduledAtIso: string): boolean {
    if (!Array.isArray(queryKey) || queryKey.length < 5 || queryKey[1] !== 'calendar') {
        return false
    }
    const year = queryKey[3] as number
    const monthIndex0 = queryKey[4] as number
    const t = new Date(scheduledAtIso)
    if (Number.isNaN(t.getTime())) return false
    return t.getFullYear() === year && t.getMonth() === monthIndex0
}

/** Проверка, что ключ календаря — за месяц, в который попадает дата `YYYY-MM-DD`. */
export function calendarKeyMatchesDateYmd(queryKey: QueryKey, dateYmd: string): boolean {
    if (!Array.isArray(queryKey) || queryKey.length < 5 || queryKey[1] !== 'calendar') {
        return false
    }
    const year = queryKey[3] as number
    const monthIndex0 = queryKey[4] as number
    const [y, m] = dateYmd.split('-').map(Number)
    if (!y || !m) return false
    const t = new Date(y, m - 1, 1)
    return t.getFullYear() === year && t.getMonth() === monthIndex0
}

export function mapStartTypeToCalendarWorkoutType(type?: WorkoutStartType): WorkoutType {
    switch (type) {
        case 'cardio':
            return 'cardio'
        case 'strength':
            return 'strength'
        case 'flexibility':
            return 'flexibility'
        case 'mixed':
        case 'custom':
        default:
            return 'other'
    }
}

export function buildCalendarEntryFromStartPayload(
    tempId: number,
    payload: WorkoutStartRequest,
    scheduledAtIso: string,
): CalendarWorkout {
    const title =
        payload.name?.trim() ||
        (payload.template_id != null ? `Шаблон #${payload.template_id}` : 'Тренировка')
    return {
        id: tempId,
        title,
        type: mapStartTypeToCalendarWorkoutType(payload.type),
        status: 'planned',
        duration_minutes: 0,
        scheduled_at: scheduledAtIso,
    }
}

export function calendarEntryFromStartResponse(
    res: WorkoutStartResponse,
    payload: WorkoutStartRequest,
): CalendarWorkout {
    const scheduledAt =
        typeof res.start_time === 'string' ? res.start_time : new Date(res.start_time).toISOString()
    const title =
        payload.name?.trim() ||
        (payload.template_id != null ? `Шаблон #${payload.template_id}` : 'Тренировка')
    return {
        id: res.id,
        title,
        type: mapStartTypeToCalendarWorkoutType(payload.type),
        status: 'planned',
        duration_minutes: 0,
        scheduled_at: scheduledAt,
    }
}

/** План подходов из шаблона для активной сессии (кэш до POST /complete). */
export function completedExercisesFromTemplate(template: WorkoutTemplateResponse): CompletedExercise[] {
    return template.exercises.map((ex) => ({
        exercise_id: ex.exercise_id,
        name: ex.name,
        notes: ex.notes,
        sets_completed: Array.from({ length: ex.sets }, (_, i) => ({
            set_number: i + 1,
            reps: ex.reps,
            weight: ex.weight,
            duration: ex.duration,
            completed: false,
        })),
    }))
}

export function updateSetInHistoryItem(
    item: WorkoutHistoryItem,
    exerciseIndex: number,
    setNumber: number,
    patch: Partial<CompletedSet>,
): WorkoutHistoryItem {
    if (exerciseIndex < 0 || exerciseIndex >= item.exercises.length) return item
    const exercises = item.exercises.map((ex, i) => {
        if (i !== exerciseIndex) return ex
        const sets_completed = ex.sets_completed.map((s) =>
            s.set_number === setNumber ? { ...s, ...patch } : s,
        )
        return { ...ex, sets_completed }
    })
    return { ...item, exercises }
}

export type WorkoutHistoryItemSessionPatch = Partial<
    Pick<WorkoutHistoryItem, 'duration' | 'comments' | 'tags' | 'glucose_before' | 'glucose_after'>
>

export function patchHistoryItemSessionFields(
    item: WorkoutHistoryItem,
    patch: WorkoutHistoryItemSessionPatch,
): WorkoutHistoryItem {
    return { ...item, ...patch }
}

export function historyItemFromStartResponse(
    res: WorkoutStartResponse,
    payload: WorkoutStartRequest,
): WorkoutHistoryItem {
    const dateStr = typeof res.date === 'string' ? res.date : String(res.date)
    const createdAt =
        typeof res.start_time === 'string' ? res.start_time : new Date(res.start_time).toISOString()
    return {
        id: res.id,
        date: dateStr,
        duration: undefined,
        exercises: [],
        comments: payload.name?.trim() || undefined,
        tags: [],
        created_at: createdAt,
    }
}

export function optimisticHistoryItemForStart(
    tempId: number,
    payload: WorkoutStartRequest,
    scheduledAtIso: string,
): WorkoutHistoryItem {
    const d = new Date(scheduledAtIso)
    const dateStr = Number.isNaN(d.getTime())
        ? new Date().toISOString().slice(0, 10)
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
        id: tempId,
        date: dateStr,
        duration: undefined,
        exercises: [],
        comments: payload.name?.trim() || undefined,
        tags: [],
        created_at: scheduledAtIso,
    }
}

export function takeWorkoutsCalendarSnapshot(queryClient: QueryClient): [QueryKey, unknown][] {
    return queryClient.getQueriesData({ queryKey: ['workouts', 'calendar'], exact: false })
}

export function takeWorkoutsHistoryListsSnapshot(queryClient: QueryClient): [QueryKey, unknown][] {
    return queryClient.getQueriesData({ queryKey: ['workouts', 'history'], exact: false })
}

export function takeWorkoutsTemplateListsSnapshot(queryClient: QueryClient): [QueryKey, unknown][] {
    return queryClient.getQueriesData({ queryKey: ['workouts', 'templates', 'list'], exact: false })
}

export function restoreSnapshotEntries(queryClient: QueryClient, entries: [QueryKey, unknown][]): void {
    for (const [key, data] of entries) {
        queryClient.setQueryData(key, data)
    }
}

export function appendCalendarWorkoutForMatchingMonth(
    queryClient: QueryClient,
    entry: CalendarWorkout,
): void {
    const queries = queryClient.getQueriesData<CalendarWorkout[]>({
        queryKey: ['workouts', 'calendar'],
        exact: false,
    })
    for (const [key, old] of queries) {
        if (!old || !calendarKeyMatchesScheduledAt(key, entry.scheduled_at)) continue
        if (old.some((w: CalendarWorkout) => w.id === entry.id)) continue
        queryClient.setQueryData(key, [...old, entry])
    }
}

export function replaceCalendarWorkoutId(
    queryClient: QueryClient,
    fromId: number,
    next: CalendarWorkout,
): void {
    const queries = queryClient.getQueriesData<CalendarWorkout[]>({
        queryKey: ['workouts', 'calendar'],
        exact: false,
    })
    for (const [key, old] of queries) {
        if (!old || !calendarKeyMatchesScheduledAt(key, next.scheduled_at)) continue
        const idx = old.findIndex((w: CalendarWorkout) => w.id === fromId)
        if (idx >= 0) {
            const copy = [...old]
            copy[idx] = next
            queryClient.setQueryData(key, copy)
            continue
        }
        if (old.some((w: CalendarWorkout) => w.id === next.id)) continue
        queryClient.setQueryData(key, [...old, next])
    }
}

export function replaceHistoryListTemporalId(
    queryClient: QueryClient,
    fromId: number,
    item: WorkoutHistoryItem,
): void {
    queryClient.setQueriesData<WorkoutHistoryResponse>(
        { queryKey: ['workouts', 'history'], exact: false },
        (old) => {
            if (!old?.items?.length) return old
            const idx = old.items.findIndex((w) => w.id === fromId)
            if (idx < 0) {
                if (old.items.some((w) => w.id === item.id)) return old
                return {
                    ...old,
                    items: [item, ...old.items],
                    total: old.total + 1,
                }
            }
            const items = [...old.items]
            items[idx] = item
            return { ...old, items }
        },
    )
}

export function prependHistoryListItem(queryClient: QueryClient, item: WorkoutHistoryItem): void {
    queryClient.setQueriesData<WorkoutHistoryResponse>(
        { queryKey: ['workouts', 'history'], exact: false },
        (old) => {
            if (!old) return old
            if (old.items.some((w) => w.id === item.id)) return old
            return {
                ...old,
                items: [item, ...old.items],
                total: old.total + 1,
            }
        },
    )
}

function templateListPredicateMatchesCreate(
    queryKey: QueryKey,
    payload: WorkoutTemplateCreateRequest,
): boolean {
    const p = queryKey[3]
    if (!p || typeof p !== 'object') return true
    const tt = (p as { template_type?: string }).template_type
    return tt == null || tt === payload.type
}

export function prependTemplateToMatchingLists(
    queryClient: QueryClient,
    row: WorkoutTemplateResponse,
    payload: WorkoutTemplateCreateRequest,
): void {
    const queries = queryClient.getQueriesData<WorkoutTemplateListResponse>({
        queryKey: ['workouts', 'templates', 'list'],
        exact: false,
    })
    for (const [key, old] of queries) {
        if (!old) continue
        if (!templateListPredicateMatchesCreate(key, payload)) continue
        if (old.items.some((t: WorkoutTemplateResponse) => t.id === row.id)) continue
        queryClient.setQueryData(key, {
            ...old,
            items: [row, ...old.items],
            total: old.total + 1,
        })
    }
}

export function replaceTemplateIdInLists(
    queryClient: QueryClient,
    fromId: number,
    row: WorkoutTemplateResponse,
): void {
    queryClient.setQueriesData<WorkoutTemplateListResponse>(
        { queryKey: ['workouts', 'templates', 'list'], exact: false },
        (old) => {
            if (!old?.items?.length) return old
            const idx = old.items.findIndex((t) => t.id === fromId)
            if (idx < 0) return old
            const items = [...old.items]
            items[idx] = row
            return { ...old, items }
        },
    )
}

export function replaceTemplateInListsById(
    queryClient: QueryClient,
    templateId: number,
    row: WorkoutTemplateResponse,
): void {
    queryClient.setQueriesData<WorkoutTemplateListResponse>(
        { queryKey: ['workouts', 'templates', 'list'], exact: false },
        (old) => {
            if (!old?.items?.length) return old
            const idx = old.items.findIndex((t) => t.id === templateId)
            if (idx < 0) return old
            const items = [...old.items]
            items[idx] = row
            return { ...old, items }
        },
    )
}

export function optimisticTemplateRow(
    tempId: number,
    payload: WorkoutTemplateCreateRequest,
): WorkoutTemplateResponse {
    const now = new Date().toISOString()
    return {
        id: tempId,
        user_id: 0,
        name: payload.name,
        type: payload.type,
        exercises: payload.exercises,
        is_public: payload.is_public,
        is_archived: false,
        created_at: now,
        updated_at: now,
    }
}

export function findTemplateInCaches(
    queryClient: QueryClient,
    templateId: number,
): WorkoutTemplateResponse | undefined {
    const queries = queryClient.getQueriesData<WorkoutTemplateListResponse>({
        queryKey: ['workouts', 'templates', 'list'],
        exact: false,
    })
    for (const [, data] of queries) {
        const hit = data?.items?.find((t) => t.id === templateId)
        if (hit) return hit
    }
    return undefined
}

export function historyItemFromCompleteResponse(res: WorkoutCompleteResponse): WorkoutHistoryItem {
    return {
        id: res.id,
        date: res.date,
        duration: res.duration,
        exercises: res.exercises,
        comments: res.comments,
        tags: res.tags,
        glucose_before: res.glucose_before,
        glucose_after: res.glucose_after,
        created_at: res.completed_at,
    }
}

export function optimisticPatchHistoryItemComplete(
    item: WorkoutHistoryItem,
    payload: WorkoutCompleteRequest,
): WorkoutHistoryItem {
    return {
        ...item,
        duration: payload.duration,
        exercises: payload.exercises,
        comments: payload.comments,
        tags: payload.tags,
        glucose_before: payload.glucose_before,
        glucose_after: payload.glucose_after,
    }
}

export function patchHistoryListItemComplete(
    queryClient: QueryClient,
    workoutId: number,
    payload: WorkoutCompleteRequest,
): void {
    queryClient.setQueriesData<WorkoutHistoryResponse>(
        { queryKey: ['workouts', 'history'], exact: false },
        (old) => {
            if (!old?.items?.length) return old
            const idx = old.items.findIndex((w) => w.id === workoutId)
            if (idx < 0) return old
            const items = [...old.items]
            items[idx] = optimisticPatchHistoryItemComplete(old.items[idx], payload)
            return { ...old, items }
        },
    )
}

export function patchCalendarWorkoutComplete(
    queryClient: QueryClient,
    workoutId: number,
    payload: WorkoutCompleteRequest,
    completedAtIso: string,
    workoutDateYmd: string,
): void {
    const queries = queryClient.getQueriesData<CalendarWorkout[]>({
        queryKey: ['workouts', 'calendar'],
        exact: false,
    })
    for (const [key, old] of queries) {
        if (!old || !calendarKeyMatchesDateYmd(key, workoutDateYmd)) continue
        const idx = old.findIndex((w: CalendarWorkout) => w.id === workoutId)
        if (idx < 0) continue
        const prev = old[idx]
        const copy = [...old]
        copy[idx] = {
            ...prev,
            status: 'completed',
            duration_minutes: payload.duration,
            completed_at: completedAtIso,
        }
        queryClient.setQueryData(key, copy)
    }
}
