import { Settings, Bell, Shield, HelpCircle, ChevronRight, LogOut } from 'lucide-react'
import { ThemeToggle } from '@components/ui/ThemeToggle'

const menuItems = [
    { icon: Settings, label: 'Настройки', path: '/settings' },
    { icon: Bell, label: 'Уведомления', path: '/notifications' },
    { icon: Shield, label: 'Приватность и безопасность', path: '/privacy' },
    { icon: HelpCircle, label: 'Помощь и поддержка', path: '/help' },
]

export function ProfilePage() {
    return (
        <div className="p-4 space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold">
                    U
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        Имя пользователя
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">@username</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-500 dark:text-blue-300 text-xs rounded-full font-medium">
                            Pro Member
                        </span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-500 dark:text-green-300 text-xs rounded-full font-medium">
                            Активен
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl">
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">127</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Тренировок</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">45</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Дней активности</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">12</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Достижений</div>
                    </div>
                </div>
            </div>

            {/* Theme Toggle */}
            <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Тема оформления</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Выберите светлую или темную тему</p>
                    </div>
                    <ThemeToggle variant="minimal" />
                </div>
            </div>

            {/* Menu */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Настройки</h2>
                <div className="space-y-1">
                    {menuItems.map(({ icon: Icon, label, path }) => (
                        <button
                            key={path}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                <span className="text-gray-900 dark:text-white font-medium">{label}</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        </button>
                    ))}
                </div>
            </div>

            {/* Logout */}
            <button
                className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
                <LogOut className="w-5 h-5" />
                Выйти
            </button>

            {/* Version */}
            <div className="text-center text-xs text-gray-400 dark:text-gray-500">
                FitTracker Pro v1.0.0
            </div>
        </div>
    )
}
