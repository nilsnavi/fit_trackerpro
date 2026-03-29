import { useMemo } from 'react'
import { useWorkoutTemplatesQuery } from '@features/workouts/hooks/useWorkoutTemplatesQuery'
import {
    customHomeWorkoutCard,
    workoutTemplateResponseToHomeCard,
} from '@features/home/lib/mapWorkoutTemplateToHome'
import type { HomeWorkoutTemplate } from '@shared/types'

/** Шаблоны тренировок с API + карточка «Своя» для главной. */
export function useHomeWorkoutTemplatesQuery() {
    const q = useWorkoutTemplatesQuery()

    const templates: HomeWorkoutTemplate[] = useMemo(() => {
        const items = (q.data?.items ?? []).map(workoutTemplateResponseToHomeCard)
        return [...items, customHomeWorkoutCard()]
    }, [q.data])

    return {
        ...q,
        templates,
    }
}
