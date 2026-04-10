import { getPreferredCategoriesFromTitle } from '../useActiveWorkoutCatalogSuggestions'

describe('getPreferredCategoriesFromTitle', () => {
    it('detects cardio keyword', () => {
        expect(getPreferredCategoriesFromTitle('сегодня кардио')).toEqual(['cardio'])
    })

    it('detects yoga/mobility keywords', () => {
        expect(getPreferredCategoriesFromTitle('йога восстановление')).toEqual(['flexibility'])
        expect(getPreferredCategoriesFromTitle('мобилити')).toEqual(['flexibility'])
    })

    it('detects functional keyword', () => {
        expect(getPreferredCategoriesFromTitle('функц круг')).toEqual(['strength', 'cardio'])
    })

    it('falls back to strength', () => {
        expect(getPreferredCategoriesFromTitle('обычная тренировка')).toEqual(['strength'])
    })
})

