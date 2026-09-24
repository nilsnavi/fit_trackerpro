import { SimpleLineChart } from '@features/analytics/components/SimpleCharts'

export function ProgressOverviewChartsLazy({
    fatigueRestTrend,
    estimatedOneRmTrend,
    fatigueTrendPoints,
    onChangeFatigueTrendPoints,
    currentEstimated1rm,
    estimated1rmProgressPct,
}: {
    fatigueRestTrend: Array<{ label: string; restSeconds: number | null; fatigueDelta: number | null }>
    estimatedOneRmTrend: Array<{ label: string; value: number }>
    fatigueTrendPoints: 8 | 12
    onChangeFatigueTrendPoints: (value: 8 | 12) => void
    currentEstimated1rm: number | null
    estimated1rmProgressPct: number | null
}) {
    return (
        <>
            <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-telegram-text">Тренд усталости и отдыха</h2>
                        <p className="mt-1 text-xs text-telegram-hint">
                            Небольшой срез по последним сессиям: как менялась субъективная усталость и средние паузы.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="rounded-xl bg-telegram-bg px-3 py-2 text-right">
                            <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Точек</p>
                            <p className="mt-1 text-lg font-semibold text-telegram-text">{fatigueRestTrend.length}</p>
                        </div>
                        <div className="flex items-center gap-1 rounded-xl bg-telegram-bg p-1">
                            {[8, 12].map((value) => {
                                const selected = fatigueTrendPoints === value
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onChangeFatigueTrendPoints(value as 8 | 12)}
                                        className={`rounded-lg px-2.5 py-1 text-xs transition ${selected ? 'bg-primary text-white' : 'text-telegram-hint hover:bg-telegram-secondary-bg'}`}
                                        aria-pressed={selected}
                                    >
                                        {value} сессий
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {fatigueRestTrend.length === 0 ? (
                    <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                        Появится после нескольких завершённых тренировок с данными по RPE или отдыху.
                    </p>
                ) : (
                    <SimpleLineChart
                        data={fatigueRestTrend}
                        labelKey="label"
                        series={[
                            {
                                key: 'fatigueDelta',
                                label: 'Delta fatigue',
                                color: 'hsl(var(--primary))',
                                formatter: (value) => value.toFixed(2),
                            },
                            {
                                key: 'restSeconds',
                                label: 'Rest seconds',
                                color: '#0ea5e9',
                                formatter: (value) => `${Math.round(value)} сек`,
                            },
                        ]}
                    />
                )}
            </section>

            <section className="rounded-2xl bg-telegram-secondary-bg p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-telegram-text">Прогресс силы (оценка 1ПМ)</h2>
                        <p className="mt-1 text-xs text-telegram-hint">
                            Расчёт по лучшему подходу дня: {`1ПМ = вес × (1 + повторы / 30)`}.
                        </p>
                    </div>
                    <div className="rounded-xl bg-telegram-bg px-3 py-2 text-right">
                        <p className="text-[11px] uppercase tracking-wide text-telegram-hint">Текущий 1ПМ</p>
                        <p className="mt-1 text-lg font-semibold text-telegram-text">
                            {currentEstimated1rm != null ? `${currentEstimated1rm.toFixed(1)} кг` : '—'}
                        </p>
                        <p className="mt-1 text-xs text-telegram-hint">
                            {estimated1rmProgressPct != null
                                ? `${estimated1rmProgressPct > 0 ? '+' : ''}${estimated1rmProgressPct.toFixed(1)}%`
                                : 'нет базового значения'}
                        </p>
                    </div>
                </div>

                {estimatedOneRmTrend.length === 0 ? (
                    <p className="rounded-xl bg-telegram-bg px-3 py-2 text-xs text-telegram-hint">
                        Пока недостаточно данных по весам/повторам для расчёта 1ПМ.
                    </p>
                ) : (
                    <SimpleLineChart
                        data={estimatedOneRmTrend}
                        labelKey="label"
                        series={[
                            {
                                key: 'value',
                                label: '1RM',
                                color: 'hsl(var(--primary))',
                                formatter: (value) => `${value.toFixed(1)} кг`,
                            },
                        ]}
                    />
                )}
            </section>
        </>
    )
}

