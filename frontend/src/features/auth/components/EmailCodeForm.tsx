import { Button } from '@shared/ui/Button'
import { useEmailCode } from '../hooks/useEmailCode'

export function EmailCodeForm({ onLinked }: { onLinked?: () => void }) {
    const { email, setEmail, challengeId, code, setCode, pending, error, notice, sendCode, submit, changeEmail } =
        useEmailCode(onLinked)

    return (
        <form className="mt-4 space-y-3" onSubmit={(event) => {
            event.preventDefault()
            void submit()
        }}>
            <label className="block text-sm">
                Email
                <input
                    className="mt-1 block w-full rounded-xl border bg-telegram-bg p-3 text-telegram-text"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={254}
                    disabled={pending || challengeId !== null}
                    required
                />
            </label>
            {challengeId && (
                <label className="block text-sm">
                    Одноразовый код
                    <input
                        className="mt-1 block w-full rounded-xl border bg-telegram-bg p-3 text-telegram-text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        disabled={pending}
                        required
                    />
                </label>
            )}
            {notice && <p role="status" className="text-sm text-telegram-hint">{notice}</p>}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" isLoading={pending}>
                {challengeId ? (onLinked ? 'Подтвердить email' : 'Войти') : 'Получить код'}
            </Button>
            {challengeId && (
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" disabled={pending} onClick={() => void sendCode()}>
                        Отправить снова
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={changeEmail}
                    >
                        Изменить email
                    </Button>
                </div>
            )}
        </form>
    )
}
