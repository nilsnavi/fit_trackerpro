import { Link } from 'react-router-dom'
import { Ruler } from 'lucide-react'
import { BodyMeasurementsSection } from '@features/health/components/BodyMeasurementsSection'

export function HealthMeasurementsPage() {
    return (
        <div className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-emerald-500" />
                    <div>
                        <h1 className="text-lg font-semibold text-telegram-text">Замеры тела</h1>
                        <p className="text-sm text-telegram-hint">Динамика обхватов по вашим записям.</p>
                    </div>
                </div>
                <Link to="/profile" className="shrink-0 text-sm font-medium text-primary">
                    Добавить
                </Link>
            </div>
            <BodyMeasurementsSection />
        </div>
    )
}
