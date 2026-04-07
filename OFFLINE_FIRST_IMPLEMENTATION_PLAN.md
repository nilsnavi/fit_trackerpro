# Offline-First Workout Data Persistence – Implementation Plan

**Date:** April 7, 2026  
**Status:** 🚀 Ready for Implementation  
**Priority:** 🔴 Critical for MVP

---

## Executive Summary

Ensure **zero data loss** for workout sessions across:
- ✅ Browser refresh
- ✅ Telegram Mini App reopen
- ✅ Temporary offline periods
- ✅ Network interruptions during sync

**Key principle:** _All workout data lives locally first, syncs to server when possible._

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ACTIVE WORKOUT PAGE                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ useActiveWorkoutSync (existing debounce 2000ms)         │ │
│  │ ├─ if ONLINE: queue PATCH to sync queue                │ │
│  │ └─ if OFFLINE: mark 'offline-queued', await retry      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                           ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ useActiveWorkoutDraftPersist  (NEW)                      │ │
│  │ ├─ saves to localStorage every change                   │ │
│  │ ├─ debounce 500ms to avoid I/O thrashing               │ │
│  │ └─ persist: exercises, elapsed, position, syncVersion   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                           ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Zustand activeWorkoutStore                              │ │
│  │ ├─ exercises[], elapsedSeconds, currentPosition         │ │
│  │ └─ syncState, syncVersion (optimistic locking)          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              SYNC QUEUE ENGINE (existing)                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SyncQueueItem: SESSION_UPDATE, COMPLETE                 │ │
│ │ ├─ idempotencyKey (UUID per operation)                  │ │
│ │ ├─ statusVersion (for conflict detection)               │ │
│ │ └─ persists to: fittracker_sync_queue_v1                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                           ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ executeWorkoutSyncOp (enhanced)                         │ │
│  │ ├─ PATCH /api/v1/workouts/history/{id}                 │ │
│  │ │  └─ with idempotency_key + expected_version          │ │
│  │ └─ POST /api/v1/workouts/history/{id}/complete         │ │
│  │    └─ with idempotency_key + expected_version          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    BACKEND (FastAPI)
```

---

## 2. Frontend Implementation

### 2.1 Enhanced Draft Persistence

**File:** `frontend/src/stores/activeWorkoutSessionDraftStore.ts` (NEW)

```typescript
interface ActiveWorkoutSessionDraft {
  // Session metadata
  workoutId: number
  templateId?: number
  startedAt: number
  
  // State snapshot
  exercises: CompletedExercise[]
  elapsedSeconds: number
  currentExerciseIndex: number
  currentSetIndex: number
  comments?: string
  tags?: string[]
  
  // Sync tracking
  lastSyncedAt: number
  lastSyncedVersion: number
  idempotencyKeysByOp: Record<string, string> // for replay protection
  
  // Timestamps
  createdAt: number
  updatedAt: number
}

interface ActiveWorkoutSessionDraftStore {
  draft: ActiveWorkoutSessionDraft | null
  saveDraft(data: Partial<ActiveWorkoutSessionDraft>): void
  restoreDraft(): ActiveWorkoutSessionDraft | null
  clearDraft(): void
}
```

**Persistence:** `localStorage` with key `fittracker_active_session_draft_{userId}`

**Retention:** Until completion or explicit abandon (no TTL)

### 2.2 Local Draft Sync Hook

**File:** `frontend/src/features/workouts/active/hooks/useActiveWorkoutDraftPersist.ts` (NEW)

```typescript
export function useActiveWorkoutDraftPersist(
  workoutId: number,
  workout: WorkoutHistoryItem | undefined,
  isActiveDraft: boolean,
) {
  // Debounced save to localStorage
  const debouncedSave = useDebouncedCallback(() => {
    if (!workout || !isActiveDraft) return
    
    activeWorkoutSessionDraftStore.saveDraft({
      workoutId,
      exercises: workout.exercises,
      elapsedSeconds: ...,
      currentExerciseIndex: ...,
      updatedAt: Date.now(),
    })
  }, 500)

  useEffect(() => {
    debouncedSave()
  }, [workout, isActiveDraft])
}
```

### 2.3 Sync Queue Extensions

**File:** `frontend/src/shared/offline/syncQueue/workoutKinds.ts` (UPDATED)

```typescript
export const WORKOUT_SYNC_KINDS = {
  // ... existing
  SESSION_UPDATE: 'SESSION_UPDATE',        // PATCH session
  SESSION_COMPLETE: 'SESSION_COMPLETE',    // finalize
  SESSION_COMPLETE_AND_SYNC: 'complete_and_sync', // combined
} as const
```

**File:** `frontend/src/shared/offline/workoutOfflineEnqueue.ts` (UPDATED)

```typescript
export function enqueueOfflineSessionUpdate(
  workoutId: number,
  payload: WorkoutSessionUpdateRequest,
  expectedVersion: number,
): never {
  const idempotencyKey = `session:update:${workoutId}:${uuid()}`
  
  enqueueSyncMutation({
    kind: WORKOUT_SYNC_KINDS.SESSION_UPDATE,
    dedupeKey: `session:update:${workoutId}`,
    payload: { workoutId, body: payload, expectedVersion, idempotencyKey },
    idempotencyKey, // for tracking
  })
  
  requestSyncFlush()
  throw new OfflineMutationQueuedError()
}

