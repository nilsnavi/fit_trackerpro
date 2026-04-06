import React, { lazy, Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import {
    format,
    subDays,
    startOfDay,
    endOfDay,
    parseISO,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    TrendingUp,
    Calendar,
    Dumbbell,
    Download,
    FileText,
    Send,
    ChevronDown,
    Search,
    X,
    Edit3,
    Trophy,
    Activity,
    BarChart3,
    Calculator,
} from 'lucide-react';
import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/Button';
import { Card } from '@shared/ui/Card';
import { Chip, ChipGroup } from '@shared/ui/Chip';
import { Modal } from '@shared/ui/Modal';
import { useTelegramWebApp, UseTelegramWebAppReturn } from '@shared/hooks/useTelegramWebApp';
import { trackBusinessMetric } from '@shared/lib/businessMetrics';
import { AnalyticsPageSkeleton } from '@shared/ui/page-skeletons';
import { useAppShellHeaderRight } from '@app/layouts/AppShellLayoutContext';
import { queryKeys } from '@shared/api/queryKeys';
import { getErrorMessage } from '@shared/errors';
import { useRealAnalytics } from '@shared/config/runtime';
import { toast } from '@shared/stores/toastStore';
import {
    getAnalyticsMuscleLoad,
    getAnalyticsProgress,
    getAnalyticsRecoveryState,
    getAnalyticsSummary,
    getAnalyticsTrainingLoadDaily,
} from '@features/analytics/api/analyticsDomain';
import { buildMockAnalytics } from '@features/analytics/mocks/analyticsMock';
import {
    buildChartDataFromProgress,
    mapKeyMetrics,
    mapProgressToExercises,
} from '@features/analytics/mappers/analyticsMappers';

const OneRMCalculator = lazy(() => import('@features/analytics/components/OneRMCalculator'))

// ============================================
// Types
// ============================================

type PeriodType = '7d' | '30d' | '90d' | 'all' | 'custom';
type ViewTab = 'chart' | 'calculator';
export type AnalyticsScreen = 'overview' | 'exercises' | 'recovery';

interface Exercise {
    id: number;
    name: string;
    category: string;
}

type ApiDate = string; // yyyy-mm-dd

interface ChartDataPoint {
    date: string;
    formattedDate: string;
    [exerciseName: string]: number | string;
}

interface SelectedPoint {
    date: ApiDate;
    exerciseName: string;
    weight: number;
}

interface KeyMetrics {
    totalWorkouts: number;
    avgRestTime: number;
    strengthGrowth: number;
    personalRecords: number;
}

interface ExerciseProgressInsight {
    exercise: Exercise;
    changeKg: number | null;
    changePct: number | null;
    currentWeight: number | null;
    currentDate: ApiDate | null;
    prWeight: number | null;
    prDate: ApiDate | null;
}

interface RecoveryRecommendation {
    title: string;
    body: string;
    tone: 'good' | 'warn' | 'alert';
}

type ProgressPeriod = '7d' | '30d' | '90d' | '1y' | 'all';

type ApiExerciseProgressPoint = {
    date: ApiDate;
    max_weight: number | null;
    reps: number | null;
};

type ApiExerciseProgressSummary = {
    exercise_id: number;
    exercise_name: string;
    progress_percentage: number | null;
};

type ApiExerciseProgressResponse = {
    exercise_id: number;
    exercise_name: string;
    period: string;
    data_points: ApiExerciseProgressPoint[];
    summary: ApiExerciseProgressSummary;
    best_performance?: {
        date: ApiDate;
        weight: number | null;
        reps: number | null;
    } | null;
};

type ApiAnalyticsSummaryResponse = {
    total_workouts: number;
    total_duration: number;
    total_exercises: number;
    current_streak: number;
    longest_streak: number;
    personal_records: unknown[];
    favorite_exercises: unknown[];
    weekly_average: number;
    monthly_average: number;
};

type ApiTrainingLoadDailyEntry = {
    date: ApiDate;
    volume: number;
    fatigueScore: number;
    avgRpe: number | null;
};

type ApiMuscleLoadEntry = {
    date: ApiDate;
    muscleGroup: string;
    loadScore: number;
};

type ApiRecoveryStateResponse = {
    fatigueLevel: number;
    readinessScore: number;
};

// ============================================
// Utility Functions
// ============================================

const toApiPeriod = (period: PeriodType): ProgressPeriod => {
    if (period === '7d') return '7d';
    if (period === '30d') return '30d';
    if (period === '90d') return '90d';
    if (period === 'all') return 'all';
    return '30d';
}

const resolveAnalyticsScreen = (pathname: string): AnalyticsScreen => {
    if (pathname.startsWith('/progress/exercises')) return 'exercises';
    if (pathname.startsWith('/progress/recovery')) return 'recovery';
    return 'overview';
}

const buildDateRangeParams = (
    period: PeriodType,
    customStart?: Date,
    customEnd?: Date,
): { date_from?: string; date_to?: string } => {
    const end = endOfDay(new Date())
    if (period === 'custom') {
        const fallbackStart = startOfDay(subDays(end, 29))
        const safeStart = customStart ? startOfDay(customStart) : fallbackStart
        const safeEnd = customEnd ? endOfDay(customEnd) : end
        return {
            date_from: format(safeStart <= safeEnd ? safeStart : safeEnd, 'yyyy-MM-dd'),
            date_to: format(safeEnd >= safeStart ? safeEnd : safeStart, 'yyyy-MM-dd'),
        }
    }
    const apiPeriod = toApiPeriod(period)
    const daysMap: Record<ProgressPeriod, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, all: 3650 }
    const start = startOfDay(subDays(end, daysMap[apiPeriod] ?? 30))
    return {
        date_from: format(start, 'yyyy-MM-dd'),
        date_to: format(end, 'yyyy-MM-dd'),
    }
}

