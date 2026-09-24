import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Dumbbell } from 'lucide-react'
import { format, subDays } from 'date-fns'
import {
    ExerciseSelector,
    ExerciseMetrics,
    ExerciseWeightChart,
    ExerciseVolumeChart,
    ExerciseSetHistory,
} from '@features/analytics/components/exercise-progress'
import { useExerciseProgress, useExercisesList } from '@features/analytics/hooks/useExerciseProgress'
import { ProgressPeriodFilter } from '@features/analytics/components/ProgressPeriodFilter'
import { PROGRESS_PERIODS } from '@features/analytics/lib/progressDateRange'
import { SectionEmptyState } from '@shared/ui/SectionEmptyState'
import { ExerciseProgressSkeleton } from '@features/analytics/components/exercise-progress/ExerciseProgressSkeleton'

export function ExerciseProgressPage() {
    const navigate = useNavigate()
    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
    const [datePreset, setDatePreset] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

    // Вычисляем диапазон дат
    const dateRange = useMemo(() => {
        if (datePreset === 'all') return { dateFrom: null, dateTo: null }
        
        const days = datePreset === '7d' ? 7 : datePreset === '30d' ? 30 : 90
        const dateTo = new Date()
        const dateFrom = subDays(dateTo, days - 1)
        
        return {
            dateFrom: format(dateFrom, 'yyyy-MM-dd'),
            dateTo: format(dateTo, 'yyyy-MM-dd'),
        }
    }, [datePreset])

    // Получаем список упражнений
    const { exercises, isLoading: isLoadingExercises } = useExercisesList(
        dateRange.dateFrom,
        dateRange.dateTo
    )

    // Получаем прогресс по выбранному упражнению
    const {
        data: progressData,
        isLoading: isProgressLoading,
    } = useExerciseProgress({
        exerciseId: selectedExerciseId,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
    })

    // Формируем историю подходов для отображения
    const setHistory = useMemo(() => {
        if (!progressData || !progressData.dates.length) return []

        return progressData.dates.map((date, index) => ({
            date,
            weight: progressData.weights[index],
            reps: progressData.reps[index],
            sets: progressData.sets[index],
        }))
    }, [progressData])

    // Показываем skeleton при загрузке списка упражнений
    if (isLoadingExercises) {
        return <ExerciseProgressSkeleton />
    }

    // Если нет упражнений
    if (exercises.length === 0) {
        return (
            <div className="p-4">
                <SectionEmptyState
                    icon={Dumbbell}
                    title="Нет данных"
                    description="У вас пока нет завершённых тренировок с упражнениями. Начните тренироваться, чтобы увидеть прогресс!"
                    primaryAction={{
                        label: 'Начать тренировку',
                        onClick: () => navigate('/workouts/active/new'),
                    }}
                />
            </div>
        )
    }

    // Автоматически выбираем первое упражнение, если ничего не выбрано
    if (!selectedExerciseId && exercises.length > 0) {
        setSelectedExerciseId(exercises[0].id)
        return <ExerciseProgressSkeleton />
    }

    return (
        <div className="space-y-4 p-4 pb-24">
            {/* Заголовок и кнопка назад */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="rounded-lg p-2 transition-colors hover:bg-telegram-secondary-bg"
                >
                    <ChevronLeft className="h-5 w-5 text-telegram-text" />
                </button>
                <h1 className="text-lg font-semibold text-telegram-text">Прогресс упражнения</h1>
            </div>

            {/* Фильтр по периоду */}
            <ProgressPeriodFilter
                value={datePreset}
                onChange={setDatePreset}
                options={PROGRESS_PERIODS}
            />

            {/* Выбор упражнения */}
            <ExerciseSelector
                exercises={exercises}
                selectedExerciseId={selectedExerciseId}
                onSelect={setSelectedExerciseId}
                isLoading={isProgressLoading}
            />

            {/* Ключевые метрики */}
            {progressData && (
                <ExerciseMetrics
                    bestWeight={progressData.bestWeight}
                    bestVolume={progressData.bestVolume}
                    avgWeight={progressData.avgWeight}
                    totalExecutions={progressData.totalExecutions}
                />
            )}

            {/* Графики */}
            {progressData && progressData.dates.length > 0 && (
                <>
                    <ExerciseWeightChart
                        dates={progressData.dates}
                        weights={progressData.weights}
                    />
                    <ExerciseVolumeChart
                        dates={progressData.dates}
                        volumes={progressData.volumes}
                    />
                </>
            )}

            {/* История подходов */}
            {progressData && setHistory.length > 0 && (
                <ExerciseSetHistory history={setHistory} />
            )}

            {/* Empty state если нет данных */}
            {progressData && progressData.dates.length === 0 && (
                <SectionEmptyState
                    icon={Dumbbell}
                    title="Нет данных"
                    description="Для этого упражнения пока нет завершённых подходов в выбранном периоде."
                />
            )}
        </div>
    )
}
