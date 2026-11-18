import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'FitTracker Pro 2.0',
        short_name: 'FitTracker',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0C1015',
        background_color: '#0C1015',
        icons: [{ src: '/fittracker-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cacheId: 'fittracker-v2-shell',
        cleanupOutdatedCaches: true
      },
      devOptions: { enabled: false }
    })
  ],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: { '/api': { target: process.env.V2_DEV_BACKEND_URL || 'http://127.0.0.1:8000', changeOrigin: true } }
  }
})
