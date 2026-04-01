import * as Sentry from '@sentry/react'
import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from './Button'
import { cn } from '@shared/lib/cn'

type SentryFallbackProps = {
    error: unknown
    componentStack: string
    eventId: string
    resetError: () => void
}

function RouteErrorFallback({
    resetError,
    eventId,
    screenTitle,
}: SentryFallbackProps & { screenTitle?: string }) {
    const navigate = useNavigate()

    return (
        <div
            className={cn(
                'flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-6 py-10 text-center',
                'text-telegram-text',
            )}
            role="alert"
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/15 text-danger">
                <AlertTriangle className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-1">
                <h1 className="text-lg font-semibold">Не удалось открыть экран</h1>
                {screenTitle ? (
                    <p className="text-sm text-telegram-hint">{screenTitle}</p>
                ) : null}
                <p className="text-sm text-telegram-hint">
                    Попробуйте снова или вернитесь на главную.
                </p>
            </div>
            {eventId ? (
                <p className="text-xs text-telegram-hint/80" data-testid="route-error-event-id">
                    Код: {eventId}
                </p>
            ) : null}
            <div className="flex w-full max-w-xs flex-col gap-2">
                <Button type="button" onClick={resetError} fullWidth>
                    Повторить
                </Button>
                <Button type="button" variant="secondary" fullWidth onClick={() => navigate('/', { replace: true })}>
                    На главную
                </Button>
            </div>
        </div>
    )
}

export type RouteErrorBoundaryProps = {
    children: React.ReactNode
    /** Подпись раздела для пользователя (например «Аналитика») */
    screenTitle?: string
}

/**
 * Изолирует ошибки рендера страницы: соседние маршруты и оболочка приложения остаются рабочими.
 */
export function RouteErrorBoundary({ children, screenTitle }: RouteErrorBoundaryProps) {
    return (
        <Sentry.ErrorBoundary
            showDialog={false}
            fallback={(props) => <RouteErrorFallback {...props} screenTitle={screenTitle} />}
        >
            {children}
        </Sentry.ErrorBoundary>
    )
}
