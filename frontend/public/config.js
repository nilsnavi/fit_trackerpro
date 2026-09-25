// Local dev (`npm run dev`) only. Empty values fall back to Vite env (`VITE_*`, see
// .env.example) and then to same-origin defaults (`/api/v1`, proxied by vite.config.ts).
// Never put production URLs here: this file overrides VITE_API_URL, so a prod value makes
// every local session (and Playwright's dev server) talk to the production API.
// In Docker, startup.sh regenerates this file from config.template.js.
window.__APP_CONFIG__ = {
  API_URL: '',
  ADMIN_USER_IDS: '',
  TELEGRAM_BOT_USERNAME: '',
  TELEGRAM_WEBAPP_URL: '',
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: '',
  SENTRY_RELEASE: '',
  SENTRY_DIST: '',
};