export function enqueueOfflineSessionComplete(
  workoutId: number,
  payload: WorkoutCompleteRequest,
  expectedVersion: number,
): never {
  const idempotencyKey = `session:complete:${workoutId}:${uuid()}`
  
  enqueueSyncMutation({
    kind: WORKOUT_SYNC_KINDS.SESSION_COMPLETE,
    dedupeKey: `session:complete:${workoutId}`,
    payload: { workoutId, body: payload, expectedVersion, idempotencyKey },
    idempotencyKey,
  })
  
  requestSyncFlush()
  throw new OfflineMutationQueuedError()
}
```

### 2.4 Enhanced Sync Queue Engine

**File:** `frontend/src/shared/offline/syncQueue/types.ts` (UPDATED)

```typescript
export type SyncQueueItem = {
  id: string
  kind: string
  dedupeKey: string
  payload: unknown
  idempotencyKey?: string  // NEW: for idempotent retry
  createdAt: number
  attempts: number
  status: SyncQueueItemStatus
  lastError?: string
  nextRetryAt: number
  failedAt?: number
  // Versioning for conflict detection
  expectedVersion?: number  // NEW
  conflictVersion?: number  // server version on failure
}
```

### 2.5 Enhanced UI States

**File:** `frontend/src/stores/activeWorkoutStore.ts` (UPDATED)

```typescript
export type ActiveWorkoutSyncState = 
  | 'idle'              // no pending changes
  | 'saved-locally'     // persisted to localStorage
  | 'syncing'           // sending to server
  | 'synced'            // confirmed on server
  | 'offline-queued'    // awaiting network
  | 'error'             // server error, can retry
  | 'conflict'          // version mismatch, needs merge
```

**File:** `frontend/src/features/workouts/active/components/WorkoutSyncIndicator.tsx` (UPDATED)

```typescript
const SYNC_CONFIG: Record<SyncState, SyncConfig> = {
  'idle': { icon: null, text: '', className: '' },
  'saved-locally': {
    icon: <HardDrive className="h-3.5 w-3.5" />,
    text: 'Сохранено локально',
    className: 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/30',
  },
  'syncing': {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    text: 'Синхронизация…',
    className: 'text-telegram-hint bg-telegram-secondary-bg/80',
  },
  'synced': {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    text: 'Сохранено',
    className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30',
  },
  'offline-queued': {
    icon: <CloudOff className="h-3.5 w-3.5" />,
    text: 'В очереди (офлайн)',
    className: 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30',
  },
  'error': {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    text: 'Ошибка синхронизации',
    className: 'text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-950/30',
  },
  'conflict': {
    icon: <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />,
    text: 'Конфликт данных',
    className: 'text-orange-600 dark:text-orange-400 bg-orange-50/80 dark:bg-orange-950/30',
  },
}
```

---

## 3. Backend Implementation

### 3.1 Idempotency & Versioning

**Endpoints to enhance:**

```python
# PATCH /api/v1/workouts/history/{workout_id}
class WorkoutSessionUpdateRequest(BaseModel):
    exercises?: List[ExerciseUpdate]
    comments?: str
    tags?: List[str]
    idempotency_key: str  # UUID
    expected_version: int  # optimistic locking

# POST /api/v1/workouts/history/{workout_id}/complete
class WorkoutCompleteRequest(BaseModel):
    duration: int
    comments?: str
    tags?: List[str]
    glucose_data?: List[GlucoseReading]
    idempotency_key: str
    expected_version: int
```

**Service layer (pseudo-code):**

```python
class IdempotencyRecord(Base):
    __tablename__ = 'idempotency_records'
    
    id: int
    user_id: int
    operation_type: str  # SESSION_UPDATE, SESSION_COMPLETE
    idempotency_key: str  # UUID
    resource_id: int  # workout_id
    request_hash: str  # to detect request body changes
    response: JSON  # cached response
    created_at: datetime
    
    __table_args__ = (
        UniqueConstraint('user_id', 'operation_type', 'idempotency_key'),
        Index('idx_lookup'),
    )

