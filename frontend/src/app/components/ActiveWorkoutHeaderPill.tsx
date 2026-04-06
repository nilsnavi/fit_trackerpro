import { Play } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

export function ActiveWorkoutHeaderPill() {
    const { pathname } = useLocation()
    const tg = useTelegramWebApp()
    const workoutId = useWorkoutSessionDraftStore((s) => s.workoutId)

    if (workoutId == null) return null
    if (pathname.startsWith('/workouts/active/')) return null

    return (
        <Link
            to={`/workouts/active/${workoutId}`}
            onClick={() => tg.hapticFeedback({ type: 'selection' })}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/15 px-2.5 text-xs font-semibold text-primary"
            aria-label="Открыть активную тренировку"
        >
            <Play className="h-3.5 w-3.5" />
            В процессе
        </Link>
    )
}
