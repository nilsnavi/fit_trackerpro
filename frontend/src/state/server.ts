/**
 * Серверное состояние: единый источник ключей кэша TanStack Query (queryKeys).
 *
 * Данные с API загружают хуки в features. После мутаций используйте
 * queryClient.invalidateQueries или оптимистичные обновления из
 * workoutQueryOptimistic (features/workouts/lib).
 */
export { queryKeys } from '@shared/api/queryKeys'
export type { AchievementListFilter } from '@shared/api/queryKeys'
