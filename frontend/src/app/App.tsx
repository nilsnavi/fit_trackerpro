import { QueryProvider } from './providers/QueryProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { TelegramProvider } from './providers/TelegramProvider'
import { AppRouter } from './router'

export default function App() {
    return (
        <QueryProvider>
            <ThemeProvider>
                <TelegramProvider>
                    <AppRouter />
                </TelegramProvider>
            </ThemeProvider>
        </QueryProvider>
    )
}
