import { Moon } from 'lucide-react'
import { WellnessCheckin } from '@features/health/components/WellnessCheckin'

export function HealthWellnessPage() {
    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center gap-2">
                <Moon className="h-5 w-5 text-indigo-500" />
                <div>
                    <h1 className="text-lg font-semibold text-telegram-text">Самочувствие и сон</h1>
                    <p className="text-sm text-telegram-hint">Утренняя отметка, рекомендации и история.</p>
                </div>
            </div>
            <WellnessCheckin />
        </div>
    )
}
