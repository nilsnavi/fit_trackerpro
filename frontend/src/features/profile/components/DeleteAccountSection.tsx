import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import { Modal } from '@shared/ui/Modal'
import { getErrorMessage } from '@shared/errors'
import { useNetworkOnline } from '@shared/hooks/useNetworkOnline'
import { useSyncQueue } from '@shared/hooks/useSyncQueue'
import { useDeleteAccount } from '@features/profile/hooks/useDeleteAccount'

/** Word the user types to confirm; compared case-insensitively. */
export const DELETE_ACCOUNT_CONFIRM_WORD = 'УДАЛИТЬ'

export interface DeleteAccountSectionProps {
    onExportData: () => void
    isExporting: boolean
}

function pluralChanges(n: number): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return 'изменение'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'изменения'
    return 'изменений'
}

/**
 * «Удалить аккаунт» (Профиль) — the entry point promised by the legal texts
 * (`features/legal/content.ts`). Irreversible, so it asks for a typed confirmation,
 * offers the export first and warns about changes that were never synced.
 */
export function DeleteAccountSection({ onExportData, isExporting }: DeleteAccountSectionProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [confirmText, setConfirmText] = useState('')
    const isOnline = useNetworkOnline()
    const { pendingItems, failedItems, processingItems } = useSyncQueue()
    const { deleteAccount, isDeleting, error, reset } = useDeleteAccount()

    const unsyncedCount = pendingItems.length + failedItems.length + processingItems.length
    const confirmed = confirmText.trim().toLocaleUpperCase('ru-RU') === DELETE_ACCOUNT_CONFIRM_WORD
    const canDelete = confirmed && isOnline && !isDeleting

    const open = () => {
        reset()
        setConfirmText('')
        setIsOpen(true)
    }

    const close = () => {
        if (isDeleting) return
        setIsOpen(false)
    }

    const handleDelete = () => {
        if (!canDelete) return
        // On success the whole app is replaced by the «Аккаунт удалён» screen.
        void deleteAccount()
    }

    return (
        <>
            <Button
                variant="ghost"
                fullWidth
                leftIcon={<Trash2 className="w-5 h-5" />}
                onClick={open}
                className="text-danger"
            >
                Удалить аккаунт
            </Button>

            <Modal
                isOpen={isOpen}
                onClose={close}
                title="Удалить аккаунт?"
                size="sm"
                closeOnOverlayClick={!isDeleting}
                closeOnEscape={!isDeleting}
                footer={
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="emergency"
                            fullWidth
                            onClick={handleDelete}
                            disabled={!canDelete}
                            isLoading={isDeleting}
                        >
                            Удалить навсегда
                        </Button>
                        <Button variant="secondary" fullWidth onClick={close} disabled={isDeleting}>
                            Отмена
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 text-sm text-telegram-text">
                    <p>
                        Аккаунт и все связанные данные будут удалены <strong>безвозвратно</strong>:
                        тренировки и история, шаблоны, цели прогрессии, метрики здоровья (вес, замеры,
                        глюкоза, вода, самочувствие), достижения, экстренные контакты и настройки.
                    </p>
                    <p className="text-telegram-hint">
                        Данные на этом устройстве тоже будут стёрты. Восстановить их будет нельзя.
                    </p>

                    {unsyncedCount > 0 && (
                        <p
                            className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2"
                            data-testid="delete-account-unsynced-warning"
                        >
                            {unsyncedCount} {pluralChanges(unsyncedCount)} ещё не отправлены на сервер и
                            будут потеряны.
                        </p>
                    )}

                    <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        leftIcon={<Download className="w-4 h-4" />}
                        onClick={onExportData}
                        isLoading={isExporting}
                        disabled={isExporting || isDeleting}
                    >
                        Сначала скачать мои данные
                    </Button>

                    <Input
                        label={`Чтобы подтвердить, введите ${DELETE_ACCOUNT_CONFIRM_WORD}`}
                        value={confirmText}
                        onChange={(event) => setConfirmText(event.target.value)}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        disabled={isDeleting}
                        fullWidth
                    />

                    {!isOnline && (
                        <p className="text-warning" role="status">
                            Нужно подключение к интернету: аккаунт удаляется на сервере.
                        </p>
                    )}

                    {error != null && (
                        <p className="text-danger" role="alert">
                            Не удалось удалить аккаунт: {getErrorMessage(error)}
                        </p>
                    )}
                </div>
            </Modal>
        </>
    )
}

export default DeleteAccountSection
