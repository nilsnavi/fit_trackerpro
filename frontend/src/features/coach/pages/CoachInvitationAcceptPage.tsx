import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, UserRound } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { EmptyState } from '@shared/ui/EmptyState'
import { getErrorMessage, AppHttpError } from '@shared/errors'
import { useAcceptCoachInvitation, useResolveCoachInvitation } from '../hooks/useCoachQueries'
import type { CoachInvitationResolution } from '../types/coach'

function invitationError(error: unknown): string {
    if (error instanceof AppHttpError) {
        if (error.status === 410) {
            if (/revok/i.test(error.message)) return 'Приглашение отозвано.'
            return 'Срок действия приглашения истёк или оно уже использовано.'
        }
        if (error.status === 404) return 'Приглашение недействительно.'
        if (error.status === 409) return 'Вы уже связаны с этим тренером или не можете принять это приглашение.'
    }
    return getErrorMessage(error)
}

export function CoachInvitationAcceptPage() {
    const navigate = useNavigate()
    const resolve = useResolveCoachInvitation()
    const accept = useAcceptCoachInvitation()
    const [token, setToken] = useState('')
    const [started, setStarted] = useState(false)
    const [invitation, setInvitation] = useState<CoachInvitationResolution | null>(null)
    const [resolveError, setResolveError] = useState<unknown>(null)
    const [acceptError, setAcceptError] = useState<unknown>(null)
    const [isResolving, setIsResolving] = useState(false)
    const [isAccepting, setIsAccepting] = useState(false)
    const [accepted, setAccepted] = useState(false)
    const consumed = useRef(false)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const candidate = params.get('token') || ''
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`)
        setToken(candidate)
        if (candidate && !consumed.current) {
            consumed.current = true
            setStarted(true)
            setIsResolving(true)
            void resolve.resolve(candidate).then(setInvitation).catch(setResolveError).finally(() => setIsResolving(false))
        }
        return () => {
            setToken('')
        }
        // Resolve exactly once for the token read from the initial URL.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!started) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Ссылка приглашения неполная" description="В ссылке не найден токен." /></div>
    if (isResolving) return <div className="p-4" role="status"><div className="h-28 animate-pulse rounded-2xl bg-telegram-secondary-bg" /></div>
    if (resolveError) return <div className="p-4"><EmptyState icon={AlertCircle} tone="telegram" title="Не удалось проверить приглашение" description={invitationError(resolveError)} /></div>
    if (accepted) return <div className="p-4"><EmptyState icon={CheckCircle2} tone="telegram" title="Вы подключены к тренеру" description="Приглашение принято." primaryAction={{ label: 'Готово', onClick: () => navigate('/home', { replace: true }) }} /></div>
    if (!invitation) return null
    const specializations = invitation.coach.specializations ?? []
    return <div className="mx-auto max-w-xl space-y-4 p-4 pb-24"><section className="rounded-2xl bg-telegram-secondary-bg p-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><UserRound /></span><div><p className="text-xs text-telegram-hint">Приглашает тренер</p><h1 className="text-xl font-bold">{invitation.coach.display_name}</h1></div></div>{invitation.coach.bio ? <p className="mt-4 whitespace-pre-wrap text-sm">{invitation.coach.bio}</p> : null}{specializations.length ? <p className="mt-3 text-sm text-telegram-hint">{specializations.join(' · ')}</p> : null}</section>{acceptError ? <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{invitationError(acceptError)}</p> : null}<Button fullWidth isLoading={isAccepting} onClick={() => { setIsAccepting(true); setAcceptError(null); void accept.accept(token).then(() => { setAccepted(true); setToken('') }).catch(setAcceptError).finally(() => setIsAccepting(false)) }}>Принять приглашение</Button><p className="text-center text-xs text-telegram-hint">Принятие создаст связь с этим тренером.</p></div>
}
