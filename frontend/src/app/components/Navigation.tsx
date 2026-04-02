import { NavLink } from 'react-router-dom'
import { Home, Dumbbell, User, Library, BarChart3 } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

const navItems = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/exercises', icon: Library, label: 'Каталог' },
    { path: '/workouts', icon: Dumbbell, label: 'Тренировки' },
    { path: '/progress/exercises', icon: BarChart3, label: 'Статистика' },
    { path: '/profile', icon: User, label: 'Профиль' },
]

export function Navigation() {
    const tg = useTelegramWebApp()

    const handleNavClick = () => {
        // Provide haptic feedback on navigation
        tg.hapticFeedback({ type: 'selection' })
    }

    return (
        <nav
            className={cn(
                'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-telegram-bg transition-colors duration-200',
                'safe-area-x safe-area-bottom',
                tg.isTelegram && 'shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.25)]',
            )}
            aria-label="Основная навигация"
        >
            <div className="flex h-[var(--app-shell-nav-h)] items-center justify-around">
                {navItems.map(({ path, icon: Icon, label }) => (
                    <NavLink
                        key={path}
                        to={path}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            cn(
                                'flex h-full w-full flex-col items-center justify-center touch-manipulation transition-colors',
                                isActive
                                    ? 'text-primary'
                                    : 'text-telegram-hint hover:text-telegram-text'
                            )
                        }
                    >
                        <Icon className="h-5 w-5" aria-hidden />
                        <span className="mt-1 text-xs">{label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    )
}
