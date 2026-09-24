import { useCallback, useEffect, useState } from 'react'

import { authApi } from '@features/profile/api/authApi'
import { isAppHttpError } from '@shared/errors'
import { pickAccessTokenFromAuthResponse } from '@/hooks/useTelegramAuth'
import { useAuthStore } from '@/stores/authStore'

export type TelegramExchangeStatus = 'idle' | 'pending' | 'ready' | 'error'

export interface TelegramAuthExchange {
    status: TelegramExchangeStatus
    /** 401/403: сервер отверг initData — его сообщение имеет смысл показать пользователю. */
    authError: boolean
    message: string | null
    /** Повторить обмен (например, после сетевой ошибки). */
    retry: () => void
}

/**
 * Владелец обмена initData на токены для стартового гейта: клиент API, разбор ответа,
 * запись токенов и классификация ошибки. Компонент гейта отвечает только за экраны,
 * поэтому в него не протекает ни `api`, ни `isAppHttpError`.
 */
export function useTelegramAuthExchange(initData: string, enabled: boolean): TelegramAuthExchange {
    const setTokens = useAuthStore((state) => state.setTokens)
    const [attempt, setAttempt] = useState(0)
    const [status, setStatus] = useState<TelegramExchangeStatus>(() =>
        initData && enabled ? 'pending' : 'idle',
    )
    const [authError, setAuthError] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!enabled || !initData) return

        let cancelled = false
        setStatus('pending')
        setAuthError(false)
        setMessage(null)

        void (async () => {
            try {
                const data = await authApi.telegramLogin(initData)
                if (cancelled) return
                setTokens({
                    accessToken: pickAccessTokenFromAuthResponse(data),
                    refreshToken: data.refresh_token ?? null,
                })
                setStatus('ready')
            } catch (error) {
                if (cancelled) return
                const isAuth = isAppHttpError(error) && (error.status === 401 || error.status === 403)
                const raw = (error as { message?: unknown }).message
                setAuthError(isAuth)
                setMessage(isAuth && typeof raw === 'string' && raw.trim() ? raw : null)
                setStatus('error')
            }
        })()

        return () => {
            cancelled = true
        }
    }, [attempt, enabled, initData, setTokens])

    const retry = useCallback(() => {
        setStatus('pending')
        setAttempt((value) => value + 1)
    }, [])

    return { status, authError, message, retry }
}
