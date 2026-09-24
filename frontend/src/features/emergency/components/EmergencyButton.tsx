/**
 * EmergencyButton — честный флоу экстренного оповещения.
 *
 * Что важно (WS1-13):
 * - кнопка реально вызывает POST /system/emergency/notify и показывает
 *   результат по каждому контакту (доставлено / не доставлено + причина);
 * - приложение НЕ вызывает скорую помощь — это прямо написано в диалоге,
 *   рядом кнопка звонка в экстренные службы;
 * - если контакты не настроены или не подключены к боту, интерфейс говорит
 *   об этом, а не рапортует об «отправленном вызове».
 */
import { AlertTriangle, CheckCircle2, Phone, Send, X, XCircle } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@shared/lib/cn'
import { useTelegram } from '@shared/hooks/useTelegram'
import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'
import { getErrorMessage } from '@shared/errors'
import {
    useEmergencyContactsQuery,
    useEmergencyNotifyMutation,
} from '@features/emergency/hooks/useEmergencyQueries'
import type { EmergencyNotifyResponse } from '@features/emergency/api/emergencyApi'

interface EmergencyButtonProps {
    className?: string
}

type Step = 'confirm' | 'result'

export function EmergencyButton({ className }: EmergencyButtonProps) {
    const [step, setStep] = useState<Step | null>(null)
    const [result, setResult] = useState<EmergencyNotifyResponse | null>(null)
    const { hapticFeedback } = useTelegram()

    const contactsQuery = useEmergencyContactsQuery()
    const notifyMutation = useEmergencyNotifyMutation()

    const contacts = contactsQuery.data?.items ?? []
    const linkedCount = contacts.filter((contact) => contact.is_linked).length

    const openConfirm = () => {
        hapticFeedback.heavy()
        setResult(null)
        setStep('confirm')
    }

    const close = () => {
        setStep(null)
        setResult(null)
        notifyMutation.reset()
    }

    const handleSend = async () => {
        hapticFeedback.medium()
        try {
            const response = await notifyMutation.mutateAsync({
                severity: 'high',
            })
            setResult(response)
            setStep('result')
            if (response.successful_count > 0) {
                hapticFeedback.success()
            } else {
                hapticFeedback.error()
            }
        } catch {
            hapticFeedback.error()
        }
    }

    const undelivered = result ? result.results.filter((item) => !item.success) : []

    return (
        <section
            className={cn(
                'rounded-[12px] border border-[#3a1a1e] bg-black p-3 shadow-[0_12px_34px_rgba(0,0,0,0.4)]',
                className,
            )}
        >
            <div className="flex items-start gap-3">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-[#3f2024] bg-[#1b0f11] text-[#ff453a]">
                    <AlertTriangle className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-[17px] font-bold leading-5 text-white">Экстренная помощь</h2>
                    <p className="mt-1 text-[12px] leading-4 text-[#8b8f98]">
                        Уведомим близких в Telegram. Приложение не вызывает скорую — при угрозе
                        жизни звоните 112.
                    </p>
                </div>
            </div>

            <p className="mt-3 text-[12px] leading-4 text-[#6e747d]">
                {contactsQuery.isError
                    ? 'Не удалось проверить список контактов.'
                    : contactsQuery.isLoading
                      ? 'Проверяем контакты…'
                      : contacts.length === 0
                        ? 'Экстренные контакты не настроены — добавьте близких в профиле.'
                        : linkedCount > 0
                          ? `Подключены к боту: ${linkedCount} из ${contacts.length}.`
                          : 'Ни один контакт ещё не подключён к боту — уведомление не дойдёт.'}
            </p>

            <button
                type="button"
                data-testid="emergency-button"
                onClick={openConfirm}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#ff3b30] text-[15px] font-semibold text-white active:scale-[0.98]"
            >
                <AlertTriangle className="h-5 w-5" />
                Мне плохо
            </button>

            <Modal
                isOpen={step !== null}
                onClose={close}
                title={step === 'confirm' ? 'Экстренная помощь' : 'Результат отправки'}
                description={
                    step === 'confirm'
                        ? 'Мы отправим вашим экстренным контактам сообщение в Telegram.'
                        : undefined
                }
                size="sm"
            >
                {step === 'confirm' && (
                    <div className="space-y-4">
                        <div className="space-y-2 rounded-xl bg-telegram-secondary-bg p-3">
                            <p className="text-sm font-medium text-telegram-text">
                                Что произойдёт
                            </p>
                            <ul className="space-y-1 text-xs text-telegram-hint">
                                <li>• Сообщение получат только подключённые контакты.</li>
                                <li>• Приложение не вызывает скорую помощь.</li>
                                <li>• Местоположение не передаётся автоматически.</li>
                            </ul>
                        </div>

                        {contactsQuery.isError && (
                            <p className="text-xs text-danger">
                                Не удалось загрузить контакты: {getErrorMessage(contactsQuery.error)}
                            </p>
                        )}

                        <a
                            href="tel:112"
                            className="flex items-center justify-center gap-2 rounded-xl border border-danger/40 p-3 text-sm font-semibold text-danger"
                        >
                            <Phone className="h-4 w-4" />
                            Позвонить 112
                        </a>

                        <div className="flex flex-col gap-2">
                            <Button
                                type="button"
                                variant="emergency"
                                fullWidth
                                data-testid="emergency-confirm"
                                isLoading={notifyMutation.isPending}
                                onClick={handleSend}
                            >
                                <Send className="h-4 w-4" />
                                Уведомить близких
                            </Button>
                            <Button type="button" variant="secondary" fullWidth onClick={close}>
                                Отмена
                            </Button>
                        </div>

                        {notifyMutation.isError && (
                            <p className="text-xs text-danger">
                                {getErrorMessage(notifyMutation.error)}
                            </p>
                        )}
                    </div>
                )}

                {step === 'result' && result && (
                    <div className="space-y-4" data-testid="emergency-result">
                        {result.successful_count > 0 ? (
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-telegram-text">
                                        Уведомление отправлено:{' '}
                                        {result.results
                                            .filter((item) => item.success)
                                            .map((item) => item.contact_name)
                                            .join(', ')}
                                    </p>
                                    <p className="text-xs text-telegram-hint">
                                        Подтверждение доставки пришло от Telegram Bot API.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3">
                                <XCircle className="h-6 w-6 shrink-0 text-danger" />
                                <div className="space-y-1">
                                    <p
                                        className="text-sm font-semibold text-telegram-text"
                                        data-testid="emergency-not-delivered"
                                    >
                                        Уведомление не доставлено ни одному контакту
                                    </p>
                                    <p className="text-xs text-telegram-hint">
                                        Позвоните близким или в экстренные службы самостоятельно.
                                    </p>
                                </div>
                            </div>
                        )}

                        {undelivered.length > 0 && (
                            <div className="space-y-1 rounded-xl bg-telegram-secondary-bg p-3">
                                <p className="text-xs font-semibold text-telegram-text">
                                    Не доставлено ({undelivered.length})
                                </p>
                                <ul className="space-y-1 text-xs text-telegram-hint">
                                    {undelivered.map((item) => (
                                        <li key={item.contact_id}>
                                            • {item.contact_name}: {item.error ?? 'неизвестная причина'}
                                        </li>
                                    ))}
                                </ul>
                                <p className="pt-1 text-[11px] text-telegram-hint">
                                    Попросите близкого открыть бота и отправить код приглашения
                                    из профиля.
                                </p>
                            </div>
                        )}

                        <a
                            href="tel:112"
                            className="flex items-center justify-center gap-2 rounded-xl border border-danger/40 p-3 text-sm font-semibold text-danger"
                        >
                            <Phone className="h-4 w-4" />
                            Позвонить 112
                        </a>

                        <Button type="button" variant="secondary" fullWidth onClick={close}>
                            <X className="h-4 w-4" />
                            Закрыть
                        </Button>
                    </div>
                )}
            </Modal>
        </section>
    )
}
