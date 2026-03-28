/**
 * Achievements Page
 *
 * Полноценная страница со всеми достижениями пользователя.
 * Включает фильтрацию, прогресс и детальную информацию.
 */
import { Achievements } from '@features/achievements/components'

export function AchievementsPage() {
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
