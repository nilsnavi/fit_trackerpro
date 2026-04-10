# Backend Implementation: Idempotency & Versioning

**Date:** April 7, 2026  
**Status:** 🚀 Ready for Implementation  
**Language:** Python (FastAPI)

---

## Overview

Implement **idempotent endpoints** and **optimistic locking** for safe offline sync:

1. **Idempotency Records** — Store request/response pairs by UUID
2. **Version Field** — Track WorkoutLog version for conflict detection
3. **Enhanced Schemas** — Add `idempotency_key` and `expected_version` to requests
4. **Error Handling** — Return 409 ConflictError with current version on mismatch

---

## Database Changes

### Migration: Add Idempotency Table

**File:** `database/migrations/versions/{timestamp}_add_idempotency_records.py`

```python
def upgrade():
    op.create_table(
        'idempotency_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('operation_type', sa.String(50), nullable=False),
        sa.Column('idempotency_key', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('resource_id', sa.Integer(), nullable=False),
        sa.Column('request_hash', sa.String(64), nullable=False),
        sa.Column('response_payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint(
            'user_id', 'operation_type', 'idempotency_key',
            name='uq_idempotency_lookup'
        ),
    )
    op.create_index(
        'idx_idempotency_expires',
        'idempotency_records',
        ['expires_at'],
    )


def downgrade():
    op.drop_table('idempotency_records')
```

### Migration: Add Version to WorkoutLog

**File:** `database/migrations/versions/{timestamp}_add_version_to_workout_log.py`

```python
def upgrade():
    # Add version column to track optimistic locking
    op.add_column(
        'workout_logs',
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    )
    # Add check constraint to ensure version >= 1
    op.create_check_constraint(
        'ck_workout_version_positive',
        'workout_logs',
        'version >= 1',
    )
    # Index for conflict detection
    op.create_index(
        'idx_workout_version',
        'workout_logs',
        ['user_id', 'id', 'version'],
    )


def downgrade():
    op.drop_constraint('ck_workout_version_positive', 'workout_logs', type_='check')
    op.drop_index('idx_workout_version', 'workout_logs')
    op.drop_column('workout_logs', 'version')
```

---

## API Changes

### 1. Schema Updates

**File:** `backend/app/schemas/workouts.py`

```python
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional

class WorkoutSessionUpdateRequest(BaseModel):
    """PATCH /api/v1/workouts/history/{workout_id}"""
    exercises: Optional[List[ExerciseUpdate]] = None
    comments: Optional[str] = None
    tags: Optional[List[str]] = None
    
    # NEW: Idempotency & concurrency control
    idempotency_key: UUID = Field(
        description="Unique identifier for this request (for replay protection)"
    )
    expected_version: int = Field(
        description="Expected version of the workout on server (optimistic locking)"
    )


class WorkoutCompleteRequest(BaseModel):
    """POST /api/v1/workouts/history/{workout_id}/complete"""
    duration: int
    comments: Optional[str] = None
    tags: Optional[List[str]] = None
    glucose_data: Optional[List[GlucoseReading]] = None
    
    # NEW: Idempotency & concurrency control
    idempotency_key: UUID = Field(
        description="Unique identifier for this request"
    )
    expected_version: int = Field(
        description="Expected version of the workout"
    )


class WorkoutHistoryItemResponse(BaseModel):
    """Response includes version for next request"""
    id: int
    # ... existing fields ...
    version: int  # NEW: increment on each update
```

### 2. Exception/Error Models

**File:** `backend/app/domain/exceptions.py` (add)

```python
class WorkoutConflictError(AppException):
    """Raised when workout version doesn't match (409 Conflict)."""
    
    status_code = 409
    error_code = "WORKOUT_VERSION_CONFLICT"
    
    def __init__(self, expected: int, current: int, workout_id: int):
        super().__init__(
            detail=f"Workout version mismatch: expected {expected}, current {current}",
            error_code=self.error_code,
            status_code=self.status_code,
        )
        self.current_version = current
        self.expected_version = expected
        self.workout_id = workout_id
```

### 3. Service Layer

**File:** `backend/app/application/workouts_service.py` (update)

