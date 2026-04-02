/**
 * Схема управления состоянием фронтенда FitTracker Pro.
 *
 * Серверное состояние — TanStack Query: state/server (queryKeys), state/queryHooks (типовые хуки),
 * остальное в hooks внутри features. Провайдер: QueryProvider в App.tsx.
 *
 * Zustand (state/local): useUiStore и useSessionStore не используются в экранах до отдельного
 * решения; useWorkoutDraftStore и useWorkoutSessionDraftStore — рабочие клиентские сторы.
 *
 * React Context: TelegramProvider, ThemeProvider, AppShellLayoutContext — не дублировать в Zustand.
 */
export { queryKeys } from './server'
export type { AchievementListFilter } from './server'
export {
    useActiveWorkoutStore,
    useSessionStore,
    useUiStore,
    useWorkoutDraftStore,
    useWorkoutSessionDraftStore,
} from './local'
export type { AnalyticsRange } from './local'
export {
    useCurrentUserQuery,
    useHomeWaterQuery,
    useHomeWorkoutTemplatesQuery,
    useUserStatsQuery,
} from './queryHooks'
