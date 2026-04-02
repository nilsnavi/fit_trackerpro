import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@shared/ui/Button'

/**
 * Заглушка: сюда ведёт «Редактировать» из аналитики (`/workouts/:id/edit`).
 * Редактор завершённой тренировки подключается отдельно.
 */
export function WorkoutEditPage() {
    const { id } = useParams()
    const navigate = useNavigate()

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => navigate('/analytics')}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-telegram-secondary-bg text-telegram-text"
                    aria-label="Назад"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-xl font-bold text-telegram-text">Редактирование тренировки</h1>
            </div>
            <p className="text-sm text-telegram-hint">
                Заглушка для тренировки #{id ?? '—'}. Редактирование записи из истории пока не реализовано.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" className="flex-1" onClick={() => id && navigate(`/workouts/${id}`)}>
                    Открыть детали
                </Button>
                <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate('/workouts')}>
                    К списку тренировок
                </Button>
            </div>
        </div>
    )
}
