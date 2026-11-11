/**
 * Блок «Здоровье сегодня» на главной (WS2-2).
 *
 * Показывает только реальные данные: вода (с быстрым добавлением 250 мл),
 * последний замер глюкозы и отметка самочувствия. Пока запросы летят — скелеты,
 * при ошибке — честный текст с повтором, без данных — заглушка внутри виджета.
 */
import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useAddWaterEntryMutation } from '@features/health/hooks/useHealthQueries'
import { useHomeHealthWidgets } from '@features/home/hooks/useHomeHealthWidgets'
import { GlucoseWidget } from './GlucoseWidget'
import { WaterWidget } from './WaterWidget'
import { WellnessWidget } from './WellnessWidget'

export function HomeHealthSection() {
    const { hapticFeedback } = useTelegramWebApp()
    const navigate = useNavigate()
    const healthWidgets = useHomeHealthWidgets()
    const addWater = useAddWaterEntryMutation()

    const handleAddWater = (amount: number) => {
        hapticFeedback({ type: 'impact', style: 'light' })
        addWater.mutate({ amount })
    }

    const openHealth = () => {
        hapticFeedback({ type: 'selection' })
        navigate('/health')
    }

    return (
        <section
            data-testid="home-health-section"
            className="rounded-2xl bg-telegram-secondary-bg p-4"
        >
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-telegram-text">Здоровье сегодня</h2>
                <button
                    type="button"
                    data-testid="home-health-all"
                    onClick={openHealth}
                    className="flex items-center gap-1 rounded-lg px-1 py-1 text-sm font-semibold text-primary active:bg-primary/10"
                >
                    Все
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {healthWidgets.isError ? (
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                    <span className="text-sm text-telegram-hint">
                        Данные здоровья не загрузились
                    </span>
                    <button
                        type="button"
                        data-testid="home-health-retry"
                        onClick={() => void healthWidgets.refetch()}
                        className="text-sm font-semibold text-primary"
                    >
                        Повторить
                    </button>
                </div>
            ) : (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                    {healthWidgets.isPending ? (
                        Array.from({ length: 3 }).map((_, index) => (
                            <div
                                key={index}
                                data-testid="health-widget-skeleton"
                                className="h-[132px] w-36 shrink-0 animate-pulse rounded-2xl bg-telegram-bg"
                            />
                        ))
                    ) : (
                        <>
                            <WaterWidget
                                data={healthWidgets.water}
                                onAddWater={handleAddWater}
                                onClick={openHealth}
                            />
                            <GlucoseWidget data={healthWidgets.glucose} onClick={openHealth} />
                            <WellnessWidget data={healthWidgets.wellness} onClick={openHealth} />
                        </>
                    )}
                </div>
            )}
        </section>
    )
}
