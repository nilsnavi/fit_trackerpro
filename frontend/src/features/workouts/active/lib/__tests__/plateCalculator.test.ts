import { calculatePlates, DEFAULT_BAR_WEIGHT_KG } from '../plateCalculator'

describe('calculatePlates (SPEC-005 §42–43)', () => {
    it('assembles an exact combination symmetrically', () => {
        const result = calculatePlates(100, 20)
        expect(result.achievable).toBe(true)
        // (100 - 20) / 2 = 40 -> 25 + 15
        expect(result.platesPerSide).toEqual([25, 15])
        expect(result.nearestWeight).toBe(100)
        expect(result.exactWeight).toBe(100)
    })

    it('uses fractional plates when needed', () => {
        const result = calculatePlates(107.5, 20)
        expect(result.achievable).toBe(true)
        // (107.5 - 20) / 2 = 43.75 -> 25 + 15 + 2.5 + 1.25
        expect(result.platesPerSide).toEqual([25, 15, 2.5, 1.25])
    })

    it('reports the nearest achievable weight when the target cannot be assembled', () => {
        const result = calculatePlates(81, 20, [25, 10, 5])
        expect(result.achievable).toBe(false)
        expect(result.platesPerSide).toEqual([25, 5])
        expect(result.nearestWeight).toBe(80)
        expect(result.remainder).toBeGreaterThan(0)
    })

    it('handles targets below the bar weight', () => {
        const result = calculatePlates(10, 20)
        expect(result.achievable).toBe(false)
        expect(result.platesPerSide).toEqual([])
        expect(result.nearestWeight).toBe(20)
    })

    it('defaults to a 20 kg bar', () => {
        expect(DEFAULT_BAR_WEIGHT_KG).toBe(20)
        expect(calculatePlates(60).platesPerSide).toEqual([20])
    })
})
