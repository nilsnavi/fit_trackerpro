/**
 * EmptyWorkoutConfirmModal Component
 * 
 * Модальное окно подтверждения завершения тренировки без выполненных подходов.
 */

import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@shared/lib/cn'

interface EmptyWorkoutConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    className?: string
}

export function EmptyWorkoutConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    className,
}: EmptyWorkoutConfirmModalProps) {
    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={cn(
                    'fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-telegram-bg p-6',
                    'animate-in slide-in-from-bottom duration-300',
                    className,
                )}
            >
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-telegram-text">Подтверждение</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 hover:bg-telegram-secondary-bg"
                    >
                        <X className="h-5 w-5 text-telegram-hint" />
                    </button>
                </div>

                {/* Content */}
                <div className="mb-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500/20">
                            <AlertTriangle className="h-6 w-6 text-orange-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-telegram-text">
                                Вы не выполнили ни одного подхода
                            </p>
                            <p className="mt-1 text-xs text-telegram-hint">
                                Эта тренировка будет сохранена с нулевыми результатами. Вы уверены?
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl bg-telegram-secondary-bg px-4 py-3 text-sm font-medium text-telegram-text transition-colors hover:bg-telegram-bg"
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm()
                            onClose()
                        }}
                        className="flex-1 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-destructive/90"
                    >
                        Завершить
                    </button>
                </div>
            </div>
        </>
    )
}
