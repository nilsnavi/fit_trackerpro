describe('useWorkoutSessionDraftCloudSync (skeleton)', () => {
    it('hydrates local from cloud when cloud is newer', () => {
        // TODO: mock TelegramProvider context with cloudStorage.getItem returning newer blob
        // TODO: assert store hydrateFromRemote called
        expect(true).toBe(true)
    })

    it('pushes to cloud when local is newer', () => {
        // TODO: mock local updatedAt newer than cloud updatedAt; assert cloudStorage.setItem called
        expect(true).toBe(true)
    })

    it('removes cloud key when local workoutId becomes null', () => {
        // TODO: set store workoutId null and trigger subscribe; assert cloudStorage.removeItem called
        expect(true).toBe(true)
    })

    it('flushes on pagehide and on visibilitychange(hidden)', () => {
        // TODO: dispatch events and assert setItem/removeItem called immediately (debounce cleared)
        expect(true).toBe(true)
    })
})

