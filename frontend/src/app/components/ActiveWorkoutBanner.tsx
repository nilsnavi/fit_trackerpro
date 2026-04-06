import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Play } from 'lucide-react'
import { useWorkoutSessionDraftStore } from '@/state/local'
import { cn } from '@shared/lib/cn'
import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

export function ActiveWorkoutBanner() {
    const { pathname } = useLocation()
    const tg = useTelegramWebApp()
    const workoutId = useWorkoutSessionDraftStore((s) => s.workoutId)
    const title = useWorkoutSessionDraftStore((s) => s.title)

    const isVisible = useMemo(() => {
        if (!workoutId) return false
        if (pathname.startsWith('/workouts/active/')) return false
        return true
    }, [workoutId, pathname])

    useEffect(() => {
        const root = document.documentElement
        root.style.setProperty('--active-workout-banner-h', isVisible ? '4.25rem' : '0px')

        return () => {
            root.style.setProperty('--active-workout-banner-h', '0px')
        }
    }, [isVisible])

    if (!isVisible || !workoutId) return null

    return (
        <div
            className={cn(
                'fixed inset-x-3 bottom-[calc(var(--app-shell-nav-h)+env(safe-area-inset-bottom,0px)+0.5rem)] z-40',
                'rounded-2xl border border-primary/25 bg-primary text-primary-foreground shadow-primary',
                'transition-colors duration-200',
            )}
            role="region"
            aria-label="Быстрый доступ к активной тренировке"
        >
            <Link
                to={`/workouts/active/${workoutId}`}
                onClick={() => tg.hapticFeedback({ type: 'selection' })}
                className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2.5 touch-manipulation"
            >
                <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-wide text-primary-foreground/80">
                        Активная тренировка
                    </span>
                    <span className="block truncate text-sm font-semibold">
                        {title ?? `Сессия #${workoutId}`}
                    </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                    <Play className="h-3.5 w-3.5" aria-hidden />
                    Открыть
                </span>
            </Link>
        </div>
    )
}
