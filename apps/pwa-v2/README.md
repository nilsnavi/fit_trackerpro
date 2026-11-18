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

1. Reproducible `package-lock.json` and CI `npm ci`: done. Two Vitest route smoke tests added.
2. Add Playwright responsive E2E tests, proper PWA icons, and verify installability and offline shell.
3. Implement V2-01 design system from approved reference, then V2-02 web/TG authentication + API client.
4. Extract existing workout state machine only after integration and regression tests.

No runtime imports from `frontend/src`.

## Premium PWA icon assets

The source mark is `public/fittracker-mark.svg`. Raster assets under `public/icons/` are **generated from the same source**:

```bash
python3 -m pip install 'cairosvg==2.7.1'
python3 scripts/generate_pwa_icons.py
npm run icons:verify
```

This creates Android PNG 192×192, 512×512, maskable 512×512 with a full-bleed dark background and safe inset, plus Apple Touch 180×180. CI regenerates and verifies icons before building. The PNG files are generated assets, not hand-edited. Production deployment must execute generation as part of its build pipeline; V2 is not deployed yet. Browser installation on real iOS/Android still requires manual QA.
