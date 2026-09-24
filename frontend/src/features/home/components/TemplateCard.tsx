import { Dumbbell, Zap, Heart, Activity, Plus } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import type { HomeWorkoutTemplate } from '@shared/types'

interface TemplateCardProps {
    template: HomeWorkoutTemplate
    onClick?: (id: string) => void
}

const iconMap = {
    dumbbell: Dumbbell,
    zap: Zap,
    heart: Heart,
    activity: Activity,
    plus: Plus,
}

const typeColors: Record<string, string> = {
    strength: 'bg-blue-500/20 text-blue-400',
    cardio: 'bg-red-500/20 text-red-400',
    yoga: 'bg-green-500/20 text-green-400',
    functional: 'bg-orange-500/20 text-orange-400',
    custom: 'bg-purple-500/20 text-purple-400',
}

export function TemplateCard({ template, onClick }: TemplateCardProps) {
    const Icon = iconMap[template.icon as keyof typeof iconMap] || Dumbbell
    const isCustom = template.type === 'custom'

    return (
        <button
            type="button"
            onClick={() => onClick?.(template.id)}
            className={cn(
                'flex min-w-[110px] flex-col items-start gap-3 rounded-[14px] p-3 text-left transition-all active:scale-95',
                isCustom
                    ? 'border border-dashed border-[#2a2a2a] bg-transparent'
                    : 'bg-[#1a1a1a]',
            )}
        >
            <div
                className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-[10px]',
                    typeColors[template.type],
                )}
            >
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                    {template.name}
                </p>
                {!isCustom && (
                    <p className="text-xs text-[#888888]">
                        {template.exerciseCount} упр
                    </p>
                )}
            </div>
        </button>
    )
}
