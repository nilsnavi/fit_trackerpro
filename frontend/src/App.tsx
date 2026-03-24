import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { HomePage } from '@pages/HomePage'
import { WorkoutsPage } from '@pages/WorkoutsPage'
import { HealthPage } from '@pages/HealthPage'
import { ProfilePage } from '@pages/ProfilePage'
import { WorkoutBuilder } from '@pages/WorkoutBuilder'
import { WorkoutDetailPage } from '@pages/WorkoutDetailPage'
import { Catalog } from '@pages/Catalog'
import { AddExercise } from '@pages/AddExercise'
import Analytics from '@pages/Analytics'
import { Navigation } from '@components/common/Navigation'
import { useTelegramWebApp } from '@hooks/useTelegramWebApp'
import { useTheme } from '@hooks/useTheme'

/**
 * Initialize Telegram WebApp and sync theme
 */
function AppContent() {
    const tg = useTelegramWebApp()
    const { setTheme } = useTheme()

    // Initialize Telegram WebApp on mount
    useEffect(() => {
        if (tg.isTelegram) {
            // Initialize the WebApp
            tg.init()

            // Expand to full height
            tg.expand()

            // Set header and background colors
            tg.setHeaderColor('bg_color')
            tg.setBackgroundColor('bg_color')

            // Enable closing confirmation to prevent accidental closes
            tg.enableClosingConfirmation()
        }
    }, [tg])

    // Sync Telegram theme with app theme
    useEffect(() => {
        if (tg.isTelegram && tg.colorScheme) {
            // Set app theme based on Telegram color scheme
            setTheme(tg.colorScheme)
        }
    }, [tg.isTelegram, tg.colorScheme, setTheme])

    // Theme change is already handled in useTelegramWebApp hook

    return (
        <BrowserRouter>
            <div className="min-h-screen bg-telegram-bg text-telegram-text transition-colors duration-200">
                <main className="pb-20">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/workouts" element={<WorkoutsPage />} />
                        <Route path="/workouts/builder" element={<WorkoutBuilder />} />
                        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
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

function App() {
    return <AppContent />
}

export default App
