import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Share2, UserPlus } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import { EmptyState } from '@shared/ui/EmptyState'
import { toast } from '@shared/stores/toastStore'
import { getErrorMessage } from '@shared/errors'
import { AppHttpError } from '@shared/errors'
import { EntitlementPaywall } from '../components/EntitlementPaywall'
import { useCreateCoachInvitation } from '../hooks/useCoachQueries'

import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp'

export function CoachInvitePage() {
    const telegram = useTelegramWebApp()
    const create = useCreateCoachInvitation()
    const [clientHint, setClientHint] = useState('')
    const [created, setCreated] = useState(false)
    const [shareUrl, setShareUrl] = useState('')
    const [isSharing, setIsSharing] = useState(false)
    const [paywallCode, setPaywallCode] = useState<string | null>(null)

    const submit = async () => {
        setCreated(false)
        try {
            const result = await create.create({ client_hint: clientHint.trim() || null })
            setCreated(true)
            const url = new URL('/coach/invitations/accept', window.location.origin)
            url.searchParams.set('token', result.token)
            setShareUrl(url.toString())
        } catch (error) {
            const code = error instanceof AppHttpError ? error.code : ''
            if (code === 'CLIENT_LIMIT_REACHED') { setPaywallCode(code); return }
            // Error is rendered from the mutation state below.
        }
    }

    const copy = async () => {
        if (!shareUrl) return
        try {
            await navigator.clipboard.writeText(shareUrl)
            toast.success('Ссылка скопирована')
        } catch {
            toast.error('Не удалось скопировать ссылку')
        }
    }

    const share = async () => {
        if (!shareUrl) return
        if (telegram.isTelegram && telegram.webApp) {
            telegram.webApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`)
            return
        }
        if (navigator.share) {
            setIsSharing(true)
            try { await navigator.share({ title: 'Приглашение тренера', url: shareUrl }) }
            catch { /* User cancellation is not an error. */ }
            finally { setIsSharing(false) }
            return
        }
        await copy()
    }

    if (create.error instanceof AppHttpError && create.error.status === 404) return <div className="p-4"><EmptyState icon={UserPlus} tone="telegram" title="Приглашения недоступны" description="Функция тренера сейчас отключена или приглашение недоступно." /></div>

    return <div className="mx-auto max-w-xl space-y-4 p-4 pb-24"><h1 className="text-xl font-bold">Пригласить клиента</h1><p className="text-sm text-telegram-hint">Ссылка действует 7 дней. Секрет приглашения показывается только при создании и не сохраняется в приложении.</p>
        {!created ? <div className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4"><Input label="Подсказка для вас (необязательно)" maxLength={255} value={clientHint} onChange={(e) => setClientHint(e.target.value)} /><Button fullWidth isLoading={create.isPending} onClick={() => void submit()}>Создать приглашение</Button>{create.isError ? <p role="alert" className="text-sm text-danger">{getErrorMessage(create.error)}</p> : null}</div> : <div className="space-y-3 rounded-2xl bg-telegram-secondary-bg p-4"><p className="font-semibold">Приглашение создано</p><p className="text-sm text-telegram-hint">Raw token доступен только сейчас. После ухода со страницы получить его повторно нельзя.</p><div className="break-all rounded-xl bg-telegram-bg p-3 text-sm" aria-label="Ссылка приглашения">{shareUrl}</div><div className="grid grid-cols-2 gap-2"><Button variant="secondary" leftIcon={<Copy />} onClick={() => void copy()}>Копировать</Button><Button isLoading={isSharing} leftIcon={<Share2 />} onClick={() => void share()}>Поделиться</Button></div><Button variant="ghost" onClick={() => { setCreated(false); setShareUrl('') }}>Готово</Button></div>}
        <Link className="text-sm text-primary" to="/coach">Вернуться в кабинет</Link>
        <EntitlementPaywall code={paywallCode} onClose={() => setPaywallCode(null)} />
    </div>
}
