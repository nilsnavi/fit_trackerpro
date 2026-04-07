"""Compatibility alias for session naming in domain model.

Workout sessions are currently stored in workout_logs table.
"""

from app.domain.workout_log import WorkoutLog

WorkoutSession = WorkoutLog
