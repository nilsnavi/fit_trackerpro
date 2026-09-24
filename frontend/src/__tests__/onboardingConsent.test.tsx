/**
 * Онбординг без согласия на обработку данных о здоровье не должен ничего
 * сохранять (WS1-14): ни имя, ни цели, ни профиль.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { OnboardingScreen } from '@/components/Onboarding/OnboardingScreen'
import { authApi } from '@features/profile/api/authApi'

jest.mock('@features/profile/api/authApi', () => ({
    authApi: {
        updateCurrentUser: jest.fn(),
        saveOnboarding: jest.fn(),
    },
}))

const mockedUpdateCurrentUser = authApi.updateCurrentUser as jest.Mock
const mockedSaveOnboarding = authApi.saveOnboarding as jest.Mock

function renderOnboarding() {
    return render(
        <MemoryRouter>
            <OnboardingScreen onDone={jest.fn()} />
        </MemoryRouter>,
    )
}

describe('OnboardingScreen: согласие на обработку данных о здоровье', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockedUpdateCurrentUser.mockResolvedValue({})
        mockedSaveOnboarding.mockResolvedValue({})
    })

    it('keeps the submit button disabled until consent is given', () => {
        renderOnboarding()

        const submit = screen.getByTestId('onboarding-submit')
        expect(submit).toBeDisabled()

        fireEvent.click(screen.getByRole('checkbox', { name: /обработку данных о здоровье/ }))
        expect(submit).not.toBeDisabled()
    })

    it('links to the consent and privacy documents', () => {
        renderOnboarding()

        expect(screen.getByTestId('consent-link')).toHaveAttribute('href', '/legal/consent')
        expect(screen.getByRole('link', { name: /политику конфиденциальности/ })).toHaveAttribute(
            'href',
            '/legal/privacy',
        )
    })

    it('sends the consent flag and the document version together with the profile', async () => {
        renderOnboarding()

        fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Атлет' } })
        fireEvent.click(screen.getByRole('checkbox', { name: /обработку данных о здоровье/ }))
        fireEvent.click(screen.getByTestId('onboarding-submit'))

        await waitFor(() => {
            expect(mockedSaveOnboarding).toHaveBeenCalledWith(
                expect.objectContaining({
                    health_data_consent: true,
                    consent_version: expect.any(String),
                }),
            )
        })
    })

    it('does not call the API at all when consent is refused programmatically', async () => {
        renderOnboarding()

        fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Атлет' } })
        // Кнопка выключена, но и прямой вызов не должен проходить: проверяем через форму.
        fireEvent.submit(screen.getByTestId('onboarding-submit').closest('form') ?? document.body)

        expect(mockedUpdateCurrentUser).not.toHaveBeenCalled()
        expect(mockedSaveOnboarding).not.toHaveBeenCalled()
    })
})
