import { AlertCircle } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Button } from './Button'
import { getErrorMessage } from '@shared/errors'

export interface InlineErrorProps {
    error: unknown
    onRetry?: () => void
    className?: string
}

/**
 * InlineError — compact error display for inside-page failures (e.g. a failed
 * section query). Differs from RouteErrorBoundary which covers the full screen.
 *
 * @example
 * {isError && <InlineError error={error} onRetry={() => refetch()} />}
 */
export function InlineError({ error, onRetry, className }: InlineErrorProps) {
    const message = getErrorMessage(error)

    return (
        <div
            role="alert"
            className={cn(
                'flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm',
                className,
            )}
        >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            <div className="min-w-0 flex-1">
                <p className="text-danger">{message}</p>
                {onRetry && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRetry}
                        className="mt-2 -ml-2 text-danger hover:bg-danger/10"
                    >
                        Повторить
                    </Button>
                )}
            </div>
        </div>
    )
}
