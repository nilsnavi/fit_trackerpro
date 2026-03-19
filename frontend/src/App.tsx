import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { HomePage } from '@pages/HomePage'
import { WorkoutsPage } from '@pages/WorkoutsPage'
import { HealthPage } from '@pages/HealthPage'
import { ProfilePage } from '@pages/ProfilePage'
import { WorkoutBuilder } from '@pages/WorkoutBuilder'
import { Catalog } from '@pages/Catalog'
import { AddExercise } from '@pages/AddExercise'
import Analytics from '@pages/Analytics'
import { Navigation } from '@components/common/Navigation'

/**
 * Инициализация темы при загрузке приложения
 */
function initializeTheme() {
    const stored = localStorage.getItem('fittracker-theme') as 'light' | 'dark' | 'system' | null
    const theme = stored || 'system'
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const resolved = theme === 'system' ? systemTheme : theme

    if (resolved === 'dark') {
        document.documentElement.classList.add('dark')
        document.documentElement.classList.add('telegram-dark')
    }
}

function App() {
    // Инициализация темы при монтировании
    useEffect(() => {
        initializeTheme()
    }, [])

    return (
        <BrowserRouter>
            <div className="min-h-screen bg-telegram-bg text-telegram-text transition-colors duration-200">
                <main className="pb-20">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/workouts" element={<WorkoutsPage />} />
                        <Route path="/workouts/builder" element={<WorkoutBuilder />} />
                        <Route path="/exercises" element={<Catalog />} />
                        <Route path="/exercises/add" element={<AddExercise />} />
                        <Route path="/health" element={<HealthPage />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/profile" element={<ProfilePage />} />
                    </Routes>
                </main>
                <Navigation />
            </div>
        </BrowserRouter>
    )
}

export default App
