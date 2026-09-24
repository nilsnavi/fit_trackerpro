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
            className="mt-[12px] rounded-[12px] border border-[#171e28] bg-black p-3 shadow-[0_12px_34px_rgba(0,0,0,0.4)]"
        >
            <div className="mb-[14px] flex items-center justify-between">
                <h2 className="text-[17px] font-bold leading-5 text-white">Здоровье сегодня</h2>
                <button
                    type="button"
                    data-testid="home-health-all"
                    onClick={openHealth}
                    className="flex min-h-8 items-center gap-1 rounded-[8px] px-1 text-[13px] font-semibold text-[#168cff] active:bg-white/5"
                >
                    Все
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {healthWidgets.isError ? (
                <div className="flex items-center justify-between rounded-[10px] border border-[#26313e] px-3 py-2">
                    <span className="text-[13px] text-[#8d939c]">
                        Данные здоровья не загрузились
                    </span>
                    <button
                        type="button"
                        data-testid="home-health-retry"
                        onClick={() => void healthWidgets.refetch()}
                        className="text-[13px] font-semibold text-[#168cff]"
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
                                className="h-[132px] w-36 shrink-0 animate-pulse rounded-2xl border border-[#2a3442] bg-[#111821]"
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
