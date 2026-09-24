/**
 * WorkoutProgressPage
 * 
 * Страница прогресса тренировок.
 * Перенаправляет на ExerciseProgressPage для детальной аналитики.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function WorkoutProgressPage() {
    const navigate = useNavigate()

    useEffect(() => {
        // Перенаправляем на страницу прогресса упражнений
        navigate('/progress/exercises', { replace: true })
    }, [navigate])

    return (
        <div className="flex h-full items-center justify-center p-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
    )
}
