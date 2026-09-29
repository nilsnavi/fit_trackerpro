import * as fs from 'node:fs'
import * as path from 'node:path'
import {
    CHART_AXIS_TICK,
    CHART_GRID_COLOR,
    CHART_PRIMARY_COLOR,
    CHART_SUCCESS_COLOR,
    CHART_SUCCESS_GRADIENT,
    CHART_TICK_COLOR,
} from '../chartTheme'

/**
 * Контракт темы графиков:
 * - каждый экспорт ссылается на CSS-переменную `--chart-…`, а не хранит значение сам;
 * - каждая переменная реально объявлена в globals.css (иначе recharts получит пустую строку).
 * Значения по умолчанию живут только в globals.css — здесь их намеренно нет.
 */
const GLOBALS_CSS_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'src', 'styles', 'globals.css')

describe('chartTheme', () => {
    it('exports only var(--chart-…) references, never raw color values', () => {
        for (const color of [CHART_GRID_COLOR, CHART_TICK_COLOR, CHART_PRIMARY_COLOR, CHART_SUCCESS_COLOR]) {
            expect(color).toMatch(/^var\(--chart-[a-z-]+\)$/)
        }

        expect(CHART_SUCCESS_GRADIENT.from.color).toMatch(/^var\(--chart-[a-z-]+\)$/)
        expect(CHART_SUCCESS_GRADIENT.to.color).toMatch(/^var\(--chart-[a-z-]+\)$/)
    })

    it('keeps axis tick preset consistent with the tick color export', () => {
        expect(CHART_AXIS_TICK.fill).toBe(CHART_TICK_COLOR)
        expect(CHART_AXIS_TICK.fontSize).toBe(11)
    })

    it('declares every referenced variable in globals.css', () => {
        const css = fs.readFileSync(GLOBALS_CSS_PATH, 'utf-8')

        const referenced = [
            CHART_GRID_COLOR,
            CHART_TICK_COLOR,
            CHART_PRIMARY_COLOR,
            CHART_SUCCESS_COLOR,
        ].map((value) => value.slice('var('.length, -1))

        for (const name of referenced) {
            expect(css).toContain(`${name}:`)
        }
    })

    it('gradient stops keep their original opacities', () => {
        expect(CHART_SUCCESS_GRADIENT.from.opacity).toBe(0.3)
        expect(CHART_SUCCESS_GRADIENT.to.opacity).toBe(0)
    })
})
