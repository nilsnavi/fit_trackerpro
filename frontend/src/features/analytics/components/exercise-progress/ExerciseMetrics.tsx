import { Dumbbell, TrendingUp, Activity, Hash } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface MetricCardProps {
    icon: React.ReactNode
    label: string
    value: string | number | null
    unit?: string
    className?: string
}

function MetricCard({ icon, label, value, unit, className }: MetricCardProps) {
    return (
        <div className={cn('rounded-xl bg-telegram-secondary-bg p-4', className)}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-xs font-medium text-telegram-hint">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-telegram-text">
                        {value ?? '—'}
                        {unit && <span className="ml-1 text-sm font-normal text-telegram-hint">{unit}</span>}
                    </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    {icon}
                </div>
            </div>
        </div>
    )
}

interface ExerciseMetricsProps {
    bestWeight: number | null
    bestVolume: number | null
    avgWeight: number | null
    totalExecutions: number
}

export function ExerciseMetrics({
    bestWeight,
    bestVolume,
    avgWeight,
    totalExecutions,
}: ExerciseMetricsProps) {
    const formatWeight = (weight: number | null) => {
        if (weight === null) return null
        return Math.round(weight)
    }

    const formatVolume = (volume: number | null) => {
        if (volume === null) return null
        return volume >= 1000 
            ? `${(volume / 1000).toFixed(1)}т` 
            : Math.round(volume)
    }

    return (
        <div className="grid grid-cols-2 gap-3">
            <MetricCard
                icon={<Dumbbell className="h-5 w-5" />}
                label="Лучший вес"
                value={formatWeight(bestWeight)}
                unit="кг"
            />
            <MetricCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="Лучший объём"
                value={formatVolume(bestVolume)}
                unit=""
            />
            <MetricCard
                icon={<Activity className="h-5 w-5" />}
                label="Средний вес"
                value={formatWeight(avgWeight)}
                unit="кг"
            />
            <MetricCard
                icon={<Hash className="h-5 w-5" />}
                label="Выполнений"
                value={totalExecutions}
                unit="раз"
            />
        </div>
    )
}
