import * as Sentry from '@sentry/react'
import { BrowserRouter } from 'react-router-dom'
import { PwaUpdatePrompt } from './app/components/PwaUpdatePrompt'
import { QueryProvider } from './app/providers/QueryProvider'
import { ThemeProvider } from './app/providers/ThemeProvider'
import { TelegramProvider } from './app/providers/TelegramProvider'
import { HealthCheckGate } from './app/providers/HealthCheckGate'
import { TelegramAuthBootstrapGate } from '@features/auth/components/TelegramAuthBootstrapGate'
import { TelegramInitDataErrorBoundary } from '@features/auth/components/TelegramInitDataErrorBoundary'
import { Toaster } from '@shared/ui/Toaster'
import { AppRoutes } from './app/routes/AppRoutes'

function SentryErrorFallback({
    resetError,
}: {
    error: unknown
    componentStack: string
    eventId: string
    resetError(): void
}) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg font-medium text-foreground">Что-то пошло не так</p>
            <button
                type="button"
                onClick={resetError}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
                Попробовать снова
            </button>
        </div>
    )
}

export default function App() {
    return (
        <QueryProvider>
            <HealthCheckGate>
                <Sentry.ErrorBoundary fallback={SentryErrorFallback} showDialog={false}>
                    <TelegramProvider>
                        <ThemeProvider>
                            <BrowserRouter>
                                <PwaUpdatePrompt />
                                <TelegramInitDataErrorBoundary>
                                    <TelegramAuthBootstrapGate>
                                        <AppRoutes />
                                    </TelegramAuthBootstrapGate>
                                </TelegramInitDataErrorBoundary>
                                <Toaster />
                            </BrowserRouter>
                        </ThemeProvider>
                    </TelegramProvider>
                </Sentry.ErrorBoundary>
            </HealthCheckGate>
        </QueryProvider>
    )
}
