import type { ReactNode } from 'react'
import { Button, type ButtonSize, type ButtonVariant } from '@shared/ui/Button'
import { StickyBottomBar } from '@shared/ui/StickyBottomBar'

interface WorkoutActionRailButton {
    id: string
    label: string
    onClick: () => void
    variant?: ButtonVariant
    size?: ButtonSize
    leftIcon?: ReactNode
    rightIcon?: ReactNode
    disabled?: boolean
    isLoading?: boolean
    fullWidth?: boolean
    className?: string
}

interface WorkoutActionRailProps {
    sections: WorkoutActionRailButton[][]
    topSlot?: ReactNode
    className?: string
    /** When true the bar collapses to a drag handle and expands on swipe-up */
    collapsible?: boolean
}

export function WorkoutActionRail({ sections, topSlot, className, collapsible }: WorkoutActionRailProps) {
    return (
        <StickyBottomBar className={className} collapsible={collapsible}>
            {topSlot}
            {sections.map((section, sectionIndex) => {
                if (section.length === 1) {
                    const item = section[0]
                    return (
                        <Button
                            key={`${sectionIndex}-${item.id}`}
                            type="button"
                            variant={item.variant}
                            size={item.size ?? 'md'}
                            onClick={item.onClick}
                            leftIcon={item.leftIcon}
                            rightIcon={item.rightIcon}
                            disabled={item.disabled}
                            isLoading={item.isLoading}
                            className={item.className}
                            fullWidth={item.fullWidth ?? true}
                        >
                            {item.label}
                        </Button>
                    )
                }

                return (
                    <div
                        key={sectionIndex}
                        className={`grid gap-2 ${section.length === 2 ? 'grid-cols-2' : section.length >= 3 ? 'grid-cols-3' : 'grid-cols-1'}`}
                    >
                        {section.map((item) => (
                            <Button
                                key={`${sectionIndex}-${item.id}`}
                                type="button"
                                variant={item.variant}
                                size={item.size ?? 'md'}
                                onClick={item.onClick}
                                leftIcon={item.leftIcon}
                                rightIcon={item.rightIcon}
                                disabled={item.disabled}
                                isLoading={item.isLoading}
                                className={item.className}
                                fullWidth={item.fullWidth ?? true}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </div>
                )
            })}
        </StickyBottomBar>
    )
}
