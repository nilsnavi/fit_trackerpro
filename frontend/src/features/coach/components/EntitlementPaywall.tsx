import { Link } from 'react-router-dom'
import { Modal } from '@shared/ui/Modal'

type Props = { code: string | null; onClose: () => void }

export function EntitlementPaywall({ code, onClose }: Props) {
    if (!code) return null
    const isClients = code === 'CLIENT_LIMIT_REACHED'
    const isPrograms = code === 'PROGRAM_LIMIT_REACHED'
    const title = isClients ? 'Лимит клиентов достигнут' : isPrograms ? 'Лимит программ достигнут' : 'Функция доступна в Trainer Pro'
    const description = isClients
        ? 'На бесплатном тарифе можно вести до 3 активных и приостановленных клиентов.'
        : isPrograms
            ? 'На бесплатном тарифе можно хранить до 2 черновых и активных программ.'
            : 'Расширенные фильтры мониторинга доступны в Trainer Pro.'
    return <Modal isOpen onClose={onClose} title={title}>
        <div className="space-y-4 p-4"><p className="text-sm text-telegram-hint">{description}</p>
            <Link className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" to="/coach/subscription" onClick={onClose}>Узнать о Trainer Pro</Link>
            <button className="h-10 w-full rounded-xl bg-telegram-secondary-bg text-sm" onClick={onClose}>Позже</button>
        </div>
    </Modal>
}
