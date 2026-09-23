/**
 * Экран здоровья (WS2-1).
 *
 * Раньше здесь были мок-значения (вес, шаги, пульс, калории) и нарисованный
 * «график» — этих данных нет ни в API, ни в интеграциях. Теперь экран собран
 * из реальных блоков: вода, глюкоза, самочувствие/сон и замеры тела.
 *
 * Блоки ввода (трекеры) подгружаются отдельными чанками: каждый из них большой
 * и нужен не всем, а бюджет асинхронного маршрута — 45 КиБ на чанк.
 */
import { Suspense, lazy, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Droplets, Moon, Ruler } from 'lucide-react'
import { BodyMeasurementsSection } from '@features/health/components/BodyMeasurementsSection'

const WaterBlock = lazy(() =>
    import('@features/health/components/WaterTracker').then((m) => ({ default: m.WaterTracker })),
)
const GlucoseBlock = lazy(() =>
    import('@features/health/components/GlucoseTracker').then((m) => ({ default: m.GlucoseTracker })),
)
const WellnessBlock = lazy(() =>
    import('@features/health/components/WellnessCheckin').then((m) => ({
        default: m.WellnessCheckin,
    })),
)

function BlockSkeleton({ testId }: { testId: string }) {
    return (
        <div
            className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-neutral-800"
            data-testid={testId}
        />
    )
}

function BlockHeading({
    icon,
    title,
    hint,
    action,
}: {
    icon: ReactNode
    title: string
    hint: string
    action?: ReactNode
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-telegram-text">
                    {icon}
                    {title}
                </h2>
                <p className="mt-1 text-xs text-telegram-hint">{hint}</p>
            </div>
            {action}
        </div>
    )
}

export function HealthPage() {
    return (
        <div className="space-y-6 p-4">
            <div>
                <h1 className="text-lg font-semibold text-telegram-text">Здоровье</h1>
                <p className="text-sm text-telegram-hint">
                    Данные, которые вы ведёте сами: вода, глюкоза, самочувствие и замеры тела.
                </p>
            </div>

            <section className="space-y-3" data-testid="health-water-section">
                <BlockHeading
                    icon={<Droplets className="h-4 w-4 text-blue-500" />}
                    title="Вода"
                    hint="Дневная цель и порции — считаются по вашим записям"
                />
                <Suspense fallback={<BlockSkeleton testId="water-block-loading" />}>
                    <WaterBlock />
                </Suspense>
            </section>

            <section className="space-y-3" data-testid="health-glucose-section">
                <BlockHeading
                    icon={<Activity className="h-4 w-4 text-purple-500" />}
                    title="Глюкоза"
                    hint="Замеры и клинический статус по вашим значениям"
                />
                <Suspense fallback={<BlockSkeleton testId="glucose-block-loading" />}>
                    <GlucoseBlock />
                </Suspense>
            </section>

            <section className="space-y-3" data-testid="health-wellness-section">
                <BlockHeading
                    icon={<Moon className="h-4 w-4 text-indigo-500" />}
                    title="Самочувствие и сон"
                    hint="Утренняя отметка: сон, энергия, зоны боли"
                />
                <Suspense fallback={<BlockSkeleton testId="wellness-block-loading" />}>
                    <WellnessBlock />
                </Suspense>
            </section>

            <section className="space-y-3" data-testid="health-measurements-section">
                <BlockHeading
                    icon={<Ruler className="h-4 w-4 text-emerald-500" />}
                    title="Замеры тела"
                    hint="Обхваты в сантиметрах и динамика по каждому замеру"
                    action={
                        <Link to="/profile" className="text-sm font-medium text-primary">
                            Добавить
                        </Link>
                    }
                />
                <BodyMeasurementsSection />
            </section>
        </div>
    )
}
