import { Activity } from 'lucide-react'
import { GlucoseTracker } from '@features/health/components/GlucoseTracker'

export function HealthGlucosePage() {
    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-500" />
                <div>
                    <h1 className="text-lg font-semibold text-telegram-text">Глюкоза</h1>
                    <p className="text-sm text-telegram-hint">Добавляйте замеры и просматривайте статистику.</p>
                </div>
            </div>
            <GlucoseTracker />
        </div>
    )
}
