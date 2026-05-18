/**
 * E2E Tests for Complete Workout Flow
 * 
 * Comprehensive tests covering:
 * 1. Quick Start flow
 * 2. Template flow  
 * 3. Validation
 * 4. Session restore
 * 5. Empty workout completion
 * 
 * Uses Playwright with mocked API for stability.
 */

import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

// Helper functions
async function navigateToDashboard(page: Page) {
    await page.goto('/workouts')
    await expect(page.locator('[data-testid="workout-dashboard"]')).toBeVisible()
}

async function startQuickStartWorkout(page: Page) {
    // Click Quick Start button
    await page.locator('[data-testid="quick-start-button"]').click()
    
    // Should navigate to active workout
    await expect(page.locator('[data-testid="active-workout-page"]')).toBeVisible()
}

async function addFirstExercise(page: Page, exerciseName = 'Жим лежа') {
    // Click "Add Exercise" in empty state
    await page.locator('[data-testid="add-exercise-button"]').click()
    
    // Select exercise from modal
    await page.locator(`[data-testid="exercise-option-${exerciseName}"]`).click()
    
    // Confirm selection
    await page.locator('[data-testid="confirm-exercise-button"]').click()
    
    // Exercise should appear
    await expect(page.locator(`[data-testid="exercise-card-${exerciseName}"]`)).toBeVisible()
}

async function addSetToExercise(page: Page, exerciseName: string, weight: string, reps: string) {
    const exerciseCard = page.locator(`[data-testid="exercise-card-${exerciseName}"]`)
    
    // Click "Add Set" button
    await exerciseCard.locator('[data-testid="add-set-button"]').click()
    
    // Fill weight and reps
    const setRow = exerciseCard.locator('[data-testid="set-row"]:last-child')
    await setRow.locator('[data-testid="set-weight-input"]').fill(weight)
    await setRow.locator('[data-testid="set-reps-input"]').fill(reps)
    
    // Complete the set
    await setRow.locator('[data-testid="complete-set-button"]').click()
    
    // Set should be marked as completed
    await expect(setRow.locator('[data-testid="set-status-completed"]')).toBeVisible()
}

async function completeWorkout(page: Page) {
    // Click finish button
    await page.locator('[data-testid="finish-workout-button"]').click()
    
    // Confirm in sheet/modal
    await page.locator('[data-testid="confirm-finish-button"]').click()
    
    // Should show summary
    await expect(page.locator('[data-testid="workout-summary"]')).toBeVisible()
}

test.describe('Quick Start Flow', () => {
    test('should complete full quick start workout flow', async ({ workoutAuthPage: page }) => {
        // 1. Open dashboard
        await navigateToDashboard(page)
        
        // 2. Click Quick Start
        await startQuickStartWorkout(page)
        
        // 3. See empty state
        await expect(page.locator('[data-testid="empty-workout-state"]')).toBeVisible()
        await expect(page.locator('[data-testid="empty-state-text"]')).toContainText('Добавь первое упражнение')
        
        // 4. Add exercise
        await addFirstExercise(page, 'Жим лежа')
        
        // 5. Verify empty state is gone
        await expect(page.locator('[data-testid="empty-workout-state"]')).not.toBeVisible()
        
        // 6. Add set with weight and reps
        await addSetToExercise(page, 'Жим лежа', '80', '10')
        
        // 7. See rest timer (if enabled)
        const restTimer = page.locator('[data-testid="rest-timer"]')
        if (await restTimer.isVisible()) {
            await expect(restTimer).toBeVisible()
        }
        
        // 8. Complete workout
        await completeWorkout(page)
        
        // 9. Verify summary is shown
        await expect(page.locator('[data-testid="summary-title"]')).toContainText('Тренировка завершена')
        await expect(page.locator('[data-testid="summary-sets-count"]')).toContainText('1')
    })
    
    test('should show haptic feedback on set completion', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Приседания')
        
        // Add set
        const exerciseCard = page.locator('[data-testid="exercise-card-Приседания"]')
        await exerciseCard.locator('[data-testid="add-set-button"]').click()
        
        const setRow = exerciseCard.locator('[data-testid="set-row"]:last-child')
        await setRow.locator('[data-testid="set-weight-input"]').fill('100')
        await setRow.locator('[data-testid="set-reps-input"]').fill('8')
        
        // Track haptic calls (mocked in telegram-mock.ts)
        const hapticCalls: any[] = []
        await page.exposeFunction('trackHaptic', (type: string, style?: string) => {
            hapticCalls.push({ type, style })
        })
        
        // Complete set
        await setRow.locator('[data-testid="complete-set-button"]').click()
        
        // Should trigger haptic feedback
        await expect(async () => {
            expect(hapticCalls.length).toBeGreaterThan(0)
        }).toPass()
    })
})

