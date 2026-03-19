import { Smile, Frown, Meh, AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@utils/cn'
import type { WellnessData } from '@stores/homeStore'

interface WellnessWidgetProps {
    data: WellnessData | null
    onClick?: () => void
}

const moodConfig = {
    great: {
        icon: Sparkles,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        label: 'Отлично'
    },
    good: {
        icon: Smile,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        label: 'Хорошо'
    },
    okay: {
        icon: Meh,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        label: 'Нормально'
    },
    bad: {
        icon: Frown,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        label: 'Плохо'
    },
    terrible: {
        icon: AlertCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        label: 'Ужасно'
    }
}

export function WellnessWidget({ data, onClick }: WellnessWidgetProps) {
    if (!data) {
        return (
            <button
                onClick={onClick}
                className="flex-shrink-0 w-36 bg-telegram-secondary-bg rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
            >
                <div className="w-12 h-12 rounded-full bg-telegram-bg flex items-center justify-center">
                    <Smile className="w-6 h-6 text-telegram-hint" />
                </div>
                <span className="text-sm text-telegram-hint">Нет данных</span>
                <span className="text-xs text-telegram-hint">Нажмите для оценки</span>
            </button>
        )
    }

    const mood = moodConfig[data.mood]
    const Icon = mood.icon

    return (
        <button
            onClick={onClick}
            className="flex-shrink-0 w-36 bg-telegram-secondary-bg rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform border-l-4 border-purple-500"
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-telegram-hint">Самочувствие</span>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', mood.bgColor)}>
                    <Icon className={cn('w-4 h-4', mood.color)} />
                </div>
            </div>

            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-telegram-text">{data.score}</span>
                <span className="text-xs text-telegram-hint">/10</span>
            </div>

            <span className={cn('text-xs font-medium', mood.color)}>{mood.label}</span>
        </button>
    )
}
