import { AlertTriangle, Phone, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@shared/lib/cn'
import { useTelegram } from '@shared/hooks/useTelegram'

interface EmergencyButtonProps {
    className?: string
}

export function EmergencyButton({ className }: EmergencyButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false)
    const { hapticFeedback } = useTelegram()

    const handleEmergencyClick = () => {
        hapticFeedback.heavy()
        setShowConfirm(true)
    }

    const handleConfirm = () => {
        hapticFeedback.error()
        // Here you would trigger the actual emergency action
        // e.g., call API, send Telegram message, etc.
        alert('Вызов экстренной помощи!')
        setShowConfirm(false)
    }

    const handleCancel = () => {
        setShowConfirm(false)
    }

    return (
        <>
            {/* Sticky Emergency Button */}
            <div className={cn(
                'fixed bottom-0 left-0 right-0 z-40',
                'bg-gradient-to-t from-telegram-bg via-telegram-bg to-transparent',
                'pt-8 pb-6 px-4 safe-area-bottom'
            )}>
                <button
                    onClick={handleEmergencyClick}
                    className={cn(
                        'w-full py-4 rounded-2xl font-semibold text-base',
                        'bg-red-500 text-white shadow-lg shadow-red-500/30',
                        'flex items-center justify-center gap-3',
                        'transition-all duration-200',
                        'active:scale-95 active:shadow-md',
                        'hover:bg-red-600',
                        className
                    )}
                >
                    <AlertTriangle className="w-5 h-5" />
                    🆘 Мне плохо
                </button>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={handleCancel}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-telegram-bg rounded-3xl p-6 w-full max-w-sm animate-scale-in">
                        <button
                            onClick={handleCancel}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-telegram-secondary-bg flex items-center justify-center text-telegram-hint"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                <Phone className="w-8 h-8 text-red-500" />
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-telegram-text mb-1">
                                    Экстренная помощь
                                </h3>
                                <p className="text-sm text-telegram-hint">
                                    Будет отправлено уведомление экстренным контактам
                                </p>
                            </div>

                            <div className="w-full space-y-3 mt-2">
                                <button
                                    onClick={handleConfirm}
                                    className="w-full py-3.5 rounded-xl font-semibold text-base bg-red-500 text-white active:scale-95 transition-transform"
                                >
                                    Вызвать помощь
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="w-full py-3.5 rounded-xl font-medium text-base text-telegram-text bg-telegram-secondary-bg active:scale-95 transition-transform"
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
