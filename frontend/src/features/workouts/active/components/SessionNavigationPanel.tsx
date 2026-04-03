import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react'
import { Button } from '@shared/ui/Button'

interface SessionNavigationPanelProps {
    hasPrev: boolean
    hasNextSet: boolean
    hasNextExercise: boolean
    onBack: () => void
    onNextSet: () => void
    onNextExercise: () => void
    onSkip: () => void
}

export function SessionNavigationPanel({
    hasPrev,
    hasNextSet,
    hasNextExercise,
    onBack,
    onNextSet,
    onNextExercise,
    onSkip,
}: SessionNavigationPanelProps) {
    return (
        <div className="rounded-xl border border-border bg-telegram-secondary-bg p-3 space-y-2">
            <p className="text-xs text-telegram-hint">Навигация по сессии</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<ChevronLeft className="h-4 w-4" />}
                    disabled={!hasPrev}
                    onClick={onBack}
                >
                    Назад
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<ChevronRight className="h-4 w-4" />}
                    disabled={!hasNextSet && !hasNextExercise}
                    onClick={onNextSet}
                >
                    Следующий подход
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<SkipForward className="h-4 w-4" />}
                    disabled={!hasNextExercise}
                    onClick={onNextExercise}
                >
                    Следующее упражнение
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<SkipForward className="h-4 w-4" />}
                    disabled={!hasNextSet && !hasNextExercise}
                    onClick={onSkip}
                >
                    Пропустить
                </Button>
            </div>
        </div>
    )
}
