import { useEffect, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@shared/ui/Button'
import { Card } from '@shared/ui/Card'
import { wipeLocalUserData, type WipeLocalUserDataReport } from '@shared/lib/wipeLocalUserData'

function closeTelegramApp(): boolean {
    const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
    if (!webApp?.initData || typeof webApp.close !== 'function') return false
    try {
        webApp.close()
        return true
    } catch {
        return false
    }
}

function isFullyWiped(report: WipeLocalUserDataReport): boolean {
    return (
        report.localStorage &&
        report.sessionStorage &&
        report.indexedDb &&
        report.telegramCloudStorage !== false
    )
}

/**
 * Terminal screen after `DELETE /users/me`. Rendered instead of the whole app (see
 * `AppRoot`), so it runs the device wipe only once the app tree — with its persisted
 * stores, sync queue and query persister — is gone. There is deliberately no
 * «войти снова»: in Telegram that login would immediately create a new account.
 */
export function AccountDeletedScreen() {
    const [report, setReport] = useState<WipeLocalUserDataReport | null>(null)
    const startedRef = useRef(false)
    const inTelegram = typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData)

    useEffect(() => {
        if (startedRef.current) return
        startedRef.current = true
        void wipeLocalUserData().then(setReport)
    }, [])

    return (
        <div className="flex min-h-dvh items-center justify-center bg-telegram-bg p-4">
            <Card variant="info" className="w-full max-w-md" data-testid="account-deleted-screen">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 shrink-0 text-success" aria-hidden />
                    <h1 className="text-lg font-semibold text-telegram-text">Аккаунт удалён</h1>
                </div>
                <p className="mt-3 text-sm text-telegram-text">
                    Ваш аккаунт и все связанные с ним данные удалены с сервера.
                </p>
                <p className="mt-2 text-sm text-telegram-hint" role="status" aria-live="polite">
                    {report === null
                        ? 'Удаляем данные с этого устройства…'
                        : isFullyWiped(report)
                          ? 'Данные на этом устройстве тоже удалены.'
                          : 'Часть данных на устройстве удалить не удалось — очистите данные приложения в настройках браузера или Telegram.'}
                </p>
                <p className="mt-2 text-sm text-telegram-hint">
                    Если вы снова откроете приложение, будет создан новый пустой аккаунт.
                </p>
                {inTelegram ? (
                    <Button
                        type="button"
                        className="mt-4 w-full"
                        disabled={report === null}
                        onClick={() => closeTelegramApp()}
                    >
                        Закрыть приложение
                    </Button>
                ) : (
                    <p className="mt-4 text-sm text-telegram-hint">Эту вкладку можно закрыть.</p>
                )}
            </Card>
        </div>
    )
}

export default AccountDeletedScreen