test.describe('Template Flow', () => {
    test('should complete workout from template', async ({ workoutAuthPage: page }) => {
        // Mock template data
        await page.route('**/api/v1/workouts/templates/*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 1,
                    name: 'Грудь + Трицепс',
                    exercises: [
                        {
                            id: 1,
                            name: 'Жим лежа',
                            sets: [
                                { weight: 80, reps: 10 },
                                { weight: 80, reps: 10 }
                            ]
                        }
                    ]
                })
            })
        })
        
        // 1. Open dashboard
        await navigateToDashboard(page)
        
        // 2. Click "Start Workout" (not Quick Start)
        await page.locator('[data-testid="start-workout-button"]').click()
        
        // 3. Select "My Templates"
        await page.locator('[data-testid="templates-tab"]').click()
        
        // 4. Select template
        await page.locator('[data-testid="template-card-1"]').click()
        
        // 5. Should see exercises from template
        await expect(page.locator('[data-testid="exercise-card-Жим лежа"]')).toBeVisible()
        
        // 6. Complete first set
        const exerciseCard = page.locator('[data-testid="exercise-card-Жим лежа"]')
        const firstSet = exerciseCard.locator('[data-testid="set-row"]:first-child')
        
        await firstSet.locator('[data-testid="set-weight-input"]').fill('80')
        await firstSet.locator('[data-testid="set-reps-input"]').fill('10')
        await firstSet.locator('[data-testid="complete-set-button"]').click()
        
        // 7. Check progress bar updated
        const progressBar = page.locator('[data-testid="workout-progress-bar"]')
        await expect(progressBar).toBeVisible()
        const progressWidth = await progressBar.locator('[data-testid="progress-fill"]').getAttribute('style')
        expect(progressWidth).toContain('width')
        
        // 8. Complete workout
        await completeWorkout(page)
        
        // 9. Verify summary
        await expect(page.locator('[data-testid="workout-summary"]')).toBeVisible()
    })
})

test.describe('Validation', () => {
    test('should prevent completing set without weight and reps', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Становая тяга')
        
        const exerciseCard = page.locator('[data-testid="exercise-card-Становая тяга"]')
        await exerciseCard.locator('[data-testid="add-set-button"]').click()
        
        const setRow = exerciseCard.locator('[data-testid="set-row"]:last-child')
        
        // Try to complete without filling weight/reps
        await setRow.locator('[data-testid="complete-set-button"]').click()
        
        // Should show inline error
        await expect(setRow.locator('[data-testid="set-validation-error"]')).toBeVisible()
        await expect(setRow.locator('[data-testid="validation-message"]')).toContainText('Заполните вес и повторы')
        
        // Set should NOT be marked as completed
        await expect(setRow.locator('[data-testid="set-status-pending"]')).toBeVisible()
    })
    
    test('should show error when only weight is filled', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Подтягивания')
        
        const exerciseCard = page.locator('[data-testid="exercise-card-Подтягивания"]')
        await exerciseCard.locator('[data-testid="add-set-button"]').click()
        
        const setRow = exerciseCard.locator('[data-testid="set-row"]:last-child')
        
        // Fill only weight
        await setRow.locator('[data-testid="set-weight-input"]').fill('70')
        await setRow.locator('[data-testid="complete-set-button"]').click()
        
        // Should still show error
        await expect(setRow.locator('[data-testid="set-validation-error"]')).toBeVisible()
    })
    
    test('should allow completing set when both fields are filled', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Армейский жим')
        
        const exerciseCard = page.locator('[data-testid="exercise-card-Армейский жим"]')
        await exerciseCard.locator('[data-testid="add-set-button"]').click()
        
        const setRow = exerciseCard.locator('[data-testid="set-row"]:last-child')
        
        // Fill both fields
        await setRow.locator('[data-testid="set-weight-input"]').fill('50')
        await setRow.locator('[data-testid="set-reps-input"]').fill('12')
        await setRow.locator('[data-testid="complete-set-button"]').click()
        
        // Should be completed successfully
        await expect(setRow.locator('[data-testid="set-status-completed"]')).toBeVisible()
        await expect(setRow.locator('[data-testid="set-validation-error"]')).not.toBeVisible()
    })
})

