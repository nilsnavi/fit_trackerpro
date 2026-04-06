import { BarChart3, Dumbbell, HeartPulse } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@shared/lib/cn'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

const tabs = [
    { to: '/progress', label: 'Сводка', icon: BarChart3 },
    { to: '/progress/exercises', label: 'Упражнения', icon: Dumbbell },
    { to: '/progress/recovery', label: 'Восстановление', icon: HeartPulse },
] as const

export function ProgressScreenTabs() {
    const tg = useTelegramWebApp()

    return (
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar" aria-label="Навигация по прогрессу">
            {tabs.map(({ to, label, icon: Icon }) => (
                <NavLink
                    key={to}
                    to={to}
                    onClick={() => tg.hapticFeedback({ type: 'selection' })}
                    className={({ isActive }) =>
                        cn(
                            'inline-flex min-h-[40px] shrink-0 touch-manipulation items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors',
                            isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-telegram-secondary-bg text-telegram-hint',
                        )
                    }
                >
                    {({ isActive }) => (
                        <>
                            <Icon className={cn('h-4 w-4', isActive && 'text-primary-foreground')} />
                            <span>{label}</span>
                        </>
                    )}
                </NavLink>
            ))}
        </div>
    )
}