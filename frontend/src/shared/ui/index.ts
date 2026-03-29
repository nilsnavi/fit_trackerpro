// ============================================
// FitTracker Pro — базовая дизайн-система (UI kit)
// Button, Input, Card, Badge, Modal, EmptyState, Skeleton + прочие shared-компоненты
// ============================================

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Card } from './Card';
export type { CardProps, CardVariant } from './Card';

export { Input } from './Input';
export type { InputProps, InputType, InputValidationState } from './Input';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant } from './Badge';

export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateTone, EmptyStateAction } from './EmptyState';

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps, ProgressColor } from './ProgressBar';

export { Chip, ChipGroup } from './Chip';
export type { ChipProps, ChipSize, ChipGroupProps } from './Chip';

export { Timer } from './Timer';
export type { TimerProps, TimerVariant, TimerState } from './Timer';

/** @deprecated Предпочитайте `EmptyState` */
export { SectionEmptyState } from './SectionEmptyState';
export type {
    SectionEmptyStateProps,
    SectionEmptyStateTone,
    SectionEmptyStateAction,
} from './SectionEmptyState';
