import { renderHook } from '@testing-library/react'
import { useOneRMExercises } from '../useOneRMExercises'

const mockCatalogData = [
    {
        id: 42,
        name: 'Жим штанги лёжа',
        category: 'strength' as const,
        equipment: ['barbell' as const],
        primaryMuscles: ['chest'],
        secondaryMuscles: ['triceps'],
        difficulty: 'intermediate' as const,
        risks: [],
        description: '',
        instructions: [],
        tips: [],
        isCustom: false,
    },
    {
        id: 99,
        name: 'Бег на дорожке',
        category: 'cardio' as const,
        equipment: ['machine' as const],
        primaryMuscles: ['legs'],
        secondaryMuscles: [],
        difficulty: 'beginner' as const,
        risks: [],
        description: '',
        instructions: [],
        tips: [],
        isCustom: false,
    },
]

let mockIsLoading = false
let mockIsError = false
let mockData: typeof mockCatalogData | undefined = mockCatalogData

jest.mock('@features/exercises/hooks/useExercisesCatalogQuery', () => ({
    useExercisesCatalogQuery: () => ({
        data: mockData,
        isLoading: mockIsLoading,
        isError: mockIsError,
    }),
}))

describe('useOneRMExercises', () => {
    beforeEach(() => {
        mockIsLoading = false
        mockIsError = false
        mockData = mockCatalogData
    })

    it('maps full Exercise objects to slim OneRMExercise shape', () => {
        const { result } = renderHook(() => useOneRMExercises())

        expect(result.current.exercises).toEqual([
            { id: 42, name: 'Жим штанги лёжа', category: 'strength' },
            { id: 99, name: 'Бег на дорожке', category: 'cardio' },
        ])
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isError).toBe(false)
    })

    it('returns empty array and isLoading when catalog is loading', () => {
        mockData = undefined
        mockIsLoading = true

        const { result } = renderHook(() => useOneRMExercises())

        expect(result.current.exercises).toEqual([])
        expect(result.current.isLoading).toBe(true)
    })

    it('returns empty array and isError when catalog fails', () => {
        mockData = undefined
        mockIsError = true

        const { result } = renderHook(() => useOneRMExercises())

        expect(result.current.exercises).toEqual([])
        expect(result.current.isError).toBe(true)
    })
})
