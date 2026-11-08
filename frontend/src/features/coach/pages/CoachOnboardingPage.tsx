import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage } from '@shared/errors'
import { AppHttpError } from '@shared/errors'
import { useCreateCoachProfile } from '../hooks/useCoachQueries'

export function CoachOnboardingPage() {
    const navigate = useNavigate()
    const createProfile = useCreateCoachProfile()
    const [displayName, setDisplayName] = useState('')
    const [bio, setBio] = useState('')
    const [specialization, setSpecialization] = useState('')
    const [specializations, setSpecializations] = useState<string[]>([])
    const [error, setError] = useState('')
    const unavailable = createProfile.error instanceof AppHttpError && createProfile.error.status === 404
    const duplicate = createProfile.error instanceof AppHttpError && createProfile.error.status === 409

    const addSpecialization = () => {
        const value = specialization.trim()
        if (value && !specializations.includes(value) && specializations.length < 30) {
            setSpecializations((items) => [...items, value])
            setSpecialization('')
        }
    }

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        setError('')
        if (!displayName.trim()) {
            setError('Укажите имя тренера')
            return
        }
        try {
            await createProfile.mutateAsync({ display_name: displayName.trim(), bio: bio.trim() || null, specializations })
            navigate('/coach', { replace: true })
        } catch {
            // The server error is shown below in the existing error state.
        }
    }

    if (unavailable) return <div className="p-4"><EmptyState icon={X} tone="telegram" title="Функция тренера недоступна" description="Попробуйте позже." /></div>

    return <div className="mx-auto max-w-xl space-y-5 p-4 pb-24">
        <div><h1 className="text-xl font-bold">Стать тренером</h1><p className="mt-1 text-sm text-telegram-hint">Создайте профиль тренера. Профиль будет привязан к вашему аккаунту.</p></div>
        {duplicate ? <div role="alert" className="rounded-xl bg-warning/10 p-3 text-sm text-telegram-text">Профиль тренера уже существует. <button className="font-semibold text-primary" onClick={() => navigate('/coach')}>Открыть кабинет</button></div> : null}
        {createProfile.isError && !duplicate ? <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{getErrorMessage(createProfile.error)}</p> : null}
        <form className="space-y-4 rounded-2xl bg-telegram-secondary-bg p-4" onSubmit={submit}>
            <Input label="Имя тренера" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={255} required />
            <label className="block space-y-1 text-sm"><span className="font-medium">О себе</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} rows={4} className="w-full rounded-xl bg-telegram-bg p-3 text-telegram-text outline-none focus:ring-2 focus:ring-primary/30" /></label>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="coach-specialization">Специализации</label><div className="flex gap-2"><Input id="coach-specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} maxLength={80} /><Button type="button" variant="secondary" aria-label="Добавить специализацию" onClick={addSpecialization} leftIcon={<Plus />} /></div>
                <div className="flex flex-wrap gap-2">{specializations.map((item) => <span key={item} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{item}<button type="button" aria-label={`Удалить ${item}`} onClick={() => setSpecializations((items) => items.filter((value) => value !== item))}><X className="h-3 w-3" /></button></span>)}</div>
            </div>
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" fullWidth isLoading={createProfile.isPending}>Создать профиль</Button>
            <Button type="button" variant="ghost" fullWidth leftIcon={<ArrowLeft />} onClick={() => navigate('/profile')}>Назад в профиль</Button>
        </form>
    </div>
}
