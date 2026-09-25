/**
 * Форма экстренного контакта — общая для создания (inline) и редактирования (модалка).
 *
 * Уведомления о начале/конце тренировки отправляет сервер (фоновой задачей при
 * старте и завершении), поэтому здесь только флаги подписки.
 */
import { useId, useState } from 'react'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import {
    EMPTY_CONTACT_FORM,
    normalizeUsername,
    type EmergencyContactFormValues,
} from '@features/emergency/lib/contactForm'

interface EmergencyContactFormProps {
    initialValues?: EmergencyContactFormValues
    /** Показать переключатель «Контакт активен» (только при редактировании). */
    showActiveToggle?: boolean
    /** Подсказка над кнопками (например, про уже подключённый аккаунт). */
    note?: string
    isSubmitting: boolean
    /** Ошибка последней отправки (например, 409 — дубликат username/телефона). */
    error?: string | null
    onSubmit: (values: EmergencyContactFormValues) => void
    onCancel: () => void
}

interface ToggleRowProps {
    label: string
    hint?: string
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
}

function ToggleRow({ label, hint, checked, onChange, disabled }: ToggleRowProps) {
    const id = useId()
    return (
        <div className="flex items-start gap-3">
            <input
                id={id}
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
            />
            <label htmlFor={id} className="text-sm text-telegram-text">
                {label}
                {hint ? <span className="block text-[11px] text-telegram-hint">{hint}</span> : null}
            </label>
        </div>
    )
}

export function EmergencyContactForm({
    initialValues = EMPTY_CONTACT_FORM,
    showActiveToggle = false,
    note,
    isSubmitting,
    error,
    onSubmit,
    onCancel,
}: EmergencyContactFormProps) {
    const [values, setValues] = useState<EmergencyContactFormValues>(initialValues)

    const set = <K extends keyof EmergencyContactFormValues>(key: K, value: EmergencyContactFormValues[K]) =>
        setValues((prev) => ({ ...prev, [key]: value }))

    const canSubmit =
        values.contact_name.trim().length > 0 &&
        (normalizeUsername(values.contact_username).length > 0 || values.phone.trim().length > 0)

    return (
        <div className="space-y-3">
            <Input
                label="Имя"
                value={values.contact_name}
                onChange={(event) => set('contact_name', event.target.value)}
                placeholder="Мама"
                fullWidth
            />
            <Input
                label="Telegram username"
                value={values.contact_username}
                onChange={(event) => set('contact_username', event.target.value)}
                placeholder="без @"
                fullWidth
            />
            <Input
                label="Телефон"
                value={values.phone}
                onChange={(event) => set('phone', event.target.value)}
                placeholder="+7…"
                fullWidth
            />

            <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-medium text-telegram-hint">Когда уведомлять</legend>
                <ToggleRow
                    label="Кнопка «Мне плохо»"
                    checked={values.notify_on_emergency}
                    onChange={(checked) => set('notify_on_emergency', checked)}
                    disabled={isSubmitting}
                />
                <ToggleRow
                    label="Начало тренировки"
                    hint="Сообщение уходит, когда вы начинаете тренировку."
                    checked={values.notify_on_workout_start}
                    onChange={(checked) => set('notify_on_workout_start', checked)}
                    disabled={isSubmitting}
                />
                <ToggleRow
                    label="Окончание тренировки"
                    hint="Когда вы завершаете или отменяете тренировку."
                    checked={values.notify_on_workout_end}
                    onChange={(checked) => set('notify_on_workout_end', checked)}
                    disabled={isSubmitting}
                />
                {showActiveToggle && (
                    <ToggleRow
                        label="Контакт активен"
                        hint="Неактивный контакт не получает никаких уведомлений."
                        checked={values.is_active}
                        onChange={(checked) => set('is_active', checked)}
                        disabled={isSubmitting}
                    />
                )}
            </fieldset>

            <p className="text-[11px] text-telegram-hint">
                {note ??
                    'Имя и хотя бы один канал связи обязательны. Сообщения начнут доходить после того, как контакт подключится в боте.'}
            </p>

            {error && (
                <p role="alert" className="text-xs text-danger">
                    {error}
                </p>
            )}

            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    disabled={!canSubmit}
                    isLoading={isSubmitting}
                    onClick={() => onSubmit(values)}
                >
                    Сохранить
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={isSubmitting}>
                    Отмена
                </Button>
            </div>
        </div>
    )
}