test.describe('Session Restore', () => {
    test('should restore active session after page refresh', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Бицепс штанга')
        
        // Add and complete a set
        await addSetToExercise(page, 'Бицепс штанга', '40', '12')
        
        // Get current URL (should contain workout ID)
        const urlBeforeRefresh = page.url()
        expect(urlBeforeRefresh).toContain('/workouts/active/')
        
        // Refresh page
        await page.reload()
        
        // Should restore to same workout
        await expect(page.locator('[data-testid="active-workout-page"]')).toBeVisible()
        await expect(page.locator('[data-testid="exercise-card-Бицепс штанга"]')).toBeVisible()
        
        // Completed set should still be there
        const exerciseCard = page.locator('[data-testid="exercise-card-Бицепс штанга"]')
        const setRow = exerciseCard.locator('[data-testid="set-row"]:first-child')
        await expect(setRow.locator('[data-testid="set-status-completed"]')).toBeVisible()
    })
    
    test('should persist draft workout in localStorage', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Трицепс блок')
        
        // Add set but don't complete
        const exerciseCard = page.locator('[data-testid="exercise-card-Трицепс блок"]')
        await exerciseCard.locator('[data-testid="add-set-button"]').click()
        
        const setRow = exerciseCard.locator('[data-testid="set-row"]:last-child')
        await setRow.locator('[data-testid="set-weight-input"]').fill('30')
        await setRow.locator('[data-testid="set-reps-input"]').fill('15')
        
        // Check localStorage has draft
        const localStorageData = await page.evaluate(() => {
            const keys = Object.keys(localStorage)
            const workoutKeys = keys.filter(k => k.includes('workout') || k.includes('draft'))
            return workoutKeys.map(k => ({ key: k, value: localStorage.getItem(k) }))
        })
        
        expect(localStorageData.length).toBeGreaterThan(0)
    })
})

test.describe('Empty Workout Completion', () => {
    test('should show warning when trying to complete empty workout', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        
        // Don't add any exercises
        
        // Try to finish workout
        await page.locator('[data-testid="finish-workout-button"]').click()
        
        // Should show warning dialog
        await expect(page.locator('[data-testid="empty-workout-warning"]')).toBeVisible()
        await expect(page.locator('[data-testid="warning-message"]')).toContainText('Добавьте хотя бы одно упражнение')
        
        // Cancel button should close dialog
        await page.locator('[data-testid="cancel-finish-button"]').click()
        await expect(page.locator('[data-testid="empty-workout-warning"]')).not.toBeVisible()
    })
    
    test('should prevent API call for empty workout completion', async ({ workoutAuthPage: page }) => {
        let apiCallMade = false
        
        // Intercept completion API call
        await page.route('**/api/v1/workouts/*/complete', async route => {
            apiCallMade = true
            await route.continue()
        })
        
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        
        // Try to finish without exercises
        await page.locator('[data-testid="finish-workout-button"]').click()
        await page.locator('[data-testid="confirm-finish-button"]').click()
        
        // Wait a bit to ensure no API call
        await page.waitForTimeout(500)
        
        // API should NOT be called
        expect(apiCallMade).toBe(false)
    })
})

