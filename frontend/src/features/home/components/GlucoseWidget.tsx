import { Droplets, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { GlucoseData } from '@shared/types'

interface GlucoseWidgetProps {
    data: GlucoseData | null
    onClick?: () => void
}

const statusConfig = {
    normal: {
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500',
        icon: Droplets,
        label: 'Норма'
    },
    high: {
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500',
        icon: TrendingUp,
        label: 'Повышен'
    },
    low: {
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500',
        icon: TrendingDown,
        label: 'Понижен'
    },
    critical: {
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500',
        icon: AlertCircle,
        label: 'Критично'
    }
}

export function GlucoseWidget({ data, onClick }: GlucoseWidgetProps) {
    if (!data) {
        return (
            <button
                onClick={onClick}
                className="flex-shrink-0 w-36 bg-telegram-secondary-bg rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
            >
                <div className="w-12 h-12 rounded-full bg-telegram-bg flex items-center justify-center">
                    <Droplets className="w-6 h-6 text-telegram-hint" />
                </div>
                <span className="text-sm text-telegram-hint">Нет данных</span>
                <span className="text-xs text-telegram-hint">Нажмите для ввода</span>
            </button>
        )
    }

    const status = statusConfig[data.status]
    const Icon = status.icon

    return (
        <button
            onClick={onClick}
            className={cn(
                'flex-shrink-0 w-36 rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform',
                'bg-telegram-secondary-bg border-l-4',
                status.borderColor
            )}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-telegram-hint">Глюкоза</span>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', status.bgColor)}>
                    <Icon className={cn('w-4 h-4', status.color)} />
                </div>
            </div>

            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-telegram-text">{data.value}</span>
                <span className="text-xs text-telegram-hint">{data.unit}</span>
            </div>

            <span className={cn('text-xs font-medium', status.color)}>{status.label}</span>
        </button>
    )
}
