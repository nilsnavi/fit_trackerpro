import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function TrendMixedTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean
    payload?: Array<{ value: number; dataKey?: string; name?: string }>
    label?: string
}) {
    if (!active || !payload || payload.length === 0) return null

    const fatiguePoint = payload.find((item) => item.dataKey === 'fatigueDelta')
    const restPoint = payload.find((item) => item.dataKey === 'restSeconds')

    return (
        <div className="rounded-xl border border-border bg-telegram-bg px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-telegram-text">{label}</p>
            {fatiguePoint ? (
                <p className="mt-1 text-xs text-telegram-hint">Δ усталости: {Number(fatiguePoint.value).toFixed(2)}</p>
            ) : null}
            {restPoint ? (
                <p className="text-xs text-telegram-hint">Средний отдых: {Math.round(Number(restPoint.value))} сек</p>
            ) : null}
        </div>
    )
}

function OneRMTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean
    payload?: Array<{ value: number }>
    label?: string
}) {
    if (!active || !payload || payload.length === 0) return null
    const value = Number(payload[0]?.value ?? 0)
    return (
        <div className="rounded-xl border border-border bg-telegram-bg px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-telegram-text">{label}</p>
            <p className="mt-1 text-xs text-telegram-hint">Оценка 1ПМ: {value.toFixed(1)} кг</p>
        </div>
    )
}

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
                    <div className="-mx-2 h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fatigueRestTrend} margin={{ top: 8, right: 14, left: 6, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                                <YAxis yAxisId="fatigue" tick={{ fontSize: 11 }} width={44} domain={[-3, 3]} />
                                <YAxis yAxisId="rest" orientation="right" tick={{ fontSize: 11 }} width={44} />
                                <Tooltip content={<TrendMixedTooltip />} />
                                <Line
                                    yAxisId="fatigue"
                                    type="monotone"
                                    dataKey="fatigueDelta"
                                    name="Δ усталости"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    dot={{ r: 2.5 }}
                                    connectNulls
                                />
                                <Line
                                    yAxisId="rest"
                                    type="monotone"
                                    dataKey="restSeconds"
                                    name="Отдых, сек"
                                    stroke="#0ea5e9"
                                    strokeWidth={2}
                                    dot={{ r: 2.5 }}
                                    connectNulls
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
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
                    <div className="-mx-2 h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={estimatedOneRmTrend} margin={{ top: 8, right: 14, left: 6, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                                <YAxis tick={{ fontSize: 11 }} width={44} />
                                <Tooltip content={<OneRMTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    dot={{ r: 2.5 }}
                                    connectNulls
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>
        </>
    )
}

