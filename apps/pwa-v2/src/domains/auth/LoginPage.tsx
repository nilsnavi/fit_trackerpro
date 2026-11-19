import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthApiClient, AuthHttpError } from '../../shared/api/auth'
import { sessionManager } from '../../shared/auth/sessionRuntime'
import { Button, Card } from '../../shared/ui/PremiumUI'
import { SignatureIcon } from '../../shared/ui/SignatureIcon'
import { authenticateTelegram, readTelegramInitData } from '../../shared/auth/telegram'

const api = new AuthApiClient()
function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/athlete'
  // Coach remains closed until entitlement gate V2-02C.
  return value.startsWith('/coach') ? '/athlete' : value
}

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const telegramData = readTelegramInitData(typeof window === 'undefined' ? undefined : window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
  async function connectTelegram() {
    if (!telegramData || busy) return
    setBusy(true); setError('')
    try {
      await authenticateTelegram(telegramData, sessionManager, api)
      navigate(safeReturnPath(params.get('from')), { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ошибка входа через Telegram.')
    } finally { setBusy(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      if (!challenge) {
        const result = await api.requestEmailCode(email)
        setChallenge(result.challenge_id)
      } else {
        const tokens = await api.verifyEmailCode(challenge, code)
        await sessionManager.establish(tokens)
        navigate(safeReturnPath(params.get('from')), { replace: true })
      }
    } catch (cause) {
      const message = cause instanceof AuthHttpError && cause.status === 429
        ? 'Слишком много запросов. Попробуйте позже.'
        : cause instanceof Error ? cause.message : 'Не удалось выполнить вход.'
      setError(message)
    } finally { setBusy(false) }
  }

  return <main className="ftp-auth-layout">
    <div className="ftp-auth-brand"><span className="ftp-brand__mark"><SignatureIcon name="brand" size={30}/></span><strong>FITTRACKER<span>PRO</span></strong></div>
    <Card className="ftp-auth-card">
      <div className="ftp-eyebrow">ПЕРСОНАЛЬНОЕ ПРОСТРАНСТВО</div>
      <h1>{challenge ? 'Подтвердите почту' : 'С возвращением.'}</h1>
      <p>{challenge ? 'Введите шестизначный код, отправленный на вашу почту.' : 'Войдите в FitTracker Pro с помощью одноразового кода.'}</p>
      <form onSubmit={event => { void submit(event) }} className="ftp-auth-form">
        {!challenge ? <>
          <label htmlFor="ftp-login-email">Электронная почта</label>
          <input id="ftp-login-email" type="email" autoComplete="email" required maxLength={254}
            placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}/>
        </> : <>
          <label htmlFor="ftp-login-code">Код подтверждения</label>
          <input id="ftp-login-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            autoComplete="one-time-code" required placeholder="000000" value={code}
            onChange={e => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}/>
        </>}
        {error && <p className="ftp-auth-error" role="alert">{error}</p>}
        <Button disabled={busy} type="submit">{busy ? 'Проверяем…' : challenge ? 'Подтвердить и войти' : 'Получить код'}</Button>
        {challenge && <Button tone="ghost" type="button" disabled={busy} onClick={() => { setChallenge(''); setCode(''); setError('') }}>Изменить почту / запросить новый код</Button>}
      </form>
      {telegramData && <Button tone="secondary" disabled={busy} onClick={() => { void connectTelegram() }} className="ftp-telegram-login">Войти через Telegram</Button>}
      <p className="ftp-auth-caption">Telegram-вход доступен только внутри настоящего Telegram Mini App. Сервер проверяет подпись и срок действия данных. Email требует настроенного SMTP.</p>
    </Card>
  </main>
}
