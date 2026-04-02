/**
 * Заголовки верхней панели App Shell по пути (Telegram WebApp / браузер).
 */
const TITLE_RULES: { test: (path: string) => boolean; title: string }[] = [
    { test: (p) => p === '/' || p === '', title: 'Главная' },
    { test: (p) => p === '/exercises', title: 'Каталог' },
    { test: (p) => p.startsWith('/exercises/add'), title: 'Новое упражнение' },
    { test: (p) => p === '/workouts', title: 'Тренировки' },
    { test: (p) => p === '/workouts/templates', title: 'Шаблоны тренировок' },
    { test: (p) => p.startsWith('/workouts/templates/new'), title: 'Конструктор' },
    { test: (p) => /^\/workouts\/templates\/\d+$/.test(p), title: 'Шаблон тренировки' },
    { test: (p) => p.startsWith('/workouts/templates/') && p.endsWith('/edit'), title: 'Редактирование шаблона' },
    { test: (p) => p.startsWith('/workouts/builder'), title: 'Конструктор' },
    { test: (p) => p === '/workouts/history' || p.startsWith('/workouts/calendar'), title: 'Календарь' },
    { test: (p) => p.startsWith('/workouts/mode/'), title: 'Режим тренировки' },
    { test: (p) => p.startsWith('/workouts/active/') && p.endsWith('/edit'), title: 'Редактирование' },
    { test: (p) => /^\/workouts\/active\/\d+$/.test(p), title: 'Тренировка' },
    { test: (p) => p.startsWith('/workouts/') && p.includes('/edit'), title: 'Редактирование' },
    { test: (p) => /^\/workouts\/\d+$/.test(p), title: 'Тренировка' },
    { test: (p) => p === '/health', title: 'Здоровье' },
    { test: (p) => p === '/analytics' || p.startsWith('/progress/'), title: 'Аналитика' },
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
