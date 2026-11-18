# FitTracker Pro 2.0 — V2-00 Foundation

Independent Athlete + Coach React/Vite PWA scaffold.

## Local setup

```bash
cd apps/pwa-v2
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

Development: http://127.0.0.1:5174. Backend proxy: `/api` -> `http://127.0.0.1:8000` (override via `V2_DEV_BACKEND_URL`).

**Important:** V2-00 is a UI foundation, not a production-ready fitness tracker. Both screens explicitly display placeholders. No auth, real API, customer data or monetization are wired. PWA metadata/service worker are initialized but **installability remains incomplete until proper icons and real-device QA**. Offline workouts are not implemented here.

The original `frontend/`, FastAPI and database are untouched. Do not deploy V2-00 or expose it to real users.

## Follow-up gates

1. Commit a reproducible package-lock and switch CI to npm ci.
2. Implement Vitest unit tests and Playwright responsive smoke tests.
3. Add proper PWA icons and verify installation and offline shell.
4. Implement V2-01 design system from approved reference, then V2-02 web/TG authentication + API client.
5. Extract existing workout state machine only after integration and regression tests.

No runtime imports from `frontend/src`.