```python
class IdempotencyRecord(Base):
    """Store request/response pairs for idempotent replay."""
    __tablename__ = 'idempotency_records'
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    operation_type: Mapped[str]  # e.g., 'SESSION_UPDATE', 'SESSION_COMPLETE'
    idempotency_key: Mapped[UUID]
    resource_id: Mapped[int]  # workout_id
    request_hash: Mapped[str]  # SHA256 of request payload
    response_payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    expires_at: Mapped[Optional[datetime]]  # TTL for cleanup
    
    __table_args__ = (
        UniqueConstraint(
            'user_id', 'operation_type', 'idempotency_key',
            name='uq_idempotency_lookup'
        ),
        Index('idx_idempotency_expires', expires_at),
    )


async def update_workout_session(
    self,
    workout_id: int,
    user_id: int,
    payload: WorkoutSessionUpdateRequest,
) -> WorkoutHistoryItem:
    """Update session with idempotency and optimistic locking."""
    
    # 1. Check idempotency cache (replay protection)
    request_hash = hashlib.sha256(
        payload.model_dump_json().encode()
    ).hexdigest()
    
    cached = await self.idempotency_repo.get_record(
        user_id=user_id,
        operation_type='SESSION_UPDATE',
        idempotency_key=payload.idempotency_key,
    )
    
    if cached:
        # Same request → return cached response (idempotent)
        if cached.request_hash == request_hash:
            return cached.response_payload
        # Different payload with same key → error
        else:
            raise ValueError("Idempotency key reused with different payload")
    
    # 2. Load workout and check version
    workout = await self.workouts_repo.get(workout_id, user_id)
    if not workout:
        raise WorkoutNotFoundError(workout_id)
    
    if workout.version != payload.expected_version:
        # Version mismatch → conflict
        raise WorkoutConflictError(
            expected=payload.expected_version,
            current=workout.version,
            workout_id=workout_id,
        )
    
    # 3. Apply changes
    if payload.exercises:
        workout.exercises = payload.exercises
    if payload.comments is not None:
        workout.comments = payload.comments
    if payload.tags is not None:
        workout.tags = payload.tags
    
    # 4. Increment version (atomic on server)
    workout.version += 1
    workout.updated_at = datetime.utcnow()
    
    # 5. Persist
    db.session.add(workout)
    db.session.flush()
    
    # 6. Store idempotency record for future replays
    response = workout.to_dict()
    await self.idempotency_repo.create_record(
        user_id=user_id,
        operation_type='SESSION_UPDATE',
        idempotency_key=payload.idempotency_key,
        resource_id=workout_id,
        request_hash=request_hash,
        response_payload=response,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    
    db.session.commit()
    return response
```

### 4. API Endpoints

**File:** `backend/app/api/v1/workouts.py` (update)

```python
from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.domain.exceptions import WorkoutConflictError

router = APIRouter()

@router.patch("/history/{workout_id}")
async def patch_workout_session(
    workout_id: int,
    payload: WorkoutSessionUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: WorkoutsService = Depends(get_workouts_service),
) -> WorkoutHistoryItemResponse:
    """
    Update active session with idempotency & versioning.
    
    Returns 409 Conflict if expected_version doesn't match server.
    Returns cached response if idempotency_key seen before.
    """
    try:
        result = await service.update_workout_session(
            workout_id=workout_id,
            user_id=current_user.id,
            payload=payload,
        )
        return WorkoutHistoryItemResponse.from_orm(result)
    except WorkoutConflictError as e:
        raise HTTPException(
            status_code=409,
            detail={
                'error': 'version_conflict',
                'message': e.detail,
                'current_version': e.current_version,
                'expected_version': e.expected_version,
            },
        )
```

---

## Usage Example

### Client Sends Request

```typescript
// Frontend (ActiveWorkoutPage)

const payload: WorkoutSessionUpdateRequest = {
  exercises: [...], 
  comments: 'Strength day',
  tags: ['strength'],
  idempotency_key: 'ba2a5eb0-d9cd-4e6d-8ca0-1d2e5e7e2a1f',
  expected_version: 3,  // Last synced version
}

// If network fails, retry with same idempotency_key
```

---

## Deployment Checklist

- [ ] Create migration: `add_idempotency_records`
- [ ] Create migration: `add_version_to_workout_log`
- [ ] Update schemas: add `idempotency_key`, `expected_version`
- [ ] Update service: implement idempotency + versioning logic
- [ ] Update API endpoints: add error handling for 409 Conflict
- [ ] Create cleanup job: expire stale records
- [ ] Test: idempotent replay, version conflicts, race conditions
- [ ] Monitor: Track conflict errors in Sentry
- [ ] Gradual rollout: 10% → 50% → 100%

---

**Next:** Frontend will send `idempotency_key` and `expected_version` in requests.  
Backend returns 409 Conflict with `current_version` for client-side merge.

