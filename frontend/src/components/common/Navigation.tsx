import { NavLink } from 'react-router-dom'
import { Home, Dumbbell, User, Library, BarChart3 } from 'lucide-react'
import { cn } from '@utils/cn'

const navItems = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/exercises', icon: Library, label: 'Каталог' },
    { path: '/workouts', icon: Dumbbell, label: 'Тренировки' },
    { path: '/analytics', icon: BarChart3, label: 'Статистика' },
    { path: '/profile', icon: User, label: 'Профиль' },
]

export function Navigation() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-telegram-bg border-t border-border z-50 transition-colors duration-200">
            <div className="flex justify-around items-center h-16">
                {navItems.map(({ path, icon: Icon, label }) => (
                    <NavLink
                        key={path}
                        to={path}
                        className={({ isActive }) =>
                            cn(
                                'flex flex-col items-center justify-center w-full h-full transition-colors',
                                isActive
                                    ? 'text-primary'
                                    : 'text-telegram-hint hover:text-telegram-text'
                            )
                        }
                    >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs mt-1">{label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    )
}
