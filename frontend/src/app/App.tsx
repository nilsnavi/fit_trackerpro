import * as Sentry from '@sentry/react'
import { ThemeProvider } from './providers/ThemeProvider'
import { TelegramProvider } from './providers/TelegramProvider'
import { AppRouter } from './router'

function SentryErrorFallback({
    resetError,
    error: _error,
    componentStack: _componentStack,
    eventId: _eventId,
}: {
    error: unknown
    componentStack: string
    eventId: string
    resetError(): void
}) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg font-medium text-foreground">Something went wrong</p>
            <button
                type="button"
                onClick={resetError}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
                Try again
            </button>
        </div>
    )
}

export default function App() {
    return (
        <Sentry.ErrorBoundary fallback={SentryErrorFallback} showDialog={false}>
            <TelegramProvider>
                <ThemeProvider>
                    <AppRouter />
                </ThemeProvider>
            </TelegramProvider>
        </Sentry.ErrorBoundary>
    )
}
