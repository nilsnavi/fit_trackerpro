export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

export const MONTH_NAMES = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
] as const

export const STATUS_CONFIG = {
    completed: { color: 'bg-success', label: 'Выполнена', icon: '✓' },
    partial: { color: 'bg-warning', label: 'Частично', icon: '◐' },
    missed: { color: 'bg-danger', label: 'Пропущена', icon: '✕' },
    planned: { color: 'bg-neutral-300 dark:bg-neutral-600', label: 'Запланирована', icon: '○' },
} as const satisfies Record<string, { color: string; label: string; icon: string }>
