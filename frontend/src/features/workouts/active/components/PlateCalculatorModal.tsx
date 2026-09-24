import { useMemo, useState } from 'react'
import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'
import {
    calculatePlates,
    DEFAULT_AVAILABLE_PLATES_KG,
    DEFAULT_BAR_WEIGHT_KG,
} from '../lib/plateCalculator'

export interface PlateCalculatorModalProps {
    isOpen: boolean
    onClose: () => void
    /** Initial target weight (current set weight). */
    targetWeight: number
    exerciseName?: string
}

function formatKg(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

/**
 * SPEC-005 §42–43: бары и блины на каждую сторону.
 * Shows impossible state + nearest achievable weight (AC-005-021).
 */
export function PlateCalculatorModal({
    isOpen,
    onClose,
    targetWeight,
    exerciseName,
}: PlateCalculatorModalProps) {
    const [target, setTarget] = useState<number>(targetWeight)
    const [barWeight, setBarWeight] = useState<number>(DEFAULT_BAR_WEIGHT_KG)

    const result = useMemo(
        () => calculatePlates(target, barWeight, DEFAULT_AVAILABLE_PLATES_KG),
        [target, barWeight],
    )

    if (!isOpen) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Рассчитать блины">
            <div className="space-y-4 p-4">
                {exerciseName ? (
                    <p className="text-xs font-bold uppercase tracking-wide text-telegram-hint">
                        {exerciseName}
                    </p>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-bold text-telegram-hint">
                        Цель, кг
                        <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.5"
                            value={target}
                            onChange={(event) => setTarget(Number(event.target.value) || 0)}
                            className="mt-1 h-12 w-full rounded-2xl border border-border bg-telegram-bg px-3 text-base font-black tabular-nums text-telegram-text"
                            data-testid="plate-target-input"
                        />
                    </label>
                    <label className="block text-xs font-bold text-telegram-hint">
                        Гриф, кг
                        <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.5"
                            value={barWeight}
                            onChange={(event) => setBarWeight(Number(event.target.value) || 0)}
                            className="mt-1 h-12 w-full rounded-2xl border border-border bg-telegram-bg px-3 text-base font-black tabular-nums text-telegram-text"
                            data-testid="plate-bar-input"
                        />
                    </label>
                </div>

                {result.achievable ? (
                    <div className="rounded-2xl border border-border bg-telegram-secondary-bg p-4" data-testid="plate-result">
                        <p className="text-xs font-black uppercase tracking-wide text-telegram-hint">
                            На каждую сторону
                        </p>
                        {result.platesPerSide.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {result.platesPerSide.map((plate, index) => (
                                    <span
                                        key={`${plate}-${index}`}
                                        className="rounded-xl bg-primary/15 px-3 py-1.5 text-sm font-black tabular-nums text-primary"
                                    >
                                        {formatKg(plate)}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-sm font-semibold text-telegram-text">
                                Только гриф ({formatKg(barWeight)} кг)
                            </p>
                        )}
                    </div>
                ) : (
                    <div
                        className="rounded-2xl border border-warning/40 bg-warning/10 p-4"
                        data-testid="plate-impossible"
                    >
                        <p className="text-sm font-black text-telegram-text">
                            Точно собрать невозможно.
                        </p>
                        <p className="mt-1 text-sm font-semibold text-telegram-text">
                            Ближайший вес: {formatKg(result.nearestWeight ?? barWeight)} кг
                            {result.remainder > 0
                                ? ` (не хватает ${formatKg(result.remainder * 2)} кг)`
                                : ''}
                        </p>
                    </div>
                )}

                <Button type="button" className="w-full rounded-2xl" onClick={onClose}>
                    Готово
                </Button>
            </div>
        </Modal>
    )
}