async def patch_workout(
    workout_id: int,
    idempotency_key: str,
    expected_version: int,
    payload: WorkoutSessionUpdateRequest,
) -> WorkoutHistoryItem:
    # Check idempotency cache
    cached = await idempotency_repo.get(
        user_id=current_user.id,
        operation_type='SESSION_UPDATE',
        idempotency_key=idempotency_key,
    )
    if cached:
        return cached.response  # replay
    
    # Optimistic locking check
    workout = await workouts_repo.get(workout_id, current_user.id)
    if workout.version != expected_version:
        raise ConflictError(
            f'Version mismatch: expected {expected_version}, got {workout.version}',
            current_version=workout.version,
        )
    
    # Apply update
    workout.exercises = payload.exercises
    workout.comments = payload.comments
    workout.version += 1
    
    # Store idempotency record
    idempotency_repo.create(
        user_id=current_user.id,
        operation_type='SESSION_UPDATE',
        idempotency_key=idempotency_key,
        resource_id=workout_id,
        request_hash=hash(payload.json()),
        response=workout.dict(),
    )
    
    return workout
```

---

## 4. Sync Scenarios

### Scenario 1: Normal Online Workflow ✅

```
User editing exercise
         ↓
  [local] update store
         ↓
  [local] save to localStorage
         ↓
  [debounce 2000ms]
         ↓
  [online check] → YES
         ↓
  [send PATCH + idempotency_key + expected_version]
         ↓
  [backend] idempotency check → new request
         ↓
  [backend] version check → OK
         ↓
  update DB, version++
         ↓
  [client] updateStorage(v+1)
         ↓
  syncState: 'synced' ✅
```

### Scenario 2: Network Interruption -> Recovery 🌐

```
[ONLINE → edit → OFFLINE] during debounce

  User editing
         ↓
  [local] update store
         ↓
  [debounce 2000ms] fires
         ↓
  [online check] → NO
         ↓
  syncState: 'offline-queued'
  toast: "Офлайн: изменения ждут синхронизации"
         ↓
[NETWORK RECOVERS]
         ↓
  [online event] detected
         ↓
  retry flush()
         ↓
  [send PATCH + idempotency_key + expected_version]
         ↓
  [backend] idempotency check → replay (if exact same)
         ↓
  [client] clear queue item
         ↓
  syncState: 'synced' ✅
  toast: "Синхронизация восстановлена"
```

### Scenario 3: Browser Refresh ↻

```
[ACTIVE WORKOUT] → User presses F5 or Telegram closes

  [before unload] trigger flushNow()
  └─ await all sync promises
         ↓
  [browser close]
         ↓
  [localStorage persists]:
    - activeWorkoutSessionDraft_{userId}
    - fittracker_sync_queue_v1
         ↓
[USER REOPENS]
         ↓
  ActiveWorkoutPage mounts
         ↓
  [load from localStorage] if draft exists
         ↓
  hydrate(draft.exercises, draft.elapsedSeconds, ...)
         ↓
  initializeSession(sessionId, startedAt, exercises)
         ↓
  [if sync queue not empty]
    loop flush()
         ↓
  User continues ✅
```

### Scenario 4: Optimistic Conflict 🔀

```
[CONCURRENT EDITS] device A & B editing same workout

Device A:
  PATCH /workouts/{id}
  + expected_version: 5
  + idempotency_key: UUID_A
         ↓
  [Backend] version check → 5 == 5 ✅
  apply, version = 6

Device B: (offline, in queue)
  PATCH /workouts/{id}
  + expected_version: 5 (saved when went offline)
  + idempotency_key: UUID_B
         ↓
  [when online] retry
         ↓
  [Backend] version check → 5 != 6 ✗
         ↓
  409 ConflictError + currentVersion: 6
         ↓
  [Client] syncState: 'conflict'
  toast: "Конфликт данных. Пожалуйста, перезагрузите"
  [store new version locally for manual merge]
```

### Scenario 5: Complete Workout Offline 🏁

```
User finishes exercises
         ↓
  'Завершить' button → flushNow() → handleCompleteSession()
         ↓
  [compose WorkoutCompleteRequest]
         ↓
  completeMutation.mutate({ workoutId, payload })
         ↓
  [if ONLINE] → direct POST
         ↓
  [if OFFLINE] → enqueueOfflineSessionComplete()
  ├─ save to syncQueue
  ├─ save completion state to draft
  ├─ show toast: "Тренировка завершена (синхронизируется)"
  └─ throw OfflineMutationQueuedError
         ↓
  [when online] flush retry
         ↓
  clear draft + remove from queue ✅
```

---

## 5. Data Corruption Prevention

### 5.1 Deduplication & Idempotency

```typescript
// Frontend: Generate stable UUID for each operation
const idempotencyKey = `session:update:${workoutId}:${crypto.randomUUID()}`

