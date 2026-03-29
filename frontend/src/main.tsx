import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry } from './app/sentry'
import { QueryProvider } from './app/providers/QueryProvider'
import App from './App'
import './styles/globals.css'

initSentry()

const rootElement = document.getElementById('root')
if (!rootElement) {
    throw new Error('Root element "#root" not found')
}

createRoot(rootElement).render(
    <StrictMode>
        <QueryProvider>
            <App />
        </QueryProvider>
    </StrictMode>,
)
