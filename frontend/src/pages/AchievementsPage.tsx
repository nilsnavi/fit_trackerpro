/**
 * Achievements Page
 * 
 * Полноценная страница со всеми достижениями пользователя.
 * Включает фильтрацию, прогресс и детальную информацию.
 */
import { useEffect } from 'react'
import { useTelegramWebApp } from '@hooks/useTelegramWebApp'
import { Achievements } from '@components/gamification'

export function AchievementsPage() {
    const { init, setHeaderColor, setBackgroundColor } = useTelegramWebApp()

    useEffect(() => {
        init()
        setHeaderColor('bg_color')
        setBackgroundColor('bg_color')
    }, [init, setHeaderColor, setBackgroundColor])

    return (
        <div className="p-4 animate-fade-in">
            <h1 className="text-2xl font-bold text-telegram-text mb-6">
                Достижения
            </h1>
            <Achievements />
        </div>
    )
}

export default AchievementsPage
