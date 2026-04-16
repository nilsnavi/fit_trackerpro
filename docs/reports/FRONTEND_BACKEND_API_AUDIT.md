# Frontend-Backend API Audit Report

**Date:** 2026-04-15
**Status:** CRITICAL ISSUES FOUND

---

## Summary

| Category | Status | Issues |
|----------|--------|--------|
| Auth API | OK | 0 |
| Users API | OK | 0 |
| Workouts API | OK | 0 |
| Exercises API | OK | 0 |
| Analytics API | OK | 0 |
| Health Metrics (Glucose/Wellness) | OK | 0 |
| Health Metrics (Water) | CRITICAL | 5 missing endpoints |

---

## Critical Issues

### 1. Water Tracking API - MISSING ON BACKEND

**Frontend calls (healthApi.ts):**
```typescript
getWaterGoal(): Promise<WaterGoal>         // GET /health-metrics/water/goal
getWaterReminder(): Promise<WaterReminder> // GET /health-metrics/water/reminder
getWaterToday(): Promise<WaterEntry[]>     // GET /health-metrics/water/today
getWaterWeeklyStats(period): Promise<...>  // GET /health-metrics/water/stats
addWaterEntry(payload): Promise<WaterEntry> // POST /health-metrics/water
updateWaterGoal(payload): Promise<WaterGoal> // PUT /health-metrics/water/goal
updateWaterReminder(payload): Promise<...>   // PUT /health-metrics/water/reminder
```

**Backend status:**
- File: `backend/app/api/v1/health_metrics.py`
- Water endpoints: NOT IMPLEMENTED
- Water model: NOT FOUND in database models

**Impact:**
- Water tracking feature completely broken
- All water-related UI components will fail with 404

---

## Verified Working Endpoints

### Auth API (`/users/auth`)
| Frontend Endpoint | Backend Route | Status |
|------------------|---------------|--------|
| POST /users/auth/telegram | OK | Validated |
| POST /users/auth/lookup | OK | Validated |
| POST /users/auth/register | OK | Validated |
| POST /users/auth/refresh | OK | Validated |
| GET /users/auth/me | OK | Validated |
| PUT /users/auth/me | OK | Validated |
| POST /users/auth/logout | OK | Validated |
| POST /users/auth/onboarding | OK | Validated |

### Users API (`/users`)
| Frontend Endpoint | Backend Route | Status |
|------------------|---------------|--------|
| GET /users/stats | OK | Validated |
| GET /users/coach-access | OK | Validated |
| POST /users/coach-access/generate | OK | Validated |
| DELETE /users/coach-access/{id} | OK | Validated |
| GET /users/export | OK | Validated |

### Workouts API (`/workouts`)
| Frontend Endpoint | Backend Route | Status |
|------------------|---------------|--------|
| GET /workouts/templates | OK | Validated |
| POST /workouts/templates | OK | Validated |
| GET /workouts/templates/{id} | OK | Validated |
| PUT /workouts/templates/{id} | OK | Validated |
| PATCH /workouts/templates/{id} | OK | Validated |
| POST /workouts/templates/{id}/clone | OK | Validated |
| DELETE /workouts/templates/{id} | OK | Validated |
| POST /workouts/templates/{id}/archive | OK | Validated |
| POST /workouts/templates/{id}/unarchive | OK | Validated |
| POST /workouts/templates/from-workout | OK | Validated |
| GET /workouts/history | OK | Validated |
| GET /workouts/history/{id} | OK | Validated |
| PATCH /workouts/history/{id} | OK | Validated |
| POST /workouts/start | OK | Validated |
| POST /workouts/start/from-template/{id} | OK | Validated |
| POST /workouts/complete | OK | Validated |
| GET /workouts/calendar | OK | Validated |

### Exercises API (`/exercises`)
| Frontend Endpoint | Backend Route | Status |
|------------------|---------------|--------|
| GET /exercises | OK | Validated |
| GET /exercises/{id} | OK | Validated |
| POST /exercises | OK | Validated |
| POST /exercises/custom | OK | Validated |
| PUT /exercises/{id} | OK | Validated |
| DELETE /exercises/{id} | OK | Validated |
| GET /exercises/categories/list | OK | Validated |
| GET /exercises/equipment/list | OK | Validated |
| GET /exercises/muscle-groups/list | OK | Validated |
| GET /exercises/by-slugs | OK | Validated |

### Analytics API (`/analytics`)
| Frontend Endpoint | Backend Route | Status |
|------------------|---------------|--------|
| GET /analytics/ | OK | Validated |
| GET /analytics/workouts | OK | Validated |
| GET /analytics/summary | OK | Validated |
| GET /analytics/performance-overview | OK | Validated |
| GET /analytics/progress | OK | Validated |
| GET /analytics/training-load/daily | OK | Validated |
| GET /analytics/calendar | OK | Validated |
| GET /analytics/muscle-load | OK | Validated |
| GET /analytics/recovery-state | OK | Validated |
| GET /analytics/progress-insights | OK | Validated |
| GET /analytics/workout-summary | OK | Validated |

### Health Metrics API (`/health-metrics`)
| Frontend Endpoint | Backend Route | Status |
|------------------|---------------|--------|
| POST /health-metrics/glucose | OK | Validated |
| GET /health-metrics/glucose | OK | Validated |
| GET /health-metrics/glucose/{id} | OK | Validated |
| DELETE /health-metrics/glucose/{id} | OK | Validated |
| GET /health-metrics/glucose/stats | OK | Validated |
| POST /health-metrics/wellness | OK | Validated |
| GET /health-metrics/wellness | OK | Validated |
| GET /health-metrics/wellness/{id} | OK | Validated |
| GET /health-metrics/wellness/stats | OK | Validated |
| GET /health-metrics/stats | OK | Validated |
| GET /health-metrics/water/goal | MISSING | 404 |
| GET /health-metrics/water/reminder | MISSING | 404 |
| GET /health-metrics/water/today | MISSING | 404 |
| GET /health-metrics/water/stats | MISSING | 404 |
| POST /health-metrics/water | MISSING | 404 |
| PUT /health-metrics/water/goal | MISSING | 404 |
| PUT /health-metrics/water/reminder | MISSING | 404 |

---

## Recommendations

### Priority 1 - Critical (Water API)

1. **Add Water tracking to backend**
   - Create `WaterEntry` model in database
   - Create `WaterGoal` model
   - Create `WaterReminder` model
   - Add all water endpoints to `health_metrics.py`

### Priority 2 - Type Safety

1. **Update OpenAPI types**
   - Run OpenAPI generator after adding water endpoints
   - Ensure frontend types match backend schemas

---

## Files Checked

**Frontend:**
- `frontend/src/shared/api/client.ts`
- `frontend/src/shared/api/domains/workoutsApi.ts`
- `frontend/src/shared/api/domains/healthApi.ts`
- `frontend/src/shared/api/domains/exercisesApi.ts`
- `frontend/src/shared/api/domains/analyticsApi.ts`
- `frontend/src/shared/api/domains/usersApi.ts`
- `frontend/src/shared/config/runtime.ts`

**Backend:**
- `backend/app/api/v1/registration.py`
- `backend/app/api/v1/auth.py`
- `backend/app/api/v1/users.py`
- `backend/app/api/v1/workouts.py`
- `backend/app/api/v1/exercises.py`
- `backend/app/api/v1/health_metrics.py`
- `backend/app/api/v1/analytics.py`
