import type { WebApp } from '../shared/types/telegram'

declare global {
    interface Window {
        Telegram?: {
            WebApp?: WebApp
        }
    }
}

export {}