test.describe('Rest Timer Flow', () => {
    test('should show rest timer after completing set', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Жим ногами')
        
        // Complete a set
        await addSetToExercise(page, 'Жим ногами', '150', '12')
        
        // Rest timer should appear
        const restTimer = page.locator('[data-testid="rest-timer"]')
        await expect(restTimer).toBeVisible()
        
        // Timer should have skip button
        await expect(restTimer.locator('[data-testid="skip-timer-button"]')).toBeVisible()
    })
    
    test('should skip rest timer when skip button clicked', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Разведение гантелей')
        
        await addSetToExercise(page, 'Разведение гантелей', '15', '15')
        
        const restTimer = page.locator('[data-testid="rest-timer"]')
        await expect(restTimer).toBeVisible()
        
        // Click skip
        await restTimer.locator('[data-testid="skip-timer-button"]').click()
        
        // Timer should disappear or reset
        await expect(restTimer).not.toBeVisible({ timeout: 2000 })
    })
})

test.describe('Multiple Exercises Flow', () => {
    test('should handle multiple exercises in one workout', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        
        // Add first exercise
        await addFirstExercise(page, 'Жим лежа')
        await addSetToExercise(page, 'Жим лежа', '80', '10')
        
        // Add second exercise
        await page.locator('[data-testid="add-exercise-button"]').click()
        await page.locator('[data-testid="exercise-option-Приседания"]').click()
        await page.locator('[data-testid="confirm-exercise-button"]').click()
        
        await expect(page.locator('[data-testid="exercise-card-Приседания"]')).toBeVisible()
        
        // Add set to second exercise
        await addSetToExercise(page, 'Приседания', '100', '8')
        
        // Both exercises should be visible
        await expect(page.locator('[data-testid="exercise-card-Жим лежа"]')).toBeVisible()
        await expect(page.locator('[data-testid="exercise-card-Приседания"]')).toBeVisible()
        
        // Complete workout
        await completeWorkout(page)
        
        // Summary should show 2 exercises
        await expect(page.locator('[data-testid="summary-exercises-count"]')).toContainText('2')
    })
})

test.describe('Performance & Stability', () => {
    test('should handle rapid set completions', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Берпи')
        
        const exerciseCard = page.locator('[data-testid="exercise-card-Берпи"]')
        
        // Add and complete 5 sets rapidly
        for (let i = 0; i < 5; i++) {
            await exerciseCard.locator('[data-testid="add-set-button"]').click()
            
            const setRow = exerciseCard.locator(`[data-testid="set-row"]:nth-child(${i + 1})`)
            await setRow.locator('[data-testid="set-weight-input"]').fill(`${20 + i * 5}`)
            await setRow.locator('[data-testid="set-reps-input"]').fill(`${10 + i}`)
            await setRow.locator('[data-testid="complete-set-button"]').click()
            
            // Small delay to allow UI to update
            await page.waitForTimeout(100)
        }
        
        // All 5 sets should be completed
        const completedSets = exerciseCard.locator('[data-testid="set-status-completed"]')
        await expect(completedSets).toHaveCount(5)
    })
    
    test('should not crash with invalid input', async ({ workoutAuthPage: page }) => {
        await navigateToDashboard(page)
        await startQuickStartWorkout(page)
        await addFirstExercise(page, 'Планка')
        
        const exerciseCard = page.locator('[data-testid="exercise-card-Планка"]')
        await exerciseCard.locator('[data-testid="add-set-button"]').click()
        
        const setRow = exerciseCard.locator('[data-testid="set-row"]:last-child')
        
        // Enter invalid values
        await setRow.locator('[data-testid="set-weight-input"]').fill('-10')
        await setRow.locator('[data-testid="set-reps-input"]').fill('abc')
        
        // Try to complete - should handle gracefully
        await setRow.locator('[data-testid="complete-set-button"]').click()
        
        // Should show validation error, not crash
        await expect(page.locator('[data-testid="active-workout-page"]')).toBeVisible()
    })
})
