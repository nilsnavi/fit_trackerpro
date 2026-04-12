import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@shared/ui/Button'
import { Card } from '@shared/ui/Card'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/**
 * Catches synchronous errors in Telegram initData-dependent UI (e.g. unsafe parsing) without crashing the shell.
 */
export class TelegramInitDataErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(): State {
        return { hasError: true }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.warn('[Telegram] InitData gate error', error, errorInfo)
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-dvh items-center justify-center p-4">
                    <Card variant="info" className="w-full max-w-md">
                        <h1 className="text-lg font-semibold text-telegram-text">Не удалось прочитать данные Telegram</h1>
                        <p className="mt-2 text-sm text-telegram-hint">
                            Попробуйте закрыть Mini App и открыть его снова из бота.
                        </p>
                        <Button
                            type="button"
                            className="mt-4 w-full"
                            onClick={() => this.setState({ hasError: false })}
                        >
                            Попробовать снова
                        </Button>
                    </Card>
                </div>
            )
        }
        return this.props.children
    }
}
