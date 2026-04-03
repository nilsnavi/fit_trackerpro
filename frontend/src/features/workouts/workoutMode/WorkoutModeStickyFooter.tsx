import { Play, Save } from 'lucide-react'
import { StickyBottomBar } from '@shared/ui/StickyBottomBar'
import { Button } from '@shared/ui/Button'

interface WorkoutModeStickyFooterProps {
    onSave: () => void
    onSaveAndStart: () => void
    isSaving?: boolean
    isStarting?: boolean
    disabled?: boolean
}

export function WorkoutModeStickyFooter({
    onSave,
    onSaveAndStart,
    isSaving,
    isStarting,
    disabled,
}: WorkoutModeStickyFooterProps) {
    return (
        <StickyBottomBar aboveNav>
            <div className="flex gap-2">
                <Button
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    leftIcon={<Save className="h-4 w-4" />}
                    isLoading={isSaving}
                    disabled={disabled || isStarting}
                    onClick={onSave}
                    haptic="light"
                >
                    Сохранить
                </Button>
                <Button
                    variant="primary"
                    size="md"
                    className="flex-1"
                    leftIcon={<Play className="h-4 w-4" />}
                    isLoading={isStarting}
                    disabled={disabled || isSaving}
                    onClick={onSaveAndStart}
                    haptic="medium"
                >
                    Сохранить и начать
                </Button>
            </div>
        </StickyBottomBar>
    )
}
