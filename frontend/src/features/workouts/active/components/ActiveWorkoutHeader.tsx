import { ArrowLeft } from 'lucide-react'

interface ActiveWorkoutHeaderProps {
    onBack: () => void
}

export function ActiveWorkoutHeader({ onBack }: ActiveWorkoutHeaderProps) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onBack}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-telegram-secondary-bg text-telegram-text"
                aria-label="Назад к тренировкам"
            >
                <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-bold text-telegram-text">Активная тренировка</h1>
        </div>
    )
}
