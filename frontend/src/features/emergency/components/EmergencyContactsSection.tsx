/**
 * EmergencyContactsSection — управление экстренными контактами (WS1-13).
 *
 * Контакт получает уведомления только после того, как сам подключится в боте
 * (Telegram Bot API не позволяет писать тем, кто не начинал диалог). Поэтому
 * интерфейс показывает реальный статус и выдаёт код приглашения, а не обещает
 * доставку «в воздух».
 */
import { useState } from 'react'
import { Link2, Pencil, Plus, Send, Trash2, Unlink, UserPlus } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { toast } from '@shared/stores/toastStore'
import { Button } from '@shared/ui/Button'
import { Modal } from '@shared/ui/Modal'
import { getErrorMessage } from '@shared/errors'
import {
    useCreateEmergencyContactMutation,
    useDeleteEmergencyContactMutation,
    useEmergencyContactsQuery,
    useIssueEmergencyLinkCodeMutation,
    useUnlinkEmergencyContactMutation,
    useUpdateEmergencyContactMutation,
} from '@features/emergency/hooks/useEmergencyQueries'
import type { EmergencyContact, EmergencyContactLink } from '@features/emergency/api/emergencyApi'
import {
    buildContactUpdatePayload,
    contactToFormValues,
    describeSubscriptions,
    normalizeUsername,
    type EmergencyContactFormValues,
} from '@features/emergency/lib/contactForm'
import { EmergencyContactForm } from './EmergencyContactForm'

