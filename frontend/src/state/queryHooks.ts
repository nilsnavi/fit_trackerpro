/**
 * Типовые точки входа для серверного состояния (TanStack Query).
 * При переносе useState на данные с API подключайте эти хуки (или аналоги в hooks внутри features),
 * не дублируя смысл в useUiStore / useSessionStore.
 */
export { useCurrentUserQuery } from '@features/profile/hooks/useCurrentUserQuery'
export { useUserStatsQuery } from '@features/profile/hooks/useUserStatsQuery'
export { useHomeWaterQuery, useHomeWorkoutTemplatesQuery } from '@features/home/hooks'
