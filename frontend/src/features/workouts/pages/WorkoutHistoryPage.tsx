import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History } from 'lucide-react'
import { useStartWorkoutMutation } from '@features/workouts/hooks/useWorkoutMutations'
import { useWorkoutHistoryInfinite } from '@features/workouts/hooks/useWorkoutHistoryInfinite'
import type { WorkoutHistoryItem, WorkoutStartType } from '@features/workouts/types/workouts'
import { getErrorMessage } from '@shared/errors'
import { EmptyState } from '@shared/ui/EmptyState'
import {
    WorkoutHistoryCard,
    WorkoutHistoryFilters,
    WorkoutHistoryCardSkeleton,
    InfiniteScrollTrigger,
} from '../history/components'
import type { WorkoutHistoryFilterType, WorkoutHistoryDatePreset } from '../hooks/useWorkoutHistoryInfinite'

export function WorkoutHistoryPage() {
    const navigate = useNavigate()
    const [selectedType, setSelectedType] = useState<WorkoutHistoryFilterType>('all')
    const [datePreset, setDatePreset] = useState<WorkoutHistoryDatePreset>('all')

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
        refetch,
    } = useWorkoutHistoryInfinite({
        type: selectedType,
        datePreset,
        pageSize: 20,
    })

    const startWorkoutMutation = useStartWorkoutMutation()

    // Собираем все тренировки из всех страниц
    const allWorkouts = data?.pages.flatMap((page) => page.items) ?? []

    // Обработчик навигации к деталям тренировки
    const handleNavigate = (workoutId: number) => {
        navigate(`/workouts/${workoutId}`)
    }

    // Обработчик повторения тренировки
    const handleRepeat = (workout: WorkoutHistoryItem) => {
        // Определяем тип тренировки
        const workoutType = (workout.tags?.[0] as WorkoutStartType) || 'custom'
        
        // Запускаем новую тренировку на основе существующей
        startWorkoutMutation.mutate(
            {
                type: workoutType,
                name: `${workout.comments || 'Тренировка'} (повтор)`,
            },
            {
                onSuccess: (response) => {
                    // Переходим к активной тренировке
                    navigate(`/workouts/active/${response.id}`)
                },
                onError: (err) => {
                    console.error('Failed to repeat workout:', err)
                },
            }
        )
    }

    // Показываем skeleton при первой загрузке
    if (isLoading) {
        return (
            <div className="space-y-4 p-4">
                <WorkoutHistoryFilters
                    selectedType={selectedType}
                    onTypeChange={setSelectedType}
                    datePreset={datePreset}
                    onDatePresetChange={setDatePreset}
                />
                <WorkoutHistoryCardSkeleton count={5} />
            </div>
        )
    }

    // Показываем ошибку
    if (isError) {
        return (
            <div className="p-4">
                <EmptyState
                    icon={History}
                    title="Ошибка загрузки"
                    description={getErrorMessage(error)}
                    primaryAction={{
                        label: 'Повторить',
                        onClick: () => void refetch(),
                    }}
                />
            </div>
        )
    }

    // Показываем пустое состояние
    if (!isLoading && allWorkouts.length === 0) {
        return (
            <div className="space-y-4 p-4">
                <WorkoutHistoryFilters
                    selectedType={selectedType}
                    onTypeChange={setSelectedType}
                    datePreset={datePreset}
                    onDatePresetChange={setDatePreset}
                />
                <EmptyState
                    icon={History}
                    title="История пуста"
                    description="У вас пока нет завершённых тренировок. Начните свою первую тренировку!"
                    primaryAction={{
                        label: 'Начать тренировку',
                        onClick: () => navigate('/workouts/active/new'),
                    }}
                />
            </div>
        )
    }

    return (
        <div className="space-y-4 p-4 pb-24">
            {/* Фильтры */}
            <WorkoutHistoryFilters
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                datePreset={datePreset}
                onDatePresetChange={setDatePreset}
            />

            {/* Список тренировок */}
            <div className="space-y-3">
                {allWorkouts.map((workout) => (
                    <WorkoutHistoryCard
                        key={workout.id}
                        workout={workout}
                        onNavigate={handleNavigate}
                        onRepeat={handleRepeat}
                    />
                ))}
            </div>

            {/* Триггер для бесконечной прокрутки */}
            <InfiniteScrollTrigger
                hasNextPage={hasNextPage ?? false}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={() => void fetchNextPage()}
            />
        </div>
    )
}
