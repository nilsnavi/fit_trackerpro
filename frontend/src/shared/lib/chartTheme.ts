/**
 * Единая тема графиков (recharts + SVG).
 *
 * Зачем так: recharts принимает цвета только строками в пропсах
 * (`stroke`, `fill`, `stopColor`), Tailwind-классы туда не прокинуть.
 * Поэтому базовые цвета объявлены CSS-переменными в globals.css,
 * а отсюда потребители берут `var(--chart-…)`-ссылки — единственное
 * место со значениями остаётся globals.css.
 *
 * Правило: новые цвета графиков добавлять как переменную в globals.css
 * + экспорт здесь. Голые hex в пропсах recharts не возвращать.
 */

/** Сетка графика (CartesianGrid `stroke`). */
export const CHART_GRID_COLOR = 'var(--chart-grid-color)'

/** Цвет подписей осей (XAxis/YAxis `tick.fill`). */
export const CHART_TICK_COLOR = 'var(--chart-tick-color)'

/** Основная линия/точки серии — фирменный Telegram-синий (#2481cc). */
export const CHART_PRIMARY_COLOR = 'var(--chart-primary-color)'

/** Линия/заливка серии успеха — зелёный (#22c55e). */
export const CHART_SUCCESS_COLOR = 'var(--chart-success-color)'

/** Стопы градиента площади под линией объёма. */
export const CHART_SUCCESS_GRADIENT = {
    from: { color: 'var(--chart-success-color)', opacity: 0.3 },
    to: { color: 'var(--chart-success-color)', opacity: 0 },
} as const

/** Готовый пресет осей: цвет и кегль подписей едины во всех графиках. */
export const CHART_AXIS_TICK = { fontSize: 11, fill: CHART_TICK_COLOR } as const
