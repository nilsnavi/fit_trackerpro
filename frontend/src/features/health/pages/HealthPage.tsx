/** Compact daily dashboard for the health feature. */
import { Suspense, lazy, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Ruler } from 'lucide-react'
import { cn } from '@shared/lib/cn'

const WaterCard = lazy(() =>
    import('@features/health/components/WaterTracker').then((m) => ({ default: m.WaterCompactWidget })),
)
const GlucoseCard = lazy(() =>
    import('@features/health/components/GlucoseTracker').then((m) => ({ default: m.GlucoseCompactWidget })),
)
const WellnessCard = lazy(() =>
    import('@features/health/components/WellnessCheckin').then((m) => ({
        default: m.WellnessCompactWidget,
    })),
)

function CardSkeleton() {
    return <div className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-neutral-800" />
}

function DashboardEntry({
    title,
    description,
    icon,
    onClick,
}: {
    title: string
    description: string
    icon: ReactNode
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'col-span-2 flex w-full items-center gap-3 rounded-2xl bg-telegram-secondary-bg p-4 text-left',
                'transition-transform active:scale-[0.98] sm:col-span-1',
            )}
        >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-telegram-bg">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-telegram-text">{title}</span>
                <span className="mt-1 block text-xs text-telegram-hint">{description}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-telegram-hint" />
        </button>
    )
}

export function HealthPage() {
    const navigate = useNavigate()

    return (
        <div className="space-y-5 p-4">
            <div>
                <p className="text-sm font-medium text-primary">Сегодня</p>
                <h1 className="mt-1 text-xl font-semibold text-telegram-text">Здоровье</h1>
                <p className="mt-1 text-sm text-telegram-hint">Быстрые отметки и актуальные показатели.</p>
            </div>

            <section aria-label="Ежедневные показатели" className="grid grid-cols-2 gap-3">
                <Suspense fallback={<CardSkeleton />}>
                    <WaterCard onClick={() => navigate('/health/water')} className="col-span-1 w-full" />
                </Suspense>
                <Suspense fallback={<CardSkeleton />}>
                    <GlucoseCard onClick={() => navigate('/health/glucose')} className="col-span-1 w-full" />
                </Suspense>
                <Suspense fallback={<CardSkeleton />}>
                    <WellnessCard onClick={() => navigate('/health/wellness')} className="col-span-1 w-full" />
                </Suspense>
                <DashboardEntry
                    title="Замеры тела"
                    description="Обхваты и динамика"
                    icon={<Ruler className="h-5 w-5 text-emerald-500" />}
                    onClick={() => navigate('/health/measurements')}
                />
            </section>
        </div>
    )
}