const generateCSV = (data: ChartDataPoint[], selectedExercises: Exercise[]) => {
    const headers = ['Дата', ...selectedExercises.map(e => e.name)];
    const rows = data.map(row => [
        row.formattedDate,
        ...selectedExercises.map(e => row[e.name] || ''),
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const formatSignedWeight = (value: number | null) => {
    if (value == null) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)} кг`;
}

const formatSignedPercent = (value: number | null) => {
    if (value == null) return '—';
    return `${value > 0 ? '+' : ''}${Math.round(value)}%`;
}

const buildExerciseInsights = (params: {
    progressRows: ApiExerciseProgressResponse[] | undefined;
    selectedExercises: Exercise[];
}): ExerciseProgressInsight[] => {
    const byId = new Map<number, ApiExerciseProgressResponse>()
    for (const row of params.progressRows ?? []) byId.set(row.exercise_id, row)

    return params.selectedExercises.map((exercise) => {
        const row = byId.get(exercise.id)
        const numericPoints = (row?.data_points ?? []).filter(
            (point): point is ApiExerciseProgressPoint & { max_weight: number } => typeof point.max_weight === 'number'
        )

        const firstPoint = numericPoints[0]
        const lastPoint = numericPoints[numericPoints.length - 1]
        const derivedChangeKg =
            firstPoint && lastPoint ? Math.round((lastPoint.max_weight - firstPoint.max_weight) * 10) / 10 : null
        const derivedChangePct =
            firstPoint && lastPoint && firstPoint.max_weight > 0
                ? ((lastPoint.max_weight - firstPoint.max_weight) / firstPoint.max_weight) * 100
                : null

        const bestPoint = numericPoints.reduce<ApiExerciseProgressPoint | null>((best, point) => {
            if (best == null) return point
            if ((point.max_weight ?? -Infinity) > (best.max_weight ?? -Infinity)) return point
            return best
        }, null)

        return {
            exercise,
            changeKg: derivedChangeKg,
            changePct: typeof row?.summary?.progress_percentage === 'number' ? row.summary.progress_percentage : derivedChangePct,
            currentWeight: lastPoint?.max_weight ?? null,
            currentDate: lastPoint?.date ?? null,
            prWeight: row?.best_performance?.weight ?? bestPoint?.max_weight ?? null,
            prDate: row?.best_performance?.date ?? bestPoint?.date ?? null,
        }
    })
}

const buildRecoveryRecommendations = (params: {
    readiness: number | null;
    fatigueLevel: number | null;
    avgRpe: number | null;
    topMuscleLoad: Array<{ muscleGroup: string; loadScore: number }>;
}): RecoveryRecommendation[] => {
    const items: RecoveryRecommendation[] = []

    if (params.readiness != null) {
        if (params.readiness >= 75) {
            items.push({
                title: 'Можно держать план',
                body: 'Готовность высокая. Если техника стабильна, оставляйте рабочий объём без снижения.',
                tone: 'good',
            })
        } else if (params.readiness >= 55) {
            items.push({
                title: 'Держите умеренную нагрузку',
                body: 'Готовность средняя. Лучше избегать лишних добивочных подходов и оставить 1-2 повтора в запасе.',
                tone: 'warn',
            })
        } else {
            items.push({
                title: 'Нужен разгрузочный день',
                body: 'Готовность низкая. Снизьте объём, оставьте лёгкую технику или добавьте восстановление вместо тяжёлой сессии.',
                tone: 'alert',
            })
        }
    }

    if (params.fatigueLevel != null && params.fatigueLevel >= 4) {
        items.push({
            title: 'Усталость накопилась',
            body: 'Высокий fatigue level. Приоритет на сон, гидратацию и уменьшение суммарного тоннажа в ближайшие 1-2 тренировки.',
            tone: 'alert',
        })
    } else if (params.avgRpe != null && params.avgRpe >= 8) {
        items.push({
            title: 'RPE слишком высокий',
            body: 'Средний RPE за период высокий. Сохраните интенсивность только в ключевых упражнениях, а аксессуары сделайте легче.',
            tone: 'warn',
        })
    }

    if (params.topMuscleLoad.length > 0) {
        const dominant = params.topMuscleLoad[0]
        items.push({
            title: `Проверьте восстановление: ${dominant.muscleGroup}`,
            body: `Эта зона получила наибольшую нагрузку (${dominant.loadScore}). Добавьте паузу или снизьте локальный объём, если там есть остаточная забитость.`,
            tone: dominant.loadScore >= 220 ? 'warn' : 'good',
        })
    }

    if (items.length === 0) {
        return [
            {
                title: 'Данных пока мало',
                body: 'Соберите ещё несколько тренировок в выбранном периоде, чтобы рекомендации по восстановлению стали точнее и полезнее.',
                tone: 'warn',
            },
        ]
    }

    return items.slice(0, 3)
}

// ============================================
// Components
// ============================================

const PeriodSelector: React.FC<{
    selected: PeriodType;
    onChange: (period: PeriodType) => void;
    customStart?: Date;
    customEnd?: Date;
    onCustomChange: (start?: Date, end?: Date) => void;
}> = ({ selected, onChange, customStart, customEnd, onCustomChange }) => {
    const today = endOfDay(new Date())
    const defaultCustomStart = startOfDay(subDays(today, 29))

    const periods: { value: PeriodType; label: string }[] = [
        { value: '7d', label: '7 дней' },
        { value: '30d', label: '30 дней' },
        { value: '90d', label: '90 дней' },
        { value: 'all', label: 'Все время' },
        { value: 'custom', label: 'Свой период' },
    ];

    return (
        <div className="space-y-3">
            <ChipGroup wrap>
                {periods.map((period) => (
                    <Chip
                        key={period.value}
                        label={period.label}
                        active={selected === period.value}
                        onClick={() => {
                            if (period.value === 'custom' && (!customStart || !customEnd)) {
                                onCustomChange(customStart ?? defaultCustomStart, customEnd ?? today)
                            }
                            onChange(period.value);
                        }}
                        size="sm"
                    />
                ))}
            </ChipGroup>

            {selected === 'custom' && (
                <div className="flex gap-2 items-center p-3 bg-telegram-secondary-bg rounded-xl">
                    <Calendar className="w-4 h-4 text-telegram-hint" />
                    <input
                        type="date"
                        value={customStart ? format(customStart, 'yyyy-MM-dd') : ''}
                        onChange={(e) => onCustomChange(
                            e.target.value ? parseISO(e.target.value) : undefined,
                            customEnd
                        )}
                        className="bg-transparent text-sm outline-none text-telegram-text"
                    />
                    <span className="text-telegram-hint">—</span>
                    <input
                        type="date"
                        value={customEnd ? format(customEnd, 'yyyy-MM-dd') : ''}
                        onChange={(e) => onCustomChange(
                            customStart,
                            e.target.value ? parseISO(e.target.value) : undefined
                        )}
                        className="bg-transparent text-sm outline-none text-telegram-text"
                    />
                </div>
            )}
        </div>
    );
};

const ExerciseSelector: React.FC<{
    exercises: Exercise[];
    selected: Exercise[];
    onChange: (exercises: Exercise[]) => void;
}> = ({ exercises, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredExercises = useMemo(() => {
        return exercises.filter(e =>
            e.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [exercises, searchQuery]);

    const toggleExercise = (exercise: Exercise) => {
        const isSelected = selected.find(s => s.id === exercise.id);
        if (isSelected) {
            if (selected.length === 1) return;
            onChange(selected.filter(s => s.id !== exercise.id));
        } else if (selected.length < 3) {
            onChange([...selected, exercise]);
        }
    };

    const colors = ['#2481cc', '#28a745', '#dc3545', '#ffc107', '#6f42c1'];

    return (
        <div className="space-y-3">
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        'w-full flex items-center justify-between',
                        'p-3 rounded-xl border border-border',
                        'bg-telegram-bg hover:bg-telegram-secondary-bg',
                        'transition-colors duration-200'
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Dumbbell className="w-4 h-4 text-telegram-hint" />
                        <span className="text-sm text-telegram-text">
                            {selected.length === 0
                                ? 'Выберите упражнения'
                                : `${selected.length} из 3 выбрано`}
                        </span>
                    </div>
                    <ChevronDown className={cn(
                        'w-4 h-4 text-telegram-hint transition-transform',
                        isOpen && 'rotate-180'
                    )} />
                </button>

                {isOpen && (
                    <div className={cn(
                        'absolute z-20 w-full mt-1',
                        'bg-telegram-bg border border-border rounded-xl',
                        'shadow-lg max-h-64 overflow-hidden'
                    )}>
                        <div className="p-2 border-b border-border">
                            <div className="flex items-center gap-2 px-2 py-1.5 bg-telegram-secondary-bg rounded-lg">
                                <Search className="w-4 h-4 text-telegram-hint" />
                                <input
                                    type="text"
                                    placeholder="Поиск упражнений..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent text-sm outline-none text-telegram-text placeholder:text-telegram-hint"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')}>
                                        <X className="w-4 h-4 text-telegram-hint" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-y-auto max-h-48 p-1">
                            {filteredExercises.map((exercise) => {
                                const isSelected = selected.find(s => s.id === exercise.id);
                                const index = selected.findIndex(s => s.id === exercise.id);

                                return (
                                    <button
                                        key={exercise.id}
                                        onClick={() => toggleExercise(exercise)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
                                            'hover:bg-telegram-secondary-bg transition-colors',
                                            'text-left text-sm text-telegram-text'
                                        )}
                                    >
                                        <div className={cn(
                                            'w-4 h-4 rounded border-2 flex items-center justify-center',
                                            isSelected
                                                ? 'border-primary bg-primary'
                                                : 'border-border'
                                        )}>
                                            {isSelected && (
                                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="flex-1">{exercise.name}</span>
                                        {isSelected && (
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: colors[index] }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {selected.length > 0 && (
                <>
                    <div className="text-xs text-telegram-hint">Выберите от 1 до 3 упражнений для сравнения.</div>
                    <ChipGroup wrap>
                        {selected.map((exercise, index) => (
                            <Chip
                                key={exercise.id}
                                label={exercise.name}
                                active={true}
                                onClick={() => toggleExercise(exercise)}
                                size="sm"
                                icon={
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: colors[index] }}
                                    />
                                }
                            />
                        ))}
                    </ChipGroup>
                </>
            )}
        </div>
    );
};

const KeyMetricsCard: React.FC<{ metrics: KeyMetrics; selectedCount: number }> = ({ metrics, selectedCount }) => {
    const items = [
        {
            icon: Activity,
            label: 'Тренировок',
            value: metrics.totalWorkouts,
            color: 'text-blue-500',
        },
        {
            icon: Dumbbell,
            label: 'Выбрано',
            value: selectedCount,
            color: 'text-telegram-text',
        },
        {
            icon: TrendingUp,
            label: 'Рост за период',
            value: `+${metrics.strengthGrowth}%`,
            color: 'text-green-600',
        },
        {
            icon: Trophy,
            label: 'Рекорды',
            value: metrics.personalRecords,
            color: 'text-amber-500',
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
                <Card key={item.label} variant="info" className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <item.icon className={cn('w-4 h-4', item.color)} />
                        <span className="text-xs text-telegram-hint">{item.label}</span>
                    </div>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{item.value}</span>
                </Card>
            ))}
        </div>
    );
};

const PointDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    point: SelectedPoint | null;
    onEdit: () => void;
}> = ({ isOpen, onClose, point, onEdit }) => {
    if (!point) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Детали подхода" size="md">
            <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-telegram-secondary-bg rounded-xl">
                    <span className="text-sm text-telegram-hint">Дата</span>
                    <span className="font-medium text-telegram-text">
                        {format(parseISO(point.date), 'dd MMMM yyyy', { locale: ru })}
                    </span>
                </div>

                <div className="p-3 bg-telegram-secondary-bg rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-telegram-hint">Упражнение</span>
                        <span className="font-medium text-telegram-text">{point.exerciseName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-telegram-hint">Макс. вес</span>
                        <span className="font-medium text-primary">{point.weight} кг</span>
                    </div>
                </div>

                <div className="pt-2">
                    <Button
                        variant="secondary"
                        leftIcon={<Edit3 className="w-4 h-4" />}
                        onClick={onEdit}
                        fullWidth
                    >
                        Редактировать
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const ExportMenu: React.FC<{
    data: ChartDataPoint[];
    selectedExercises: Exercise[];
    tg: UseTelegramWebAppReturn;
}> = ({ data, selectedExercises, tg }) => {
    const [isOpen, setIsOpen] = useState(false);

    const exportCSV = () => {
        const csv = generateCSV(data, selectedExercises);
        downloadFile(csv, 'progress.csv', 'text/csv');
        setIsOpen(false);
    };

    const exportPDF = () => {
        // PDF export would require a library like jsPDF
        // For now, we'll use print to PDF
        window.print();
        setIsOpen(false);
    };

    const sendToTelegram = async () => {
        const csv = generateCSV(data, selectedExercises);

        // Use Telegram WebApp API
        if (tg.isTelegram) {
            tg.hapticFeedback({ type: 'notification', notificationType: 'success' })
            tg.sendData(JSON.stringify({
                type: 'analytics_export',
                data: csv,
            }))
        } else {
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(csv)
                toast.success('Данные скопированы в буфер обмена')
            } catch (err) {
                console.error('Failed to copy:', err)
                toast.error('Не удалось скопировать данные в буфер обмена')
            }
        }

        setIsOpen(false)
    };

    return (
        <div className="relative">
            <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                rightIcon={<ChevronDown className="w-4 h-4" />}
                onClick={() => setIsOpen(!isOpen)}
            >
                Экспорт
            </Button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className={cn(
                        'absolute right-0 top-full mt-1 z-20',
                        'bg-telegram-bg border border-border rounded-xl',
                        'shadow-lg min-w-[160px] overflow-hidden'
                    )}>
                        <button
                            onClick={exportCSV}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-telegram-text hover:bg-telegram-secondary-bg transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Скачать CSV
                        </button>
                        <button
                            onClick={exportPDF}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-telegram-text hover:bg-telegram-secondary-bg transition-colors"
                        >
                            <BarChart3 className="w-4 h-4" />
                            Скачать PDF
                        </button>
                        <button
                            onClick={sendToTelegram}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-telegram-text hover:bg-telegram-secondary-bg transition-colors"
                        >
                            <Send className="w-4 h-4" />
                            В Telegram
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

const CustomTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{ color: string; name: string; value: number }>;
    label?: string;
}> = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="bg-telegram-bg border border-border rounded-xl p-3 shadow-lg">
            <p className="text-sm font-medium text-telegram-text mb-2">{label}</p>
            {payload.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-telegram-text">
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="flex-1">{entry.name}:</span>
                    <span className="font-medium">{entry.value} кг</span>
                </div>
            ))}
        </div>
    );
};

const screenTabs: { path: string; label: string }[] = [
    { path: '/progress', label: 'Сводка' },
    { path: '/progress/exercises', label: 'Упражнения' },
    { path: '/progress/recovery', label: 'Восстановление' },
]

const ProgressScreenTabs: React.FC = () => {
    const tg = useTelegramWebApp()

    return (
        <div className="grid grid-cols-3 gap-2">
            {screenTabs.map((tab) => (
                <NavLink
                    key={tab.path}
                    to={tab.path}
                    onClick={() => tg.hapticFeedback({ type: 'selection' })}
                    className={({ isActive }) =>
                        cn(
                            'touch-manipulation rounded-full border px-3 py-2 text-center text-xs font-medium transition duration-150',
                            'active:scale-[0.985] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            isActive
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-telegram-secondary-bg text-telegram-text'
                        )
                    }
                    end={tab.path === '/progress'}
                >
                    {tab.label}
                </NavLink>
            ))}
        </div>
    )
}

// ============================================
// Main Component
// ============================================

interface AnalyticsProps {
    forcedScreen?: AnalyticsScreen;
}

const Analytics: React.FC<AnalyticsProps> = ({ forcedScreen }) => {
    const { pathname } = useLocation()
    const screen = useMemo(
        () => forcedScreen ?? resolveAnalyticsScreen(pathname),
        [forcedScreen, pathname],
    )
    const isOverviewScreen = screen === 'overview'
    const isExerciseScreen = screen === 'exercises'
    const isRecoveryScreen = screen === 'recovery'

    const [period, setPeriod] = useState<PeriodType>('30d');
    const [customStart, setCustomStart] = useState<Date>();
    const [customEnd, setCustomEnd] = useState<Date>();
    const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
    const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ViewTab>('chart');

    const tg = useTelegramWebApp();

    useEffect(() => {
        trackBusinessMetric('viewed_analytics');
    }, []);

    // Определяем цвета для графика в зависимости от темы
    const isDark = document.documentElement.classList.contains('dark');
    const chartColors = {
        grid: isDark ? '#444444' : '#e5e5e5',
        tick: isDark ? '#888888' : '#666666',
        label: isDark ? '#888888' : '#666666',
        dotFill: isDark ? '#1a1a1a' : '#ffffff',
    };

    const apiPeriod = toApiPeriod(period)
    const maxExercises = 50
    const maxDataPoints = 120
    const isReal = useRealAnalytics()
    const dateRange = useMemo(
        () => buildDateRangeParams(period, customStart, customEnd),
        [period, customStart, customEnd],
    )

    const summaryQuery = useQuery({
        queryKey: queryKeys.analytics.summary(apiPeriod, dateRange.date_from ?? null, dateRange.date_to ?? null),
        queryFn: () =>
            getAnalyticsSummary({
                period: apiPeriod,
                ...(dateRange.date_from ? { date_from: dateRange.date_from } : {}),
                ...(dateRange.date_to ? { date_to: dateRange.date_to } : {}),
            }),
        enabled: isReal && !isRecoveryScreen,
    })

    const progressQuery = useQuery({
        queryKey: queryKeys.analytics.progress(
            apiPeriod,
            maxExercises,
            maxDataPoints,
            dateRange.date_from ?? null,
            dateRange.date_to ?? null,
        ),
        queryFn: () =>
            getAnalyticsProgress({
                period: apiPeriod,
                ...(dateRange.date_from ? { date_from: dateRange.date_from } : {}),
                ...(dateRange.date_to ? { date_to: dateRange.date_to } : {}),
                max_exercises: maxExercises,
                max_data_points: maxDataPoints,
            }),
        enabled: isReal && !isRecoveryScreen,
    })

    const trainingLoadQuery = useQuery({
        queryKey: queryKeys.analytics.trainingLoadDaily(dateRange.date_from ?? null, dateRange.date_to ?? null),
        queryFn: () => getAnalyticsTrainingLoadDaily(dateRange),
        staleTime: 60_000,
        enabled: isReal && isRecoveryScreen,
    })

    const muscleLoadQuery = useQuery({
        queryKey: queryKeys.analytics.muscleLoad(dateRange.date_from ?? null, dateRange.date_to ?? null),
        queryFn: () => getAnalyticsMuscleLoad(dateRange),
        staleTime: 60_000,
        enabled: isReal && isRecoveryScreen,
    })

    const recoveryStateQuery = useQuery({
        queryKey: queryKeys.analytics.recoveryState,
        queryFn: () => getAnalyticsRecoveryState(),
        staleTime: 60_000,
        enabled: isReal && isRecoveryScreen,
    })

    const mock = useMemo(() => {
        if (isReal) return null
        const date_from = dateRange.date_from ?? format(startOfDay(subDays(new Date(), 30)), 'yyyy-MM-dd')
        const date_to = dateRange.date_to ?? format(endOfDay(new Date()), 'yyyy-MM-dd')
        return buildMockAnalytics({ date_from, date_to, period: apiPeriod })
    }, [apiPeriod, dateRange.date_from, dateRange.date_to, isReal])

    const summary: ApiAnalyticsSummaryResponse | undefined = isReal ? summaryQuery.data : mock?.summary
    const progressRows: ApiExerciseProgressResponse[] | undefined = isReal ? progressQuery.data : mock?.progress
    const trainingLoadRows: ApiTrainingLoadDailyEntry[] | undefined = isReal ? trainingLoadQuery.data : mock?.trainingLoadDaily
    const muscleLoadRows: ApiMuscleLoadEntry[] | undefined = isReal ? muscleLoadQuery.data : mock?.muscleLoad
    const recoveryState: ApiRecoveryStateResponse | undefined = isReal ? recoveryStateQuery.data : mock?.recoveryState

    const isAnalyticsPending = isReal && !isRecoveryScreen && (summaryQuery.isPending || progressQuery.isPending)
    const isAnalyticsError = isReal && !isRecoveryScreen && (summaryQuery.isError || progressQuery.isError)

    const exercises = useMemo((): Exercise[] => {
        return mapProgressToExercises(progressRows)
    }, [progressRows])

    useEffect(() => {
        if (selectedExercises.length > 0) return
        if (exercises.length === 0) return
        setSelectedExercises(exercises.slice(0, 1))
    }, [exercises, selectedExercises.length])

    // Prepare chart data
    const chartData = useMemo((): ChartDataPoint[] => {
        return buildChartDataFromProgress({ progressRows, selectedExercises })
    }, [progressRows, selectedExercises]);

    // Calculate metrics
    const metrics = useMemo((): KeyMetrics => {
        return mapKeyMetrics({ summary, progressRows, selectedExercises })
    }, [summary, progressRows, selectedExercises]);

    const exerciseInsights = useMemo(
        () => buildExerciseInsights({ progressRows, selectedExercises }),
        [progressRows, selectedExercises],
    )

    const loadCards = useMemo(() => {
        const training = trainingLoadRows ?? []
        const totalVolume = training.reduce((acc, x) => acc + (Number(x.volume) || 0), 0)
        const totalFatigue = training.reduce((acc, x) => acc + (Number(x.fatigueScore) || 0), 0)
        const avgRpeValues = training.map((x) => x.avgRpe).filter((x): x is number => typeof x === 'number')
        const avgRpe = avgRpeValues.length ? avgRpeValues.reduce((a, b) => a + b, 0) / avgRpeValues.length : null

        const recovery = recoveryState
        const readiness = recovery?.readinessScore ?? null
        const fatigueLevel = recovery?.fatigueLevel ?? null

        return {
            totalVolume: Math.round(totalVolume),
            totalFatigue: Math.round(totalFatigue),
            avgRpe: avgRpe != null ? Math.round(avgRpe * 10) / 10 : null,
            readiness: readiness != null ? Math.round(readiness) : null,
            fatigueLevel,
        }
    }, [recoveryState, trainingLoadRows])

    const topMuscleLoad = useMemo(() => {
        const rows = muscleLoadRows ?? []
        const byGroup = new Map<string, number>()
        for (const r of rows) {
            const k = r.muscleGroup
            byGroup.set(k, (byGroup.get(k) ?? 0) + (Number(r.loadScore) || 0))
        }
        return [...byGroup.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([muscleGroup, loadScore]) => ({ muscleGroup, loadScore: Math.round(loadScore) }))
    }, [muscleLoadRows])

    const recoveryRecommendations = useMemo(
        () =>
            buildRecoveryRecommendations({
                readiness: loadCards.readiness,
                fatigueLevel: loadCards.fatigueLevel,
                avgRpe: loadCards.avgRpe,
                topMuscleLoad,
            }),
        [loadCards.avgRpe, loadCards.fatigueLevel, loadCards.readiness, topMuscleLoad],
    )

    const muscleLoadSummary = useMemo(() => {
        if (topMuscleLoad.length === 0) {
            return 'Нет данных по мышечной нагрузке за выбранный период.'
        }
        const primary = topMuscleLoad[0]
        const secondary = topMuscleLoad[1]
        if (!secondary) {
            return `Основная нагрузка пришлась на ${primary.muscleGroup}. Проверьте, успевает ли эта зона восстанавливаться между тренировками.`
        }
        const spread = primary.loadScore - secondary.loadScore
        if (spread >= 40) {
            return `Доминирует ${primary.muscleGroup}: нагрузка заметно выше, чем у ${secondary.muscleGroup}. Имеет смысл снизить локальный объём или добавить восстановление этой зоны.`
        }
        return `Нагрузка распределена относительно ровно между ${primary.muscleGroup.toLowerCase()} и ${secondary.muscleGroup.toLowerCase()}. Это хороший сигнал по балансу программы.`
    }, [topMuscleLoad])

    // Handle chart click
    const handleChartClick = useCallback((data: { activeLabel?: string; activePayload?: unknown[] } | undefined) => {
        if (!data || !data.activeLabel || !data.activePayload) return;

        const formatted = data.activeLabel;
        const row = chartData.find((d) => d.formattedDate === formatted)
        if (!row) return

        let best: { name: string; weight: number } | null = null
        for (const ex of selectedExercises) {
            const v = row[ex.name]
            if (typeof v === 'number') {
                if (!best || v > best.weight) best = { name: ex.name, weight: v }
            }
        }
        if (!best) return
        setSelectedPoint({
            date: row.date,
            exerciseName: best.name,
            weight: best.weight,
        })
        setIsModalOpen(true)
    }, [chartData, selectedExercises]);

    // Colors for chart lines
    const lineColors = ['#2481cc', '#28a745', '#dc3545', '#ffc107', '#6f42c1'];

    const analyticsHeaderExport = useMemo(
        () =>
            isExerciseScreen && activeTab === 'chart' ? (
                <ExportMenu data={chartData} selectedExercises={selectedExercises} tg={tg} />
            ) : null,
        [activeTab, chartData, isExerciseScreen, selectedExercises, tg],
    );

    useAppShellHeaderRight(analyticsHeaderExport);

    if (isAnalyticsPending) {
        return <AnalyticsPageSkeleton />;
    }

    if (isAnalyticsError) {
        const err = summaryQuery.error ?? progressQuery.error
        return (
            <div className="bg-telegram-bg p-4">
                <Card variant="info" className="p-4">
                    <div className="text-sm font-medium text-telegram-text mb-1">Не удалось загрузить аналитику</div>
                    <div className="text-xs text-telegram-hint mb-4">{getErrorMessage(err)}</div>
                    <Button
                        onClick={() => {
                            summaryQuery.refetch()
                            progressQuery.refetch()
                        }}
                    >
                        Повторить
                    </Button>
                </Card>
            </div>
        )
    }

    return (
        <div className="bg-telegram-bg">
            <div className="sticky top-0 z-10 border-b border-border bg-telegram-bg/95 backdrop-blur-sm">
                <div className="space-y-3 px-4 py-3">
                    <ProgressScreenTabs />
                    {isExerciseScreen && (
                        <ChipGroup>
                            <Chip
                                label="Прогресс"
                                active={activeTab === 'chart'}
                                onClick={() => {
                                    tg.hapticFeedback({ type: 'selection' })
                                    setActiveTab('chart')
                                }}
                                icon={<TrendingUp className="w-4 h-4" />}
                            />
                            <Chip
                                label="1ПМ Калькулятор"
                                active={activeTab === 'calculator'}
                                onClick={() => {
                                    tg.hapticFeedback({ type: 'selection' })
                                    setActiveTab('calculator')
                                }}
                                icon={<Calculator className="w-4 h-4" />}
                            />
                        </ChipGroup>
                    )}
                </div>
            </div>

            {isOverviewScreen && (
                <div className="space-y-5 p-4">
                    <Card variant="info" className="animate-progress-overview-in p-4">
                        <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            Прогресс
                        </div>
                        <h1 className="mt-3 text-lg font-semibold leading-tight text-telegram-text">Один экран = одна цель</h1>
                        <p className="mt-2 text-sm text-telegram-hint">
                            Сначала выберите фокус, затем работайте только с нужными метриками без перегруза.
                        </p>
                    </Card>

                    <section className="animate-progress-overview-in progress-overview-delay-1">
                        <h2 className="mb-3 text-sm font-medium text-telegram-hint">Быстрый выбор фокуса</h2>
                        <div className="grid gap-3">
                            <NavLink
                                to="/progress/exercises"
                                className="block touch-manipulation rounded-2xl transition duration-150 active:scale-[0.985] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                onClick={() => tg.hapticFeedback({ type: 'selection' })}
                            >
                                <Card variant="info" className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-base font-semibold text-telegram-text">Прогресс упражнений</div>
                                            <div className="mt-1 text-xs text-telegram-hint">
                                                График веса, сравнение упражнений и статистика прироста.
                                            </div>
                                        </div>
                                        <Dumbbell className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="rounded-full bg-telegram-secondary-bg px-2 py-1 text-[11px] text-telegram-hint">График</span>
                                        <span className="rounded-full bg-telegram-secondary-bg px-2 py-1 text-[11px] text-telegram-hint">Сравнение</span>
                                        <span className="rounded-full bg-telegram-secondary-bg px-2 py-1 text-[11px] text-telegram-hint">Статистика</span>
                                    </div>
                                </Card>
                            </NavLink>

                            <NavLink
                                to="/progress/recovery"
                                className="block touch-manipulation rounded-2xl transition duration-150 active:scale-[0.985] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                onClick={() => tg.hapticFeedback({ type: 'selection' })}
                            >
                                <Card variant="info" className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-base font-semibold text-telegram-text">Восстановление</div>
                                            <div className="mt-1 text-xs text-telegram-hint">
                                                Нагрузка, усталость, готовность и мышечный стресс.
                                            </div>
                                        </div>
                                        <Activity className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="rounded-full bg-telegram-secondary-bg px-2 py-1 text-[11px] text-telegram-hint">Нагрузка</span>
                                        <span className="rounded-full bg-telegram-secondary-bg px-2 py-1 text-[11px] text-telegram-hint">RPE</span>
                                        <span className="rounded-full bg-telegram-secondary-bg px-2 py-1 text-[11px] text-telegram-hint">Готовность</span>
                                    </div>
                                </Card>
                            </NavLink>
                        </div>
                    </section>

                    <section className="animate-progress-overview-in progress-overview-delay-2">
                        <h2 className="mb-3 text-sm font-medium text-telegram-hint">Короткая сводка</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Тренировок</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{summary?.total_workouts ?? 0}</div>
                            </Card>
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Серия дней</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{summary?.current_streak ?? 0}</div>
                            </Card>
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Личный рекорд</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{summary?.personal_records?.length ?? 0}</div>
                            </Card>
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Рост силы</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">+{metrics.strengthGrowth}%</div>
                            </Card>
                        </div>
                    </section>
                </div>
            )}

            {isExerciseScreen && activeTab === 'chart' && (
                <div className="space-y-6 p-4">
                    <section>
                        <h2 className="mb-3 text-sm font-medium text-gray-500">Период</h2>
                        <PeriodSelector
                            selected={period}
                            onChange={setPeriod}
                            customStart={customStart}
                            customEnd={customEnd}
                            onCustomChange={(start, end) => {
                                setCustomStart(start)
                                setCustomEnd(end)
                            }}
                        />
                        {period === 'custom' && dateRange.date_from && dateRange.date_to && (
                            <p className="mt-2 text-xs text-telegram-hint">
                                Период: {format(parseISO(dateRange.date_from), 'd MMM', { locale: ru })} - {format(parseISO(dateRange.date_to), 'd MMM yyyy', { locale: ru })}
                            </p>
                        )}
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-medium text-gray-500">Упражнения для сравнения</h2>
                        <ExerciseSelector
                            exercises={exercises}
                            selected={selectedExercises}
                            onChange={setSelectedExercises}
                        />
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-medium text-telegram-hint">Сразу видно прогресс</h2>
                        <KeyMetricsCard metrics={metrics} selectedCount={selectedExercises.length} />
                    </section>

                    <section>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h2 className="text-sm font-medium text-telegram-hint">Изменение за период</h2>
                            <div className="text-xs text-telegram-hint">Текущее значение против первого в периоде</div>
                        </div>
                        <div className="space-y-3">
                            {exerciseInsights.map((insight, index) => (
                                <Card key={insight.exercise.id} variant="info" className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="h-3 w-3 rounded-full"
                                                    style={{ backgroundColor: lineColors[index] }}
                                                />
                                                <div className="text-sm font-semibold text-telegram-text">{insight.exercise.name}</div>
                                            </div>
                                            <div className="mt-1 text-xs text-telegram-hint">
                                                {insight.currentDate
                                                    ? `Последнее обновление ${format(parseISO(insight.currentDate), 'd MMM', { locale: ru })}`
                                                    : 'Недостаточно данных за период'}
                                            </div>
                                        </div>
                                        <div
                                            className={cn(
                                                'rounded-full px-2.5 py-1 text-xs font-medium',
                                                (insight.changeKg ?? 0) >= 0
                                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                    : 'bg-red-500/10 text-red-500 dark:text-red-400'
                                            )}
                                        >
                                            {formatSignedPercent(insight.changePct)}
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl bg-telegram-secondary-bg p-3">
                                            <div className="text-xs text-telegram-hint">Текущий максимум</div>
                                            <div className="mt-1 text-lg font-semibold text-telegram-text">
                                                {insight.currentWeight != null ? `${insight.currentWeight.toFixed(1)} кг` : '—'}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-telegram-secondary-bg p-3">
                                            <div className="text-xs text-telegram-hint">Изменение</div>
                                            <div
                                                className={cn(
                                                    'mt-1 text-lg font-semibold',
                                                    (insight.changeKg ?? 0) >= 0
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-red-500 dark:text-red-400'
                                                )}
                                            >
                                                {formatSignedWeight(insight.changeKg)}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-medium text-telegram-hint">Прогресс</h2>
                        <Card variant="info" className="p-4">
                            {selectedExercises.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-telegram-hint">
                                    <TrendingUp className="mb-3 h-12 w-12 opacity-50" />
                                    <p>Выберите упражнения для отображения графика</p>
                                </div>
                            ) : chartData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-telegram-hint">
                                    <Calendar className="mb-3 h-12 w-12 opacity-50" />
                                    <p>Нет данных за выбранный период</p>
                                </div>
                            ) : (
                                <div className="-mx-2 h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={chartData}
                                            onClick={handleChartClick}
                                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.5} />
                                            <XAxis
                                                dataKey="formattedDate"
                                                tick={{ fontSize: 12, fill: chartColors.tick }}
                                                stroke={chartColors.grid}
                                                minTickGap={24}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12, fill: chartColors.tick }}
                                                stroke={chartColors.grid}
                                                label={{
                                                    value: 'кг',
                                                    angle: -90,
                                                    position: 'insideLeft',
                                                    style: { fill: chartColors.label, fontSize: 12 },
                                                }}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ paddingTop: 16 }} iconType="circle" />
                                            {selectedExercises.map((exercise, index) => (
                                                <Line
                                                    key={exercise.id}
                                                    type="monotone"
                                                    dataKey={exercise.name}
                                                    stroke={lineColors[index]}
                                                    strokeWidth={2}
                                                    dot={{ r: 4, strokeWidth: 2, fill: chartColors.dotFill }}
                                                    activeDot={{ r: 6, strokeWidth: 2 }}
                                                    connectNulls
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            <p className="mt-2 text-center text-xs text-telegram-hint">
                                Каждая линия показывает лучший вес по дате. Нажмите на точку для деталей.
                            </p>
                        </Card>
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-medium text-telegram-hint">PR</h2>
                        <div className="grid gap-3">
                            {exerciseInsights.map((insight, index) => (
                                <Card key={`${insight.exercise.id}-pr`} variant="info" className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Trophy className="h-4 w-4 text-amber-500" />
                                                <div className="text-sm font-semibold text-telegram-text">{insight.exercise.name}</div>
                                            </div>
                                            <div className="mt-1 text-xs text-telegram-hint">
                                                {insight.prDate
                                                    ? `Личный рекорд зафиксирован ${format(parseISO(insight.prDate), 'd MMM yyyy', { locale: ru })}`
                                                    : 'Пока нет PR по доступным данным'}
                                            </div>
                                        </div>
                                        <div
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: lineColors[index] }}
                                        />
                                    </div>
                                    <div className="mt-4 rounded-2xl bg-telegram-secondary-bg p-3">
                                        <div className="text-xs text-telegram-hint">Лучший вес</div>
                                        <div className="mt-1 text-xl font-semibold text-telegram-text">
                                            {insight.prWeight != null ? `${insight.prWeight.toFixed(1)} кг` : '—'}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {isExerciseScreen && activeTab === 'calculator' && (
                <div className="p-4">
                    <Suspense fallback={<AnalyticsPageSkeleton />}>
                        <OneRMCalculator />
                    </Suspense>
                </div>
            )}

            {isRecoveryScreen && (
                <div className="space-y-6 p-4">
                    <section>
                        <h2 className="mb-3 text-sm font-medium text-gray-500">Период</h2>
                        <PeriodSelector
                            selected={period}
                            onChange={setPeriod}
                            customStart={customStart}
                            customEnd={customEnd}
                            onCustomChange={(start, end) => {
                                setCustomStart(start)
                                setCustomEnd(end)
                            }}
                        />
                        {period === 'custom' && dateRange.date_from && dateRange.date_to && (
                            <p className="mt-2 text-xs text-telegram-hint">
                                Период: {format(parseISO(dateRange.date_from), 'd MMM', { locale: ru })} - {format(parseISO(dateRange.date_to), 'd MMM yyyy', { locale: ru })}
                            </p>
                        )}
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-medium text-telegram-hint">Нагрузка и восстановление</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Объём (период)</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                                    {isReal && trainingLoadQuery.isPending ? '—' : loadCards.totalVolume}
                                </div>
                            </Card>
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Усталость (период)</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                                    {isReal && trainingLoadQuery.isPending ? '—' : loadCards.totalFatigue}
                                </div>
                            </Card>
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Средний RPE</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                                    {isReal && trainingLoadQuery.isPending ? '—' : (loadCards.avgRpe ?? '—')}
                                </div>
                            </Card>
                            <Card variant="info" className="p-3">
                                <div className="text-xs text-telegram-hint">Готовность</div>
                                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                                    {isReal && recoveryStateQuery.isPending ? '—' : (loadCards.readiness ?? '—')}
                                </div>
                                {loadCards.fatigueLevel != null && (
                                    <div className="mt-1 text-xs text-telegram-hint">Уровень усталости: {loadCards.fatigueLevel}</div>
                                )}
                            </Card>
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-medium text-telegram-hint">Рекомендации</h2>
                        <div className="space-y-3">
                            {recoveryRecommendations.map((item) => (
                                <Card key={item.title} variant="info" className="p-4">
                                    <div
                                        className={cn(
                                            'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                                            item.tone === 'good' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                                            item.tone === 'warn' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                            item.tone === 'alert' && 'bg-red-500/10 text-red-500 dark:text-red-400'
                                        )}
                                    >
                                        {item.title}
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-telegram-text">{item.body}</p>
                                </Card>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 text-sm font-medium text-telegram-hint">Сводка по мышечной нагрузке</h2>
                        <Card variant="info" className="p-4">
                            <p className="text-sm leading-6 text-telegram-text">{muscleLoadSummary}</p>
                            {topMuscleLoad.length > 0 && (
                                <div className="mt-4 space-y-3">
                                    {topMuscleLoad.map((row, index) => (
                                        <div key={row.muscleGroup}>
                                            <div className="mb-1 flex items-center justify-between text-sm">
                                                <div className="text-telegram-text">{row.muscleGroup}</div>
                                                <div className="font-medium text-telegram-text">{row.loadScore}</div>
                                            </div>
                                            <div className="h-2 rounded-full bg-telegram-secondary-bg">
                                                <div
                                                    className={cn(
                                                        'h-2 rounded-full',
                                                        index === 0 && 'bg-primary',
                                                        index === 1 && 'bg-green-500',
                                                        index >= 2 && 'bg-amber-500'
                                                    )}
                                                    style={{ width: `${Math.min(100, Math.max(12, row.loadScore / Math.max(topMuscleLoad[0].loadScore, 1) * 100))}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </section>
                </div>
            )}

            {/* Point Details Modal */}
            <PointDetailsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                point={selectedPoint}
                onEdit={() => {
                    // Edit-by-point isn't implemented yet for real API data.
                    tg.hapticFeedback({ type: 'selection' })
                    setIsModalOpen(false)
                }}
            />
        </div>
    );
};

export default Analytics;
