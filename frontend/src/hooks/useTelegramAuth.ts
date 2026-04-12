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

async function telegramRegisterFetchRaw(initData: string): Promise<TelegramAuthResponse> {
    const base = getPublicApiBaseUrl().replace(/\/$/, '')
    const response = await fetch(`${base}/users/auth/register`, {
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

async function telegramLookupFetchRaw(initData: string): Promise<{ registered: boolean }> {
    const base = getPublicApiBaseUrl().replace(/\/$/, '')
    const response = await fetch(`${base}/users/auth/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
    })
    if (!response.ok) {
        const clientError = await clientErrorFromFetchResponse(response)
        throw new AppHttpError(clientError)
    }
    return (await response.json()) as { registered: boolean }
}

/**
 * Validates initData and returns whether a user row already exists (no account creation).
 */
export async function lookupTelegramRegistration(initData: string): Promise<{ registered: boolean }> {
    const lookupFn = (authApi as { telegramLookup?: (v: string) => Promise<{ registered: boolean }> })
        .telegramLookup
    if (typeof lookupFn !== 'function') {
        return telegramLookupFetchRaw(initData)
    }
    return lookupFn(initData)
}

/**
 * First-time registration: POST /users/auth/register with initData (same JWT payload as /telegram).
 */
export async function registerTelegramInitData(initData: string): Promise<TelegramExchangeResult> {
    const map = (data: TelegramAuthResponse, via: 'authApi' | 'fetch'): TelegramExchangeResult => ({
        accessToken: pickAccessTokenFromAuthResponse(data),
        refreshToken: data.refresh_token,
        isNewUser: data.is_new_user,
        onboardingRequired: data.onboarding_required,
        via,
    })

    const registerFn = (authApi as { telegramRegister?: (v: string) => Promise<TelegramAuthResponse> })
        .telegramRegister
    if (typeof registerFn !== 'function') {
        const data = await telegramRegisterFetchRaw(initData)
        return map(data, 'fetch')
    }
    const data = await registerFn(initData)
    return map(data, 'authApi')
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
