import { Bell, ChevronRight, Ruler, Settings, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Chip, ChipGroup } from '@shared/ui/Chip'
import { cn } from '@shared/lib/cn'
import { useProfile } from '@features/profile/hooks/useProfile'
import { ProfilePageSkeleton } from '@shared/ui/page-skeletons'

const EQUIPMENT_OPTIONS = [
    { value: 'barbell', label: 'Штанга', icon: '🏋️' }, { value: 'dumbbells', label: 'Гантели', icon: '🔩' },
    { value: 'kettlebell', label: 'Гиря', icon: '⚫' }, { value: 'pull_up_bar', label: 'Турник', icon: '🔧' },
    { value: 'bench', label: 'Скамья', icon: '🪑' }, { value: 'cable_machine', label: 'Блочный тренажер', icon: '🔌' },
    { value: 'smith_machine', label: 'Машина Смита', icon: '🏗️' }, { value: 'resistance_bands', label: 'Резинки', icon: '🎗️' },
    { value: 'bodyweight', label: 'Свой вес', icon: '🤸' },
]

const LIMITATION_OPTIONS = [
    { value: 'shoulder', label: 'Плечи' }, { value: 'knee', label: 'Колени' }, { value: 'back', label: 'Спина' },
    { value: 'wrist', label: 'Запястья' }, { value: 'elbow', label: 'Локти' }, { value: 'ankle', label: 'Лодыжки' },
    { value: 'hip', label: 'Таз' }, { value: 'neck', label: 'Шея' },
]

export function PreferencesPage() {
    const { profile, isLoading, updateProfile, updateSettings } = useProfile()
    if (isLoading) return <ProfilePageSkeleton />

    const toggleProfileList = (field: 'equipment' | 'limitations', value: string) => {
        const current = profile?.profile[field] ?? []
        void updateProfile({ [field]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] })
    }

    return (
        <div className="space-y-6 p-4 pb-24">
            <div>
                <h1 className="flex items-center gap-2 text-xl font-bold text-telegram-text"><Settings className="h-5 w-5 text-primary" />Настройки</h1>
                <p className="mt-1 text-sm text-telegram-hint">Оборудование, ограничения и параметры тренировок.</p>
            </div>
            <section className="space-y-5 rounded-2xl bg-telegram-secondary-bg p-4">
                <div>
                    <h2 className="mb-2 text-sm font-medium text-telegram-text">Оборудование</h2>
                    <ChipGroup wrap>{EQUIPMENT_OPTIONS.map((option) => <Chip key={option.value} label={`${option.icon} ${option.label}`} active={profile?.profile.equipment?.includes(option.value)} onClick={() => toggleProfileList('equipment', option.value)} size="sm" />)}</ChipGroup>
                </div>
                <div>
                    <h2 className="mb-2 text-sm font-medium text-telegram-text">Ограничения по здоровью</h2>
                    <ChipGroup wrap>{LIMITATION_OPTIONS.map((option) => <Chip key={option.value} label={option.label} active={profile?.profile.limitations?.includes(option.value)} onClick={() => toggleProfileList('limitations', option.value)} size="sm" variant="outlined" />)}</ChipGroup>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2"><Ruler className="h-4 w-4 text-telegram-hint" /><span className="text-sm text-telegram-text">Единицы измерения</span></div>
                    <div className="flex rounded-lg bg-telegram-bg p-1">{(['metric', 'imperial'] as const).map((unit) => <button key={unit} type="button" onClick={() => void updateSettings({ units: unit })} className={cn('rounded-md px-3 py-1 text-sm transition-all', profile?.settings.units === unit ? 'bg-primary text-white' : 'text-telegram-hint hover:text-telegram-text')}>{unit === 'metric' ? 'Метрические' : 'Имперские'}</button>)}</div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-telegram-hint" /><span className="text-sm text-telegram-text">Уведомления</span></div>
                    <button type="button" onClick={() => void updateSettings({ notifications: !profile?.settings.notifications })} className={cn('relative h-6 w-12 rounded-full transition-colors', profile?.settings.notifications ? 'bg-primary' : 'bg-telegram-hint/30')} aria-pressed={profile?.settings.notifications} aria-label="Уведомления"><span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all', profile?.settings.notifications ? 'left-6' : 'left-0.5')} /></button>
                </div>
                <Link to="/profile/progression-targets" className="flex items-center justify-between gap-3 border-t border-border pt-4"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-telegram-hint" /><div><span className="text-sm text-telegram-text">Цели прогрессии</span><p className="text-xs text-telegram-hint">Принятые веса и автоподстановка в тренировки</p></div></div><ChevronRight className="h-4 w-4 text-telegram-hint" /></Link>
            </section>
        </div>
    )
}

export default PreferencesPage
