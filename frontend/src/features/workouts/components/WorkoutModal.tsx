import type { ReactNode } from 'react'
import { Button, type ButtonProps } from '@shared/ui/Button'
import { Modal, type ModalProps } from '@shared/ui/Modal'
import { cn } from '@shared/lib/cn'

type WorkoutModalAction = Omit<ButtonProps, 'children'> & {
    label: ReactNode
}

interface WorkoutModalProps
    extends Pick<
        ModalProps,
        | 'isOpen'
        | 'onClose'
        | 'size'
        | 'className'
        | 'closeOnEscape'
        | 'closeOnOverlayClick'
        | 'showHandle'
        | 'haptic'
    > {
    title: string
    description?: ReactNode
    children: ReactNode
    bodyClassName?: string
    footer?: ReactNode
    footerClassName?: string
    actionsClassName?: string
    primaryAction?: WorkoutModalAction
    secondaryAction?: WorkoutModalAction
}

function renderAction(action: WorkoutModalAction, key: string) {
    const { label, className, fullWidth = true, ...buttonProps } = action

    return (
        <Button
            key={key}
            fullWidth={fullWidth}
            className={cn('min-w-0', className)}
            {...buttonProps}
        >
            {label}
        </Button>
    )
}

export function WorkoutModal({
    title,
    description,
    children,
    bodyClassName,
    footer,
    footerClassName,
    actionsClassName,
    primaryAction,
    secondaryAction,
    ...modalProps
}: WorkoutModalProps) {
    const resolvedFooter = footer ??
        (primaryAction || secondaryAction ? (
            <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', actionsClassName)}>
                {secondaryAction ? renderAction(secondaryAction, 'secondary') : null}
                {primaryAction ? renderAction(primaryAction, 'primary') : null}
            </div>
        ) : null)

    return (
        <Modal
            {...modalProps}
            title={title}
            description={description}
            bodyClassName={bodyClassName}
            footer={resolvedFooter}
            footerClassName={footerClassName}
        >
            {children}
        </Modal>
    )
}
