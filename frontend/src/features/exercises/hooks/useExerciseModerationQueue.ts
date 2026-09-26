import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@shared/api/queryKeys'
import { exercisesApi } from '@shared/api/domains/exercisesApi'
import { EXERCISES_MODERATION_LIST_PARAMS } from '@features/exercises/constants/catalogQueryParams'
import type { ExerciseApiItem } from '@features/exercises/types/exerciseApi'

/**
 * Заявки на модерацию: для админа — все, для пользователя — только его собственные
 * (фильтрует сервер). Отдельный ключ от каталога, поэтому кэш не смешивается.
 */
export function useExerciseModerationQueue(enabled = true) {
    return useQuery({
        queryKey: queryKeys.exercises.list(EXERCISES_MODERATION_LIST_PARAMS),
        queryFn: async (): Promise<ExerciseApiItem[]> => {
            const res = await exercisesApi.list({ ...EXERCISES_MODERATION_LIST_PARAMS })
            return res.items
        },
        enabled,
    })
}
