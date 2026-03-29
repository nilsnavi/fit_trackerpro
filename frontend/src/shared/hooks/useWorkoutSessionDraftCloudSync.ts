import { useCallback, useEffect, useRef } from 'react'
import { useTelegramContext } from '@app/providers/TelegramProvider'
import { useWorkoutSessionDraftStore } from '@/state/local'
import {
    WORKOUT_SESSION_DRAFT_CLOUD_KEY,
    parseWorkoutSessionDraftBlob,
} from '@shared/lib/workoutSessionDraftCloud'

/**
 * Дублирует черновик активной тренировки в Telegram Cloud Storage,
 * чтобы после закрытия Mini App пользователь мог продолжить с другого устройства / сеанса.
 */
export function useWorkoutSessionDraftCloudSync(): void {
    const telegram = useTelegramContext()
    const telegramRef = useRef(telegram)
    telegramRef.current = telegram

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const pushCloud = useCallback(async () => {
        const { isTelegram, cloudStorage } = telegramRef.current
        if (!isTelegram) return

        const { workoutId, title, updatedAt } = useWorkoutSessionDraftStore.getState()
        if (workoutId == null) {
            await cloudStorage.removeItem(WORKOUT_SESSION_DRAFT_CLOUD_KEY)
            return
        }
        await cloudStorage.setItem(
            WORKOUT_SESSION_DRAFT_CLOUD_KEY,
            JSON.stringify({ workoutId, title: title ?? '', updatedAt }),
        )
    }, [])

    useEffect(() => {
        if (!telegram.isTelegram) return

        const mergeFromCloud = async () => {
            const { cloudStorage } = telegramRef.current
            const raw = await cloudStorage.getItem(WORKOUT_SESSION_DRAFT_CLOUD_KEY)
            const cloud = parseWorkoutSessionDraftBlob(raw)
            const local = useWorkoutSessionDraftStore.getState()

            if (cloud?.workoutId && cloud.updatedAt > local.updatedAt) {
                local.hydrateFromRemote(cloud)
            } else if (local.workoutId != null && local.updatedAt > (cloud?.updatedAt ?? 0)) {
                await pushCloud()
            }
        }

        if (useWorkoutSessionDraftStore.persist.hasHydrated()) {
            void mergeFromCloud()
            return
        }

        return useWorkoutSessionDraftStore.persist.onFinishHydration(() => {
            void mergeFromCloud()
        })
    }, [telegram.isTelegram, pushCloud])

    useEffect(() => {
        if (!telegram.isTelegram) return

        return useWorkoutSessionDraftStore.subscribe((state, prev) => {
            if (
                state.workoutId === prev.workoutId &&
                state.title === prev.title &&
                state.updatedAt === prev.updatedAt
            ) {
                return
            }
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
                debounceRef.current = null
                void pushCloud()
            }, 400)
        })
    }, [telegram.isTelegram, pushCloud])

    useEffect(() => {
        if (!telegram.isTelegram) return

        const flush = () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
                debounceRef.current = null
            }
            void pushCloud()
        }

        const onVisibility = () => {
            if (document.visibilityState === 'hidden') flush()
        }

        window.addEventListener('pagehide', flush)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            window.removeEventListener('pagehide', flush)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [telegram.isTelegram, pushCloud])
}