// Backend: Idempotency table lookup
if (idempotency_record.exists(idempotency_key)):
    return cached_response  // replayed
else:
    execute_mutation()
    store_idempotency_record(idempotency_key, response)
```

### 5.2 Version-Based Conflict Detection

```typescript
// Frontend: Track expected_version in draft
draft.lastSyncedVersion = 5

// Attempt to update
payload.expected_version = 5

// Backend rejects if version mismatch
if workout.version != 5:
    raise ConflictError(current_version=6)

// Client handles: syncState = 'conflict'
```

### 5.3 Exercise Order Integrity

```typescript
// Never allow exercises to be reordered mid-sync
if not is_synced:
    disable_reorder = true
    show_warning: "Завершите синхронизацию перед изменением"
```

---

## 6. Retry Logic & Backoff

### Exponential Backoff with Jitter

```typescript
// Existing in syncQueue/engine.ts
function backoffMsAfterFailure(attempts: number): number {
    const capped = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6))
    const jitter = Math.floor(Math.random() * 400)
    return capped + jitter
}

// Attempt schedule:
// 1st: ~1000ms
// 2nd: ~2400ms
// 3rd: ~4800ms
// 4th: ~9600ms
// 5th: ~19200ms
// 6th: ~38400ms
// 7th: capped at ~60000ms
```

### Recoverable vs Non-Recoverable Errors

```typescript
const isRecoverableSyncError = (error: unknown): boolean => {
    // Recoverable: network, timeout, 5xx
    if (error.code === 'NETWORK_ERROR') return true
    if (error.code === 'TIMEOUT') return true
    if (error.status >= 500) return true
    
    // Non-recoverable: validation, auth, 4xx
    if (error.status === 400) return false  // bad payload
    if (error.status === 401) return false  // reauth needed
    if (error.status === 409) return false  // conflict
    
    return false
}
```

---

## 7. Testing Scenarios

### Manual Testing Checklist

- [ ] **Refresh during active workout**
  1. Start workout, edit 2 exercises
  2. Press F5
  3. Verify: exercises restored, elapsed time continues
  4. Verify: localStorage has full state

- [ ] **Offline editing with recovery**
  1. Start workout, open DevTools → offline
  2. Edit 3 sets, advance exercise
  3. Verify: syncState = 'offline-queued'
  4. Go online, verify auto-sync
  5. Verify: syncState = 'synced'

- [ ] **Telegram reopen mid-workout**
  1. Start workout in Telegram Mini App
  2. Close app (don't finish)
  3. Reopen app
  4. Navigate to /workouts/active/:id
  5. Verify: state fully restored

- [ ] **Finish offline**
  1. Start workout, complete exercises
  2. Go offline
  3. Click "Завершить"
  4. Go online
  5. Verify: workout completed on backend

- [ ] **Version conflict detection**
  1. Start workout on device A, go offline
  2. Edit same workout on device B, sync to server
  3. Device A goes online
  4. Verify: conflict detected, UI shows error
  5. Verify: data not corrupted

---

## 8. Monitoring & Observability

### Events to Track

```typescript
trackBusinessMetric('workout_sync_state_changed', {
    workout_id: number,
    previous_state: string,
    next_state: string,
    reason: 'user_edit' | 'network_change' | 'recovery',
    timestamp: number,
})

trackBusinessMetric('workout_sync_failed', {
    workout_id: number,
    error_code: string,
    is_recoverable: boolean,
    attempt_number: number,
})

trackBusinessMetric('workout_recovery_succeeded', {
    workout_id: number,
    items_synced: number,
    total_time_ms: number,
})
```

---

## 9. Rollout Plan

### Phase 1: Development & Testing (Week 1)
- [ ] Implement draft persistence
- [ ] Update sync queue
- [ ] Backend idempotency
- [ ] Manual test scenarios

### Phase 2: Staging & QA (Week 2)
- [ ] Deploy to staging
- [ ] Extended user testing
- [ ] Monitor error rates
- [ ] Performance validation

### Phase 3: Production (Week 3)
- [ ] Feature flag: `enable_offline_session_persistence`
- [ ] Canary rollout: 10% → 50% → 100%
- [ ] Monitor Sentry/logs
- [ ] Performance metrics

---

## 10. Success Criteria

✅ **Workout data is never lost:**
- Refresh → data restored
- Offline → queued + synced on recovery
- Completion → persisted locally first

✅ **User experience:**
- Clear sync status at all times
- No confusing delays or silent failures
- Helpful toasts on state changes

✅ **Data integrity:**
- Zero duplicates on retry
- Version conflicts detected
- Exercise order preserved

---

**Next Step:** Review plan, then implement Phase 1 changes.
