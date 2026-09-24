/**
 * SPEC-005 §42–43: plate calculator (client-side mirror of the backend
 * algorithm in backend/app/application/strength_math.py — both must stay
 * identical; the API is the source of truth for the UI but the offline mode
 * uses this local function).
 */

/** Above this many plates of one size we stop adding (safety clamp). */
const MAX_PLATES_PER_SIZE = 20

interface PlateCalculationResult {
    achievable: boolean
    platesPerSide: number[]
    exactWeight: number | null
    nearestWeight: number | null
    remainder: number
}

export const DEFAULT_BAR_WEIGHT_KG = 20
export const DEFAULT_AVAILABLE_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

export function calculatePlates(
    targetWeight: number,
    barWeight: number = DEFAULT_BAR_WEIGHT_KG,
    availablePlates: number[] = DEFAULT_AVAILABLE_PLATES_KG,
): PlateCalculationResult {
    const sideTarget = (targetWeight - barWeight) / 2
    if (sideTarget < 0) {
        return {
            achievable: false,
            platesPerSide: [],
            exactWeight: null,
            nearestWeight: barWeight,
            remainder: round2(targetWeight - barWeight),
        }
    }

    const plates = [...availablePlates].filter((p) => p > 0).sort((a, b) => b - a)
    const perSide: number[] = []
    let remaining = round2(sideTarget)

    for (const plate of plates) {
        let count = 0
        while (remaining >= plate - 1e-9 && count < MAX_PLATES_PER_SIZE) {
            perSide.push(plate)
            remaining = round2(remaining - plate)
            count += 1
        }
    }

    const achievable = Math.abs(remaining) < 1e-6
    const assembled = round2(barWeight + 2 * perSide.reduce((sum, p) => sum + p, 0))

    return {
        achievable,
        platesPerSide: perSide,
        exactWeight: achievable ? round2(targetWeight) : null,
        nearestWeight: achievable ? round2(targetWeight) : assembled,
        remainder: round2(remaining),
    }
}

function round2(value: number): number {
    return Math.round(value * 100) / 100
}
