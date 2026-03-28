import { QueryProvider } from './providers/QueryProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { TelegramProvider } from './providers/TelegramProvider'
import { AppRouter } from './router'

export default function App() {
    return (
        <QueryProvider>
            <TelegramProvider>
                <ThemeProvider>
                    <AppRouter />
                </ThemeProvider>
            </TelegramProvider>
        </QueryProvider>
    )
}
