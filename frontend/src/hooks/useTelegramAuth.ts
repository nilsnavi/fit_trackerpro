import { useCallback, useMemo } from 'react'

import { useTelegramContext } from '@app/providers/TelegramProvider'
import { authApi, type TelegramAuthResponse } from '@features/profile/api/authApi'
import { getPublicApiBaseUrl } from '@shared/config/runtime'
import { AppHttpError, clientErrorFromFetchResponse } from '@shared/errors'

export function pickAccessTokenFromAuthResponse(r: TelegramAuthResponse): string {
    const raw = r.token ?? r.access_token
    if (!raw) {
        throw new Error('Не получен JWT от сервера')
    }
    return raw
}

export type TelegramExchangeResult = {
    accessToken: string
    refreshToken?: string | null
    isNewUser: boolean
    onboardingRequired: boolean
    via: 'authApi' | 'fetch'
}

async function telegramLoginFetchRaw(initData: string): Promise<TelegramAuthResponse> {
    const base = getPublicApiBaseUrl().replace(/\/$/, '')
    const response = await fetch(`${base}/users/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
    })
    if (!response.ok) {
        const clientError = await clientErrorFromFetchResponse(response)
        throw new AppHttpError(clientError)
    }
    return (await response.json()) as TelegramAuthResponse
}

/**
 * Validates initData on the backend and returns JWT + onboarding flags.
 * Uses HTTP fetch only when `authApi.telegramLogin` is unavailable (e.g. some test mocks).
 */
export async function exchangeTelegramInitData(initData: string): Promise<TelegramExchangeResult> {
    const map = (data: TelegramAuthResponse, via: 'authApi' | 'fetch'): TelegramExchangeResult => ({
        accessToken: pickAccessTokenFromAuthResponse(data),
        refreshToken: data.refresh_token,
        isNewUser: data.is_new_user,
        onboardingRequired: data.onboarding_required,
        via,
    })

    const loginFn = (authApi as { telegramLogin?: (v: string) => Promise<TelegramAuthResponse> }).telegramLogin
    if (typeof loginFn !== 'function') {
        const data = await telegramLoginFetchRaw(initData)
        return map(data, 'fetch')
    }
    const data = await loginFn(initData)
    return map(data, 'authApi')
}

/**
 * Mini App–oriented helpers: raw initData string and {@link exchangeTelegramInitData}.
 */
export function useTelegramAuth() {
    const { initData, isTelegram, webApp, user, launchMode } = useTelegramContext()

    const ready = useCallback(() => {
        try {
            webApp?.ready()
        } catch {
            // ignore
        }
    }, [webApp])

    const exchange = useCallback(async (raw: string) => exchangeTelegramInitData(raw), [])

    return useMemo(
        () => ({
            initData,
            isTelegram,
            launchMode,
            telegramUser: user,
            ready,
            exchange,
        }),
        [exchange, initData, isTelegram, launchMode, ready, user],
    )
}
