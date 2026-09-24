/**
 * WS2-4: в ядре активной тренировки не должно быть заглушек-TODO.
 *
 * Пять TODO жили в заброшенном дублирующем слое (`ActiveWorkoutContainer`,
 * `useActiveWorkout`, `useWorkoutSession`, legacy `ActiveWorkoutScreen`/`ExerciseCard`),
 * который никто не монтировал: живой флоу уже умеет и добавление упражнения
 * (`ActiveWorkoutModals` → `AddExerciseModal`), и подсчёт подходов из данных
 * (`ActiveWorkoutScreen` → `countTotalSets`), и debounce записей
 * (`useWorkoutSetWrites`), и Zustand-состояние (`activeWorkoutStore`).
 *
 * Тест держит приёмку: новые заглушки в фиче не появятся незаметно.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const WORKOUTS_ROOT = path.resolve(__dirname, '..')
const PLACEHOLDER = /\b(TODO|FIXME|XXX)\b/

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) return sourceFiles(full)
        if (!/\.tsx?$/.test(entry.name)) return []
        if (entry.name.includes('.test.')) return []
        return [full]
    })
}

describe('ядро активной тренировки без TODO-заглушек', () => {
    it('в features/workouts нет файлов с TODO/FIXME', () => {
        const offenders = sourceFiles(WORKOUTS_ROOT)
            .filter((file) => PLACEHOLDER.test(fs.readFileSync(file, 'utf8')))
            .map((file) => path.relative(WORKOUTS_ROOT, file))

        expect(offenders).toEqual([])
    })

    it('заброшенный дублирующий слой удалён, а не оставлен «на будущее»', () => {
        const removed = [
            'active/containers/ActiveWorkoutContainer.tsx',
            'active/containers/ActiveWorkoutHeaderContainer.tsx',
            'active/components/EmptyWorkoutState.tsx',
            'hooks/useActiveWorkout.ts',
            'hooks/useWorkoutSession.ts',
            'components/ActiveWorkoutScreen.tsx',
            'components/ExerciseCard.tsx',
            'store/workoutSession.store.ts',
        ]

        expect(removed.filter((rel) => fs.existsSync(path.join(WORKOUTS_ROOT, rel)))).toEqual([])
    })

    it('живой флоу активной тренировки остаётся на месте', () => {
        const live = [
            'active/components/ActiveWorkoutScreen.tsx',
            'active/containers/ActiveWorkoutModals.tsx',
            'active/modals/AddExerciseModal.tsx',
            'active/hooks/useWorkoutSetWrites.ts',
        ]

        expect(live.filter((rel) => !fs.existsSync(path.join(WORKOUTS_ROOT, rel)))).toEqual([])
    })
})