export function EmergencyContactsSection() {
    const contactsQuery = useEmergencyContactsQuery()
    const createMutation = useCreateEmergencyContactMutation()
    const deleteMutation = useDeleteEmergencyContactMutation()
    const linkCodeMutation = useIssueEmergencyLinkCodeMutation()
    const unlinkMutation = useUnlinkEmergencyContactMutation()
    const updateMutation = useUpdateEmergencyContactMutation()

    const [isAdding, setIsAdding] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [editing, setEditing] = useState<EmergencyContact | null>(null)
    const [editError, setEditError] = useState<string | null>(null)
    const [invite, setInvite] = useState<EmergencyContactLink | null>(null)

    const contacts = contactsQuery.data?.items ?? []

    const closeCreateForm = () => {
        setIsAdding(false)
        setCreateError(null)
    }

    // Ошибки формы (в т.ч. 409 «такой username/телефон уже есть») показываются
    // прямо в форме, а введённые данные не теряются.
    const handleAdd = async (values: EmergencyContactFormValues) => {
        setCreateError(null)
        try {
            await createMutation.mutateAsync({
                contact_name: values.contact_name.trim(),
                contact_username: normalizeUsername(values.contact_username) || undefined,
                phone: values.phone.trim() || undefined,
                notify_on_emergency: values.notify_on_emergency,
                notify_on_workout_start: values.notify_on_workout_start,
                notify_on_workout_end: values.notify_on_workout_end,
            })
            toast.success('Контакт добавлен')
            closeCreateForm()
        } catch (error) {
            setCreateError(getErrorMessage(error))
        }
    }

    const openEdit = (contact: EmergencyContact) => {
        setEditError(null)
        setEditing(contact)
    }

    const closeEdit = () => {
        setEditing(null)
        setEditError(null)
    }

    const handleUpdate = async (values: EmergencyContactFormValues) => {
        if (!editing) return
        const payload = buildContactUpdatePayload(editing, values)
        if (Object.keys(payload).length === 0) {
            closeEdit()
            return
        }
        setEditError(null)
        try {
            await updateMutation.mutateAsync({ contactId: editing.id, payload })
            toast.success('Контакт обновлён')
            closeEdit()
        } catch (error) {
            setEditError(getErrorMessage(error))
        }
    }

    const handleInvite = async (contactId: number) => {
        try {
            const data = await linkCodeMutation.mutateAsync(contactId)
            setInvite(data)
        } catch (error) {
            toast.error(getErrorMessage(error))
        }
    }

    const handleUnlink = async (contactId: number) => {
        try {
            await unlinkMutation.mutateAsync(contactId)
            toast.info('Контакт отключён от бота')
        } catch (error) {
            toast.error(getErrorMessage(error))
        }
    }

    const handleDelete = async (contactId: number) => {
        try {
            await deleteMutation.mutateAsync(contactId)
            toast.info('Контакт удалён')
        } catch (error) {
            toast.error(getErrorMessage(error))
        }
    }

    const inviteText = invite
        ? invite.deep_link
            ? `Откройте бота и нажмите «Start»: ${invite.deep_link}`
            : `Откройте бота и отправьте: ${invite.command}`
        : ''

    const copyInvite = async () => {
        if (!inviteText) return
        try {
            await navigator.clipboard.writeText(inviteText)
            toast.success('Текст приглашения скопирован')
        } catch {
            toast.info(inviteText)
        }
    }

    return (
        <div className="bg-telegram-secondary-bg rounded-2xl p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <UserPlus className="mt-0.5 h-5 w-5 text-telegram-hint" />
                    <div>
                        <h3 className="text-sm font-semibold text-telegram-text">
                            Экстренные контакты
                        </h3>
                        <p className="text-xs text-telegram-hint">
                            Уведомления получают только контакты, подключённые к боту.
                        </p>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => (isAdding ? closeCreateForm() : setIsAdding(true))}
                >
                    Добавить
                </Button>
            </div>

            {contactsQuery.isLoading && (
                <p className="text-xs text-telegram-hint">Загрузка…</p>
            )}
            {contactsQuery.isError && (
                <p className="text-xs text-danger">
                    Не удалось загрузить контакты: {getErrorMessage(contactsQuery.error)}
                </p>
            )}

            {!contactsQuery.isLoading && contacts.length === 0 && (
                <p className="text-xs text-telegram-hint">
                    Пока никого нет. Добавьте близкого — он получит сообщение, когда вы нажмёте
                    «Мне плохо».
                </p>
            )}

            <ul className="space-y-2">
                {contacts.map((contact) => (
                    <li
                        key={contact.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-telegram-bg/60 p-3"
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-telegram-text">
                                    {contact.contact_name}
                                </span>
                                <span
                                    className={cn(
                                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                                        contact.is_linked
                                            ? 'bg-success/15 text-success'
                                            : 'bg-warning/15 text-warning',
                                    )}
                                    data-testid={`contact-status-${contact.id}`}
                                >
                                    {contact.is_linked ? 'подключён' : 'не подключён'}
                                </span>
                            </div>
                            <p className="truncate text-xs text-telegram-hint">
                                {contact.contact_username ? `@${contact.contact_username}` : ''}
                                {contact.contact_username && contact.phone ? ' · ' : ''}
                                {contact.phone ?? ''}
                            </p>
                            <p
                                className="truncate text-[11px] text-telegram-hint"
                                data-testid={`contact-subscriptions-${contact.id}`}
                            >
                                {describeSubscriptions(contact)}
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={`Изменить контакт ${contact.contact_name}`}
                                onClick={() => openEdit(contact)}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label="Пригласить в бот"
                                onClick={() => handleInvite(contact.id)}
                                disabled={linkCodeMutation.isPending}
                            >
                                <Link2 className="h-4 w-4" />
                            </Button>
                            {contact.is_linked && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Отвязать от бота"
                                    onClick={() => handleUnlink(contact.id)}
                                    disabled={unlinkMutation.isPending}
                                >
                                    <Unlink className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label="Удалить контакт"
                                onClick={() => handleDelete(contact.id)}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4 text-danger" />
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>

            {isAdding && (
                <div className="mt-3 rounded-xl bg-telegram-bg/60 p-3">
                    <EmergencyContactForm
                        isSubmitting={createMutation.isPending}
                        error={createError}
                        onSubmit={(values) => void handleAdd(values)}
                        onCancel={closeCreateForm}
                    />
                </div>
            )}

            <Modal
                isOpen={editing !== null}
                onClose={closeEdit}
                title="Изменить контакт"
                size="sm"
            >
                {editing && (
                    <EmergencyContactForm
                        key={editing.id}
                        initialValues={contactToFormValues(editing)}
                        showActiveToggle
                        note={
                            editing.is_linked
                                ? 'Контакт уже подключён в боте: смена username не меняет получателя. Чтобы сменить аккаунт, отвяжите контакт и отправьте новое приглашение.'
                                : undefined
                        }
                        isSubmitting={updateMutation.isPending}
                        error={editError}
                        onSubmit={(values) => void handleUpdate(values)}
                        onCancel={closeEdit}
                    />
                )}
            </Modal>

            <Modal
                isOpen={invite !== null}
                onClose={() => setInvite(null)}
                title="Приглашение в бот"
                description={
                    invite
                        ? `${invite.contact_name} должен открыть бота и подтвердить подключение.`
                        : undefined
                }
                size="sm"
            >
                {invite && (
                    <div className="space-y-4">
                        <div className="space-y-1 rounded-xl bg-telegram-secondary-bg p-3">
                            <p className="text-xs text-telegram-hint">Код приглашения</p>
                            <p className="font-mono text-lg tracking-widest text-telegram-text">
                                {invite.code}
                            </p>
                            <p className="text-xs text-telegram-hint">
                                Команда для бота: <span className="font-mono">{invite.command}</span>
                            </p>
                        </div>

                        {invite.is_linked && (
                            <p className="text-xs text-warning">
                                Контакт уже подключён. Новый код можно отправить, если он сменил
                                аккаунт — старое подключение заменится.
                            </p>
                        )}

                        {invite.deep_link && (
                            <a
                                href={invite.deep_link}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground"
                            >
                                <Send className="h-4 w-4" />
                                Открыть чат с ботом
                            </a>
                        )}

                        <Button type="button" variant="secondary" fullWidth onClick={copyInvite}>
                            Скопировать текст приглашения
                        </Button>
                    </div>
                )}
            </Modal>
        </div>
    )
}
