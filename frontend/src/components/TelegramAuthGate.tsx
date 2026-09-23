import { PropsWithChildren, useMemo } from 'react'

import { useTelegramAuthExchange } from '@/hooks/useTelegramAuthExchange'
import { getTelegramBotUsername } from '@shared/config/runtime'
import { cn } from '@shared/lib/cn'
import { Button } from '@shared/ui/Button'
import { Card } from '@shared/ui/Card'

type TelegramUnsafeUser = {
    id?: number
    first_name?: string
    last_name?: string
    photo_url?: string
}

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
    /** Vite sets `import.meta.env.DEV`; Jest cannot parse `import.meta` in this file. */
    const devBypass = process.env.NODE_ENV === 'development' && !trimmed
    const { status, authError, message, retry } = useTelegramAuthExchange(trimmed, !devBypass)

    if (devBypass) {
        return <>{children}</>
    }

    if (!trimmed) {
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

    if (status === 'error') {
        return (
            <div className="flex min-h-dvh items-center justify-center p-4">
                <Card variant="info" className="w-full max-w-md">
                    <h1 className="text-lg font-semibold text-danger">Ошибка авторизации</h1>
                    <p className="mt-2 text-sm text-telegram-hint" role="alert">
                        {authError
                            ? message ?? 'Не удалось подтвердить данные Telegram (initData).'
                            : 'Не удалось завершить вход. Проверьте соединение и попробуйте снова.'}
                    </p>
                    <Button type="button" className="mt-4 w-full" onClick={retry}>
                        Попробовать снова
                    </Button>
                </Card>
            </div>
        )
    }

    if (status === 'ready') {
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
