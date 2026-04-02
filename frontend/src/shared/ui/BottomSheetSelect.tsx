import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@shared/lib/cn'
import { Modal } from './Modal'

export interface BottomSheetOption<T> {
    value: T
    label: string
    description?: string
    icon?: ReactNode
}

export interface BottomSheetSelectProps<T> {
    isOpen: boolean
    onClose: () => void
    options: BottomSheetOption<T>[]
    /** Currently selected value (for highlighting) */
    value?: T
    onChange: (value: T) => void
    title?: string
}

/**
 * BottomSheetSelect — a modal-based option picker that slides up from the
 * bottom of the screen. Useful for replacing native `<select>` on mobile.
 *
 * @example
 * <BottomSheetSelect
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   title="Мышечная группа"
 *   options={muscleGroups}
 *   value={selected}
 *   onChange={setSelected}
 * />
 */
export function BottomSheetSelect<T>({
    isOpen,
    onClose,
    options,
    value,
    onChange,
    title,
}: BottomSheetSelectProps<T>) {
    function handleSelect(option: BottomSheetOption<T>) {
        onChange(option.value)
        onClose()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="full"
            showHandle
            closeOnOverlayClick
        >
            <ul role="listbox" aria-label={title} className="divide-y divide-border py-1">
                {options.map((option, idx) => {
                    const isSelected = option.value === value
                    return (
                        <li key={idx}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleSelect(option)}
                                className={cn(
                                    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                                    'focus-visible:bg-telegram-secondary-bg/60 focus-visible:outline-none',
                                    'active:bg-telegram-secondary-bg/40',
                                    isSelected && 'bg-telegram-secondary-bg/30',
                                )}
                            >
                                {option.icon && (
                                    <span className="shrink-0 text-telegram-hint">{option.icon}</span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <span
                                        className={cn(
                                            'block text-sm font-medium',
                                            isSelected ? 'text-telegram-link' : 'text-telegram-text',
                                        )}
                                    >
                                        {option.label}
                                    </span>
                                    {option.description && (
                                        <span className="block text-xs text-telegram-hint">
                                            {option.description}
                                        </span>
                                    )}
                                </div>
                                {isSelected && (
                                    <Check className="h-4 w-4 shrink-0 text-telegram-link" aria-hidden />
                                )}
                            </button>
                        </li>
                    )
                })}
            </ul>
        </Modal>
    )
}
