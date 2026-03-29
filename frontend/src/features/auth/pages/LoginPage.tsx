import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@shared/ui/Button'

/**
 * Заглушка: сюда ведёт редирект с профиля при отсутствии сессии.
 * Полноценный вход (Telegram / пароль) подключается отдельно.
 */
export function LoginPage() {
    const navigate = useNavigate()

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800"
                    aria-label="Назад"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Вход</h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Экран авторизации в разработке. После настройки входа здесь появится форма или виджет Telegram.
            </p>
            <Button type="button" variant="secondary" className="w-full" onClick={() => navigate('/')}>
                На главную
            </Button>
        </div>
    )
}
