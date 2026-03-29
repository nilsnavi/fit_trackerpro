/**
 * Заголовки верхней панели App Shell по пути (Telegram WebApp / браузер).
 */
const TITLE_RULES: { test: (path: string) => boolean; title: string }[] = [
    { test: (p) => p === '/' || p === '', title: 'Главная' },
    { test: (p) => p === '/exercises', title: 'Каталог' },
    { test: (p) => p.startsWith('/exercises/add'), title: 'Новое упражнение' },
    { test: (p) => p === '/workouts', title: 'Тренировки' },
    { test: (p) => p.startsWith('/workouts/builder'), title: 'Конструктор' },
    { test: (p) => p.startsWith('/workouts/calendar'), title: 'Календарь' },
    { test: (p) => p.startsWith('/workouts/mode/'), title: 'Режим тренировки' },
    { test: (p) => p.startsWith('/workouts/') && p.includes('/edit'), title: 'Редактирование' },
    { test: (p) => /^\/workouts\/\d+$/.test(p), title: 'Тренировка' },
    { test: (p) => p === '/health', title: 'Здоровье' },
    { test: (p) => p === '/analytics', title: 'Аналитика' },
    { test: (p) => p === '/profile', title: 'Профиль' },
    { test: (p) => p === '/login', title: 'Вход' },
]

export function getAppShellTitle(pathname: string): string {
    const path = pathname.split('?')[0] ?? pathname
    for (const rule of TITLE_RULES) {
        if (rule.test(path)) return rule.title
    }
    return 'FitTracker Pro'
}
