import { Droplets } from 'lucide-react'
import { WaterTracker } from '@features/health/components/WaterTracker'

export function HealthWaterPage() {
    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-500" />
                <div>
                    <h1 className="text-lg font-semibold text-telegram-text">Вода</h1>
                    <p className="text-sm text-telegram-hint">Отмечайте воду, цель и напоминания.</p>
                </div>
            </div>
            <WaterTracker />
        </div>
    )
}
