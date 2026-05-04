import { useQuery } from '@tanstack/react-query'
import { workoutsApi } from '@shared/api/domains/workoutsApi'
import type { WeightRecommendationResponse } from '@features/workouts/types/workouts'

export function useWeightRecommendation(sessionId: number, exerciseId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['weight-recommendation', sessionId, exerciseId],
    queryFn: (): Promise<WeightRecommendationResponse> =>
      workoutsApi.getWeightRecommendation(sessionId, exerciseId),
    enabled,
    staleTime: 30_000, // 30 секунд - рекомендация актуальна короткое время
    refetchOnWindowFocus: false,
  })
}
