/**
 * Компонент переключателя темы
 */
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@shared/hooks/useTheme'
import { cn } from '@shared/lib/cn'

interface ThemeToggleProps {
    className?: string
    variant?: 'default' | 'minimal' | 'segmented'
}

export function ThemeToggle({ className, variant = 'default' }: ThemeToggleProps) {
    const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()

    // Минимальный вариант - просто иконка с переключением
    if (variant === 'minimal') {
        return (
            <button
                onClick={toggleTheme}
                className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'bg-telegram-secondary-bg text-telegram-text',
                    'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                    'transition-all duration-200 active:scale-95',
                    className
                )}
                aria-label={resolvedTheme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
            >
                {resolvedTheme === 'dark' ? (
                    <Sun className="w-5 h-5" />
                ) : (
                    <Moon className="w-5 h-5" />
                )}
            </button>
        )
    }

    // Сегментированный вариант - выбор между светлой/темной/системной
    if (variant === 'segmented') {
        return (
            <div className={cn(
                'inline-flex p-1 rounded-xl bg-telegram-secondary-bg',
                className
            )}>
                <button
                    onClick={() => setTheme('light')}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        theme === 'light'
                            ? 'bg-telegram-bg text-telegram-text shadow-sm'
                            : 'text-telegram-hint hover:text-telegram-text'
                    )}
                >
                    <Sun className="w-4 h-4" />
                    <span className="hidden sm:inline">Светлая</span>
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        theme === 'dark'
                            ? 'bg-telegram-bg text-telegram-text shadow-sm'
                            : 'text-telegram-hint hover:text-telegram-text'
                    )}
                >
                    <Moon className="w-4 h-4" />
                    <span className="hidden sm:inline">Темная</span>
                </button>
                <button
                    onClick={() => setTheme('system')}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        theme === 'system'
                            ? 'bg-telegram-bg text-telegram-text shadow-sm'
                            : 'text-telegram-hint hover:text-telegram-text'
                    )}
                >
                    <Monitor className="w-4 h-4" />
                    <span className="hidden sm:inline">Системная</span>
                </button>
            </div>
        )
    }

    // Стандартный вариант - кнопка с иконкой и текстом
    return (
        <button
            onClick={toggleTheme}
            className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl',
                'bg-telegram-secondary-bg text-telegram-text',
                'hover:bg-neutral-200 dark:hover:bg-neutral-700',
                'transition-all duration-200 active:scale-95',
                className
            )}
        >
            {resolvedTheme === 'dark' ? (
                <>
                    <Sun className="w-5 h-5" />
                    <span className="text-sm font-medium">Светлая тема</span>
                </>
            ) : (
                <>
                    <Moon className="w-5 h-5" />
                    <span className="text-sm font-medium">Темная тема</span>
                </>
            )}
        </button>
    )
}
