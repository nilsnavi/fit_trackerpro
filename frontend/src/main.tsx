import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryProvider } from './app/providers/QueryProvider'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryProvider>
            <App />
        </QueryProvider>
    </React.StrictMode>,
)
