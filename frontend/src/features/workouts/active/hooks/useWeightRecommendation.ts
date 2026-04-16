import { useQuery } from '@tanstack/react-query'

interface WeightRecommendationResponse {
  recommendation: 'increase' | 'keep' | 'decrease' | 'no_data'
  suggested_weight?: number
  message: string
}

export function useWeightRecommendation(sessionId: number, exerciseId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['weight-recommendation', sessionId, exerciseId],
    queryFn: async (): Promise<WeightRecommendationResponse> => {
      const res = await fetch(`/api/v1/workouts/sessions/${sessionId}/exercises/${exerciseId}/weight-recommendation`)
      if (!res.ok) throw new Error('Ошибка получения рекомендации веса')
      return res.json()
    },
    enabled,
    staleTime: 30_000, // 30 секунд - рекомендация актуальна короткое время
    refetchOnWindowFocus: false,
  })
}
