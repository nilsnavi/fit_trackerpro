/* eslint-disable @typescript-eslint/no-var-requires */
import type React from 'react'
import { render, waitFor } from '@testing-library/react'
import App from '@/App'

// Smoke tests should verify routing + mount stability, not the correctness of every feature page.
// We mock lazy-loaded screens to avoid pulling real feature dependencies (API, offline queue, etc.)
jest.mock('@features/home/pages/Home', () => {
    const React = require('react')
    return { Home: () => React.createElement('div', null, 'Home') }
})
jest.mock('@features/workouts/pages/WorkoutsPage', () => {
    const React = require('react')
    return { WorkoutsPage: () => React.createElement('div', null, 'Workouts') }
})
jest.mock('@features/workouts/pages/WorkoutBuilderPage', () => {
    const React = require('react')
    return { WorkoutBuilderPage: () => React.createElement('div', null, 'Workout builder') }
})
jest.mock('@features/workouts/pages/WorkoutDetailPage', () => {
    const React = require('react')
    return { WorkoutDetailPage: () => React.createElement('div', null, 'Workout detail') }
})
jest.mock('@features/workouts/pages/WorkoutEditPage', () => {
    const React = require('react')
    return { WorkoutEditPage: () => React.createElement('div', null, 'Workout edit') }
})
jest.mock('@features/workouts/pages/WorkoutModePage', () => {
    const React = require('react')
    return { default: () => React.createElement('div', null, 'Workout mode') }
})
jest.mock('@features/workouts/pages/WorkoutHistoryPage', () => {
    const React = require('react')
    return { WorkoutHistoryPage: () => React.createElement('div', null, 'Workout history') }
})
jest.mock('@features/workouts/pages/Calendar', () => {
    const React = require('react')
    return { default: () => React.createElement('div', null, 'Workout calendar') }
})
jest.mock('@features/profile/pages/ProfilePage', () => {
    const React = require('react')
    return { default: () => React.createElement('div', null, 'Profile') }
})
jest.mock('@features/health/pages/HealthPage', () => {
    const React = require('react')
    return { HealthPage: () => React.createElement('div', null, 'Health') }
})
jest.mock('@features/analytics/pages/AnalyticsPage', () => {
    const React = require('react')
    return { default: () => React.createElement('div', null, 'Analytics') }
})
jest.mock('@features/exercises/pages/Catalog', () => {
    const React = require('react')
    return { default: () => React.createElement('div', null, 'Catalog') }
})
jest.mock('@features/exercises/pages/AddExercise', () => {
    const React = require('react')
    return { default: () => React.createElement('div', null, 'Add exercise') }
})
jest.mock('@features/auth/pages/LoginPage', () => {
    const React = require('react')
    return { LoginPage: () => React.createElement('div', null, 'Login') }
})

jest.mock('@app/layouts/AppShell', () => {
    const React = require('react')
    const { Outlet } = require('react-router-dom')
    return {
        AppShell: () =>
            React.createElement(
                'div',
                { 'data-app-shell': true },
                React.createElement(Outlet, null),
            ),
    }
})

jest.mock('@app/providers/QueryProvider', () => ({
    QueryProvider: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('@app/sentry', () => ({
    initSentry: jest.fn(),
    isSentryEnabled: () => false,
    setSentryClientContext: jest.fn(),
}))

function renderAt(path: string) {
    window.history.pushState({}, '', path)
    return render(<App />)
}

async function expectAppShellVisible() {
    await waitFor(() => {
        expect(document.querySelector('[data-app-shell]')).toBeInTheDocument()
    })
}

async function expectNoCrashFallback() {
    // Sentry error boundary fallback text from `App.tsx`
    await waitFor(() => {
        expect(document.body).not.toHaveTextContent('Something went wrong')
    })
}

describe('smoke: app routing', () => {
    beforeEach(() => {
        void (console.error as jest.Mock).mockClear?.()
        void (console.warn as jest.Mock).mockClear?.()
    })

    it('renders App without crashing', async () => {
        renderAt('/')
        await expectAppShellVisible()
        await expectNoCrashFallback()

        expect(console.error).not.toHaveBeenCalled()
    })

    it.each([
        '/',
        '/workouts',
        '/workouts/templates',
        '/workouts/templates/new',
        '/workouts/templates/1',
        '/workouts/templates/1/edit',
        '/workouts/active/1',
        '/workouts/history',
        '/exercises',
        '/progress',
        '/progress/exercises',
        '/progress/recovery',
        '/health',
        '/profile',
        '/login',
        '/exercises/add',
    ])('opens critical route %s without crash', async (path) => {
        renderAt(path)
        await expectAppShellVisible()
        await expectNoCrashFallback()

        expect(console.error).not.toHaveBeenCalled()
    })

    it('redirects unknown route to home', async () => {
        renderAt('/__unknown__')
        await expectAppShellVisible()
        await expectNoCrashFallback()

        await waitFor(() => {
            expect(window.location.pathname).toBe('/')
        })

        expect(console.error).not.toHaveBeenCalled()
    })
})

