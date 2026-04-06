import { NavLink, useLocation } from 'react-router-dom'
import { Home, Dumbbell, User, Library, BarChart3 } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'
import { useWorkoutSessionDraftStore } from '@/state/local'

const navItems = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/exercises', icon: Library, label: 'Каталог' },
    { path: '/workouts', icon: Dumbbell, label: 'Тренировки' },
    { path: '/progress', icon: BarChart3, label: 'Прогресс' },
    { path: '/profile', icon: User, label: 'Профиль' },
]

export function Navigation() {
    const tg = useTelegramWebApp()
    const { pathname } = useLocation()
    const activeWorkoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const hasActiveWorkout = activeWorkoutId != null && !pathname.startsWith('/workouts/active/')

    const handleNavClick = () => {
        // Provide haptic feedback on navigation
        tg.hapticFeedback({ type: 'selection' })
    }

    return (
        <nav
            className={cn(
                'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-telegram-bg transition-colors duration-200',
                'safe-area-x safe-area-bottom',
                tg.isTelegram && 'shadow-[0_-4px_24px_rgba(0,0,0,0.16)]',
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
                                'flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 touch-manipulation transition-colors',
                                isActive
                                    ? 'text-primary'
                                    : 'text-telegram-hint hover:text-telegram-text active:text-telegram-text'
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <span
                                    className={cn(
                                        'relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl px-2 transition-colors',
                                        isActive
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-telegram-hint',
                                    )}
                                >
                                    <Icon className="h-5 w-5" aria-hidden />
                                    {path === '/workouts' && hasActiveWorkout ? (
                                        <span
                                            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-telegram-bg"
                                            aria-label="Есть активная тренировка"
                                        />
                                    ) : null}
                                </span>
                                <span className={cn('text-[11px] leading-none', isActive && 'font-semibold')}>
                                    {label}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    )
}
