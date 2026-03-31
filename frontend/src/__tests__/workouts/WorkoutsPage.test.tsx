describe('WorkoutsPage (critical flow skeleton)', () => {
    it('shows draft banner when there is draftWorkoutId', () => {
        // TODO: mock draft store to return workoutId/title and assert banner text renders
        expect(true).toBe(true)
    })

    it('clears draft when draft remote fetch errors', () => {
        // TODO: mock useWorkoutHistoryItemQuery to isError for draft workoutId and assert clearDraft called
        expect(true).toBe(true)
    })

    it('starts workout from template and navigates to detail page', async () => {
        // TODO: mock templates list + useStartWorkoutMutation to resolve started id; click start button; assert navigate called
        expect(true).toBe(true)
    })
})

