import { PropsWithChildren, useEffect, useMemo, useState } from 'react'

import type { TelegramAuthResponse } from '@features/profile/api/authApi'
import { pickAccessTokenFromAuthResponse } from '@/hooks/useTelegramAuth'
import { api } from '@shared/api/client'
import { getTelegramBotUsername } from '@shared/config/runtime'
import { cn } from '@shared/lib/cn'
import { isAppHttpError } from '@shared/errors'
import { Button } from '@shared/ui/Button'
import { Card } from '@shared/ui/Card'
import { useAuthStore } from '@/stores/authStore'

type TelegramUnsafeUser = {
    id?: number
    first_name?: string
    last_name?: string
    photo_url?: string
}

type GatePhase = 'stub' | 'authenticating' | 'auth_error' | 'ready'

function readTelegramInit(): { initData: string; unsafeUser: TelegramUnsafeUser | undefined } {
    if (typeof window === 'undefined') {
        return { initData: '', unsafeUser: undefined }
    }
    const webApp = window.Telegram?.WebApp
    return {
        initData: webApp?.initData ?? '',
        unsafeUser: webApp?.initDataUnsafe?.user as TelegramUnsafeUser | undefined,
    }
}

function userDisplayName(user: TelegramUnsafeUser | undefined): string {
    if (!user) return 'Пользователь Telegram'
    const parts = [user.first_name, user.last_name].filter(Boolean) as string[]
    return parts.length > 0 ? parts.join(' ') : 'Пользователь Telegram'
}

export function TelegramAuthGate({ children }: PropsWithChildren) {
    const { initData, unsafeUser } = useMemo(() => readTelegramInit(), [])
    const trimmed = initData.trim()
    const setTokens = useAuthStore((s) => s.setTokens)
    /** Vite sets `import.meta.env.DEV`; Jest cannot parse `import.meta` in this file. */
    const devBypass = process.env.NODE_ENV === 'development' && !trimmed

    const [phase, setPhase] = useState<GatePhase>(() => (trimmed ? 'authenticating' : 'stub'))
    const [nonAuthError, setNonAuthError] = useState(false)
    const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        if (devBypass) return
        if (phase !== 'authenticating' || !trimmed) return

        let cancelled = false
        setNonAuthError(false)
        setAuthErrorMessage(null)

        void (async () => {
            try {
                const data = await api.post<TelegramAuthResponse>('/users/auth/telegram', {
                    init_data: initData,
                })
                if (cancelled) return
                const accessToken = pickAccessTokenFromAuthResponse(data)
                setTokens({
                    accessToken,
                    refreshToken: data.refresh_token ?? null,
                })
                setPhase('ready')
            } catch (e) {
                if (cancelled) return
                const isAuth =
                    isAppHttpError(e) && (e.status === 401 || e.status === 403)
                setNonAuthError(!isAuth)
                if (isAuth) {
                    const msg = (e as { message?: unknown }).message
                    setAuthErrorMessage(typeof msg === 'string' && msg.trim() ? msg : null)
                }
                setPhase('auth_error')
            }
        })()

        return () => {
            cancelled = true
        }
    }, [devBypass, phase, initData, trimmed, setTokens])

    const retry = () => {
        setPhase('authenticating')
    }

    if (devBypass) {
        return <>{children}</>
    }

    if (phase === 'stub') {
        const bot = getTelegramBotUsername().replace(/^@/, '').trim()
        return (
            <div className="flex min-h-dvh items-center justify-center p-4">
                <Card variant="info" className="w-full max-w-md">
                    <h1 className="text-lg font-semibold text-telegram-text">Открой в Telegram</h1>
                    <p className="mt-2 text-sm text-telegram-hint">
                        {bot
                            ? `Мини-приложение доступно через бота @${bot}.`
                            : 'Запустите мини-приложение из Telegram.'}
                    </p>
                    {bot ? (
                        <a
                            href={`https://t.me/${bot}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={cn(
                                'mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl font-medium transition-all',
                                'bg-primary text-primary-foreground shadow-primary hover:bg-primary-600',
                                'focus:outline-none focus:ring-2 focus:ring-primary/30',
                            )}
                        >
                            Открыть бота
                        </a>
                    ) : null}
                </Card>
            </div>
        )
    }

    if (phase === 'auth_error') {
        return (
            <div className="flex min-h-dvh items-center justify-center p-4">
                <Card variant="info" className="w-full max-w-md">
                    <h1 className="text-lg font-semibold text-danger">Ошибка авторизации</h1>
                    <p className="mt-2 text-sm text-telegram-hint" role="alert">
                        {nonAuthError
                            ? 'Не удалось завершить вход. Проверьте соединение и попробуйте снова.'
                            : authErrorMessage ?? 'Не удалось подтвердить данные Telegram (initData).'}
                    </p>
                    <Button type="button" className="mt-4 w-full" onClick={retry}>
                        Попробовать снова
                    </Button>
                </Card>
            </div>
        )
    }

    if (phase === 'ready') {
        return <>{children}</>
    }

    const name = userDisplayName(unsafeUser)
    const photoUrl = unsafeUser?.photo_url
    const initials = [unsafeUser?.first_name?.[0], unsafeUser?.last_name?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase()

    return (
        <div className="flex min-h-dvh items-center justify-center p-4">
            <Card variant="info" className="w-full max-w-md">
                <p className="text-sm font-medium text-telegram-hint">Добро пожаловать</p>
                <h1 className="mt-1 text-xl font-semibold text-telegram-text">{name}</h1>
                <div className="mt-6 flex items-center gap-4">
                    <div
                        className={cn(
                            'relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-border',
                            photoUrl ? 'bg-telegram-secondary-bg' : 'animate-pulse bg-telegram-secondary-bg',
                        )}
                    >
                        {photoUrl ? (
                            <img
                                src={photoUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        ) : initials ? (
                            <span className="text-lg font-semibold text-telegram-hint">{initials}</span>
                        ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-4 max-w-[12rem] animate-pulse rounded bg-telegram-secondary-bg" />
                        <div className="h-3 max-w-[8rem] animate-pulse rounded bg-telegram-secondary-bg" />
                    </div>
                </div>
                <p className="mt-6 text-sm text-telegram-hint">Входим в аккаунт…</p>
            </Card>
        </div>
    )
}
