-- Zero-downtime EXPAND migration
-- Step 1: add snake_case shadow columns, backfill, and create dual-write sync triggers.
-- Prerequisite: legacy schema still has camelCase physical columns.
BEGIN;

-- 1) Add missing snake_case columns using legacy camelCase types
DO $$
DECLARE
  r RECORD;
  col_type text;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('public', 'achievement_definitions', 'createdAt', 'created_at'),
      ('public', 'achievement_definitions', 'isActive', 'is_active'),
      ('public', 'achievement_definitions', 'isRepeatable', 'is_repeatable'),
      ('public', 'achievement_definitions', 'updatedAt', 'updated_at'),
      ('public', 'adaptive_recommendations', 'appliedAt', 'applied_at'),
      ('public', 'adaptive_recommendations', 'createdAt', 'created_at'),
      ('public', 'adaptive_recommendations', 'currentValue', 'current_value'),
      ('public', 'adaptive_recommendations', 'exerciseId', 'exercise_id'),
      ('public', 'adaptive_recommendations', 'inputSnapshot', 'input_snapshot'),
      ('public', 'adaptive_recommendations', 'modelVersion', 'model_version'),
      ('public', 'adaptive_recommendations', 'reasonCode', 'reason_code'),
      ('public', 'adaptive_recommendations', 'recommendationType', 'recommendation_type'),
      ('public', 'adaptive_recommendations', 'sessionExerciseId', 'session_exercise_id'),
      ('public', 'adaptive_recommendations', 'suggestedValue', 'suggested_value'),
      ('public', 'adaptive_recommendations', 'updatedAt', 'updated_at'),
      ('public', 'adaptive_recommendations', 'userId', 'user_id'),
      ('public', 'adaptive_recommendations', 'validUntil', 'valid_until'),
      ('public', 'ai_coach_messages', 'completionTokens', 'completion_tokens'),
      ('public', 'ai_coach_messages', 'conversationKey', 'conversation_key'),
      ('public', 'ai_coach_messages', 'createdAt', 'created_at'),
      ('public', 'ai_coach_messages', 'insightId', 'insight_id'),
      ('public', 'ai_coach_messages', 'modelName', 'model_name'),
      ('public', 'ai_coach_messages', 'promptTokens', 'prompt_tokens'),
      ('public', 'ai_coach_messages', 'sessionId', 'session_id'),
      ('public', 'ai_coach_messages', 'updatedAt', 'updated_at'),
      ('public', 'ai_coach_messages', 'userId', 'user_id'),
      ('public', 'ai_insights', 'createdAt', 'created_at'),
      ('public', 'ai_insights', 'insightType', 'insight_type'),
      ('public', 'ai_insights', 'modelVersion', 'model_version'),
      ('public', 'ai_insights', 'sessionId', 'session_id'),
      ('public', 'ai_insights', 'tokensUsed', 'tokens_used'),
      ('public', 'ai_insights', 'updatedAt', 'updated_at'),
      ('public', 'ai_insights', 'userId', 'user_id'),
      ('public', 'challenge_participants', 'challengeId', 'challenge_id'),
      ('public', 'challenge_participants', 'completedAt', 'completed_at'),
      ('public', 'challenge_participants', 'createdAt', 'created_at'),
      ('public', 'challenge_participants', 'joinedAt', 'joined_at'),
      ('public', 'challenge_participants', 'progressValue', 'progress_value'),
      ('public', 'challenge_participants', 'updatedAt', 'updated_at'),
      ('public', 'challenge_participants', 'userId', 'user_id'),
      ('public', 'challenges', 'challengeType', 'challenge_type'),
      ('public', 'challenges', 'createdAt', 'created_at'),
      ('public', 'challenges', 'creatorId', 'creator_id'),
      ('public', 'challenges', 'endDate', 'end_date'),
      ('public', 'challenges', 'isPublic', 'is_public'),
      ('public', 'challenges', 'startDate', 'start_date'),
      ('public', 'challenges', 'targetValue', 'target_value'),
      ('public', 'challenges', 'updatedAt', 'updated_at'),
      ('public', 'exercise_aliases', 'createdAt', 'created_at'),
      ('public', 'exercise_aliases', 'exerciseId', 'exercise_id'),
      ('public', 'exercise_aliases', 'normalizedAlias', 'normalized_alias'),
      ('public', 'exercise_aliases', 'updatedAt', 'updated_at'),
      ('public', 'exercise_personal_records', 'achievedAt', 'achieved_at'),
      ('public', 'exercise_personal_records', 'createdAt', 'created_at'),
      ('public', 'exercise_personal_records', 'exerciseId', 'exercise_id'),
      ('public', 'exercise_personal_records', 'sourceSessionId', 'source_session_id'),
      ('public', 'exercise_personal_records', 'sourceWorkoutSetId', 'source_workout_set_id'),
      ('public', 'exercise_personal_records', 'updatedAt', 'updated_at'),
      ('public', 'exercise_personal_records', 'userId', 'user_id'),
      ('public', 'exercises', 'createdAt', 'created_at'),
      ('public', 'exercises', 'isArchived', 'is_archived'),
      ('public', 'exercises', 'isPublic', 'is_public'),
      ('public', 'exercises', 'isUnilateral', 'is_unilateral'),
      ('public', 'exercises', 'ownerId', 'owner_id'),
      ('public', 'exercises', 'primaryMuscle', 'primary_muscle'),
      ('public', 'exercises', 'secondaryMuscles', 'secondary_muscles'),
      ('public', 'exercises', 'updatedAt', 'updated_at'),
      ('public', 'friendships', 'addresseeId', 'addressee_id'),
      ('public', 'friendships', 'createdAt', 'created_at'),
      ('public', 'friendships', 'requestedAt', 'requested_at'),
      ('public', 'friendships', 'requesterId', 'requester_id'),
      ('public', 'friendships', 'respondedAt', 'responded_at'),
      ('public', 'friendships', 'updatedAt', 'updated_at'),
      ('public', 'rest_timer_events', 'actualRestSec', 'actual_rest_sec'),
      ('public', 'rest_timer_events', 'createdAt', 'created_at'),
      ('public', 'rest_timer_events', 'eventType', 'event_type'),
      ('public', 'rest_timer_events', 'plannedRestSec', 'planned_rest_sec'),
      ('public', 'rest_timer_events', 'sessionExerciseId', 'session_exercise_id'),
      ('public', 'rest_timer_events', 'sessionId', 'session_id'),
      ('public', 'rest_timer_events', 'triggeredAt', 'triggered_at'),
      ('public', 'rest_timer_events', 'updatedAt', 'updated_at'),
      ('public', 'rest_timer_events', 'workoutSetId', 'workout_set_id'),
      ('public', 'social_reactions', 'createdAt', 'created_at'),
      ('public', 'social_reactions', 'postId', 'post_id'),
      ('public', 'social_reactions', 'reactionType', 'reaction_type'),
      ('public', 'social_reactions', 'updatedAt', 'updated_at'),
      ('public', 'social_reactions', 'userId', 'user_id'),
      ('public', 'social_workout_posts', 'createdAt', 'created_at'),
      ('public', 'social_workout_posts', 'isDeleted', 'is_deleted'),
      ('public', 'social_workout_posts', 'sessionId', 'session_id'),
      ('public', 'social_workout_posts', 'updatedAt', 'updated_at'),
      ('public', 'social_workout_posts', 'userId', 'user_id'),
      ('public', 'sync_events', 'clientEventId', 'client_event_id'),
      ('public', 'sync_events', 'conflictData', 'conflict_data'),
      ('public', 'sync_events', 'createdAt', 'created_at'),
      ('public', 'sync_events', 'deviceId', 'device_id'),
      ('public', 'sync_events', 'entityId', 'entity_id'),
      ('public', 'sync_events', 'entityType', 'entity_type'),
      ('public', 'sync_events', 'eventStatus', 'event_status'),
      ('public', 'sync_events', 'occurredAt', 'occurred_at'),
      ('public', 'sync_events', 'processedAt', 'processed_at'),
      ('public', 'sync_events', 'updatedAt', 'updated_at'),
      ('public', 'sync_events', 'userId', 'user_id'),
      ('public', 'training_program_weeks', 'createdAt', 'created_at'),
      ('public', 'training_program_weeks', 'programId', 'program_id'),
      ('public', 'training_program_weeks', 'updatedAt', 'updated_at'),
      ('public', 'training_program_weeks', 'weekNumber', 'week_number'),
      ('public', 'training_program_workouts', 'createdAt', 'created_at'),
      ('public', 'training_program_workouts', 'dayOfWeek', 'day_of_week'),
      ('public', 'training_program_workouts', 'orderIndex', 'order_index'),
      ('public', 'training_program_workouts', 'templateId', 'template_id'),
      ('public', 'training_program_workouts', 'updatedAt', 'updated_at'),
      ('public', 'training_program_workouts', 'weekId', 'week_id'),
      ('public', 'training_programs', 'authorId', 'author_id'),
      ('public', 'training_programs', 'createdAt', 'created_at'),
      ('public', 'training_programs', 'currencyCode', 'currency_code'),
      ('public', 'training_programs', 'isArchived', 'is_archived'),
      ('public', 'training_programs', 'isMarketplaceListed', 'is_marketplace_listed'),
      ('public', 'training_programs', 'isPublic', 'is_public'),
      ('public', 'training_programs', 'priceCents', 'price_cents'),
      ('public', 'training_programs', 'updatedAt', 'updated_at'),
      ('public', 'user_achievements', 'achievementDefinitionId', 'achievement_definition_id'),
      ('public', 'user_achievements', 'awardedAt', 'awarded_at'),
      ('public', 'user_achievements', 'createdAt', 'created_at'),
      ('public', 'user_achievements', 'updatedAt', 'updated_at'),
      ('public', 'user_achievements', 'userId', 'user_id'),
      ('public', 'user_profiles', 'birthDate', 'birth_date'),
      ('public', 'user_profiles', 'bodyFatPercent', 'body_fat_percent'),
      ('public', 'user_profiles', 'createdAt', 'created_at'),
      ('public', 'user_profiles', 'displayName', 'display_name'),
      ('public', 'user_profiles', 'firstName', 'first_name'),
      ('public', 'user_profiles', 'heightCm', 'height_cm'),
      ('public', 'user_profiles', 'lastName', 'last_name'),
      ('public', 'user_profiles', 'updatedAt', 'updated_at'),
      ('public', 'user_profiles', 'userId', 'user_id'),
      ('public', 'user_profiles', 'weightKg', 'weight_kg'),
      ('public', 'user_streaks', 'createdAt', 'created_at'),
      ('public', 'user_streaks', 'currentCount', 'current_count'),
      ('public', 'user_streaks', 'isActive', 'is_active'),
      ('public', 'user_streaks', 'lastEventDate', 'last_event_date'),
      ('public', 'user_streaks', 'longestCount', 'longest_count'),
      ('public', 'user_streaks', 'streakStartDate', 'streak_start_date'),
      ('public', 'user_streaks', 'streakType', 'streak_type'),
      ('public', 'user_streaks', 'updatedAt', 'updated_at'),
      ('public', 'user_streaks', 'userId', 'user_id'),
      ('public', 'users', 'createdAt', 'created_at'),
      ('public', 'users', 'deletedAt', 'deleted_at'),
      ('public', 'users', 'isOnboarded', 'is_onboarded'),
      ('public', 'users', 'telegramUserId', 'telegram_user_id'),
      ('public', 'users', 'telegramUsername', 'telegram_username'),
      ('public', 'users', 'updatedAt', 'updated_at'),
      ('public', 'workout_session_exercises', 'avgRpe', 'avg_rpe'),
      ('public', 'workout_session_exercises', 'bestEstimated1Rm', 'best_estimated1_rm'),
      ('public', 'workout_session_exercises', 'blockKey', 'block_key'),
      ('public', 'workout_session_exercises', 'blockType', 'block_type'),
      ('public', 'workout_session_exercises', 'createdAt', 'created_at'),
      ('public', 'workout_session_exercises', 'exerciseId', 'exercise_id'),
      ('public', 'workout_session_exercises', 'orderIndex', 'order_index'),
      ('public', 'workout_session_exercises', 'performedSets', 'performed_sets'),
      ('public', 'workout_session_exercises', 'sessionId', 'session_id'),
      ('public', 'workout_session_exercises', 'templateItemId', 'template_item_id'),
      ('public', 'workout_session_exercises', 'updatedAt', 'updated_at'),
      ('public', 'workout_session_exercises', 'volumeKg', 'volume_kg'),
      ('public', 'workout_sessions', 'createdAt', 'created_at'),
      ('public', 'workout_sessions', 'deletedAt', 'deleted_at'),
      ('public', 'workout_sessions', 'durationSeconds', 'duration_seconds'),
      ('public', 'workout_sessions', 'endedAt', 'ended_at'),
      ('public', 'workout_sessions', 'peakEstimated1RmKg', 'peak_estimated1_rm_kg'),
      ('public', 'workout_sessions', 'sessionFatigueScore', 'session_fatigue_score'),
      ('public', 'workout_sessions', 'sourceDeviceId', 'source_device_id'),
      ('public', 'workout_sessions', 'startedAt', 'started_at'),
      ('public', 'workout_sessions', 'syncVersion', 'sync_version'),
      ('public', 'workout_sessions', 'templateId', 'template_id'),
      ('public', 'workout_sessions', 'totalReps', 'total_reps'),
      ('public', 'workout_sessions', 'totalSets', 'total_sets'),
      ('public', 'workout_sessions', 'totalVolumeKg', 'total_volume_kg'),
      ('public', 'workout_sessions', 'trainingProgramWorkoutId', 'training_program_workout_id'),
      ('public', 'workout_sessions', 'updatedAt', 'updated_at'),
      ('public', 'workout_sessions', 'userId', 'user_id'),
      ('public', 'workout_sets', 'actualRestSec', 'actual_rest_sec'),
      ('public', 'workout_sets', 'createdAt', 'created_at'),
      ('public', 'workout_sets', 'distanceMeters', 'distance_meters'),
      ('public', 'workout_sets', 'durationSec', 'duration_sec'),
      ('public', 'workout_sets', 'estimated1RmKg', 'estimated1_rm_kg'),
      ('public', 'workout_sets', 'fatigueScore', 'fatigue_score'),
      ('public', 'workout_sets', 'isCompleted', 'is_completed'),
      ('public', 'workout_sets', 'sessionExerciseId', 'session_exercise_id'),
      ('public', 'workout_sets', 'setOrder', 'set_order'),
      ('public', 'workout_sets', 'setType', 'set_type'),
      ('public', 'workout_sets', 'suggestedRestSec', 'suggested_rest_sec'),
      ('public', 'workout_sets', 'updatedAt', 'updated_at'),
      ('public', 'workout_sets', 'weightKg', 'weight_kg'),
      ('public', 'workout_template_items', 'blockKey', 'block_key'),
      ('public', 'workout_template_items', 'blockType', 'block_type'),
      ('public', 'workout_template_items', 'createdAt', 'created_at'),
      ('public', 'workout_template_items', 'exerciseId', 'exercise_id'),
      ('public', 'workout_template_items', 'orderIndex', 'order_index'),
      ('public', 'workout_template_items', 'restSeconds', 'rest_seconds'),
      ('public', 'workout_template_items', 'targetRepsMax', 'target_reps_max'),
      ('public', 'workout_template_items', 'targetRepsMin', 'target_reps_min'),
      ('public', 'workout_template_items', 'targetRpe', 'target_rpe'),
      ('public', 'workout_template_items', 'targetSets', 'target_sets'),
      ('public', 'workout_template_items', 'targetWeightKg', 'target_weight_kg'),
      ('public', 'workout_template_items', 'templateId', 'template_id'),
      ('public', 'workout_template_items', 'updatedAt', 'updated_at'),
      ('public', 'workout_templates', 'createdAt', 'created_at'),
      ('public', 'workout_templates', 'estimatedMinSec', 'estimated_min_sec'),
      ('public', 'workout_templates', 'isArchived', 'is_archived'),
      ('public', 'workout_templates', 'isPublic', 'is_public'),
      ('public', 'workout_templates', 'updatedAt', 'updated_at'),
      ('public', 'workout_templates', 'userId', 'user_id')
    ) AS t(schema_name, table_name, old_col, new_col)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.schema_name AND table_name = r.table_name AND column_name = r.old_col
    )
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.schema_name AND table_name = r.table_name AND column_name = r.new_col
    ) THEN
      SELECT format_type(a.atttypid, a.atttypmod)
      INTO col_type
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = r.schema_name
        AND c.relname = r.table_name
        AND a.attname = r.old_col
        AND a.attnum > 0
        AND NOT a.attisdropped;

      IF col_type IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %I.%I ADD COLUMN %I %s', r.schema_name, r.table_name, r.new_col, col_type);
      END IF;
    END IF;
  END LOOP;
END $$;

-- 2) Backfill snake_case from camelCase where missing
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('public', 'achievement_definitions', 'createdAt', 'created_at'),
      ('public', 'achievement_definitions', 'isActive', 'is_active'),
      ('public', 'achievement_definitions', 'isRepeatable', 'is_repeatable'),
      ('public', 'achievement_definitions', 'updatedAt', 'updated_at'),
      ('public', 'adaptive_recommendations', 'appliedAt', 'applied_at'),
      ('public', 'adaptive_recommendations', 'createdAt', 'created_at'),
      ('public', 'adaptive_recommendations', 'currentValue', 'current_value'),
      ('public', 'adaptive_recommendations', 'exerciseId', 'exercise_id'),
      ('public', 'adaptive_recommendations', 'inputSnapshot', 'input_snapshot'),
      ('public', 'adaptive_recommendations', 'modelVersion', 'model_version'),
      ('public', 'adaptive_recommendations', 'reasonCode', 'reason_code'),
      ('public', 'adaptive_recommendations', 'recommendationType', 'recommendation_type'),
      ('public', 'adaptive_recommendations', 'sessionExerciseId', 'session_exercise_id'),
      ('public', 'adaptive_recommendations', 'suggestedValue', 'suggested_value'),
      ('public', 'adaptive_recommendations', 'updatedAt', 'updated_at'),
      ('public', 'adaptive_recommendations', 'userId', 'user_id'),
      ('public', 'adaptive_recommendations', 'validUntil', 'valid_until'),
      ('public', 'ai_coach_messages', 'completionTokens', 'completion_tokens'),
      ('public', 'ai_coach_messages', 'conversationKey', 'conversation_key'),
      ('public', 'ai_coach_messages', 'createdAt', 'created_at'),
      ('public', 'ai_coach_messages', 'insightId', 'insight_id'),
      ('public', 'ai_coach_messages', 'modelName', 'model_name'),
      ('public', 'ai_coach_messages', 'promptTokens', 'prompt_tokens'),
      ('public', 'ai_coach_messages', 'sessionId', 'session_id'),
      ('public', 'ai_coach_messages', 'updatedAt', 'updated_at'),
      ('public', 'ai_coach_messages', 'userId', 'user_id'),
      ('public', 'ai_insights', 'createdAt', 'created_at'),
      ('public', 'ai_insights', 'insightType', 'insight_type'),
      ('public', 'ai_insights', 'modelVersion', 'model_version'),
      ('public', 'ai_insights', 'sessionId', 'session_id'),
      ('public', 'ai_insights', 'tokensUsed', 'tokens_used'),
      ('public', 'ai_insights', 'updatedAt', 'updated_at'),
      ('public', 'ai_insights', 'userId', 'user_id'),
      ('public', 'challenge_participants', 'challengeId', 'challenge_id'),
      ('public', 'challenge_participants', 'completedAt', 'completed_at'),
      ('public', 'challenge_participants', 'createdAt', 'created_at'),
      ('public', 'challenge_participants', 'joinedAt', 'joined_at'),
      ('public', 'challenge_participants', 'progressValue', 'progress_value'),
      ('public', 'challenge_participants', 'updatedAt', 'updated_at'),
      ('public', 'challenge_participants', 'userId', 'user_id'),
      ('public', 'challenges', 'challengeType', 'challenge_type'),
      ('public', 'challenges', 'createdAt', 'created_at'),
      ('public', 'challenges', 'creatorId', 'creator_id'),
      ('public', 'challenges', 'endDate', 'end_date'),
      ('public', 'challenges', 'isPublic', 'is_public'),
      ('public', 'challenges', 'startDate', 'start_date'),
      ('public', 'challenges', 'targetValue', 'target_value'),
      ('public', 'challenges', 'updatedAt', 'updated_at'),
      ('public', 'exercise_aliases', 'createdAt', 'created_at'),
      ('public', 'exercise_aliases', 'exerciseId', 'exercise_id'),
      ('public', 'exercise_aliases', 'normalizedAlias', 'normalized_alias'),
      ('public', 'exercise_aliases', 'updatedAt', 'updated_at'),
      ('public', 'exercise_personal_records', 'achievedAt', 'achieved_at'),
      ('public', 'exercise_personal_records', 'createdAt', 'created_at'),
      ('public', 'exercise_personal_records', 'exerciseId', 'exercise_id'),
      ('public', 'exercise_personal_records', 'sourceSessionId', 'source_session_id'),
      ('public', 'exercise_personal_records', 'sourceWorkoutSetId', 'source_workout_set_id'),
      ('public', 'exercise_personal_records', 'updatedAt', 'updated_at'),
      ('public', 'exercise_personal_records', 'userId', 'user_id'),
      ('public', 'exercises', 'createdAt', 'created_at'),
      ('public', 'exercises', 'isArchived', 'is_archived'),
      ('public', 'exercises', 'isPublic', 'is_public'),
      ('public', 'exercises', 'isUnilateral', 'is_unilateral'),
      ('public', 'exercises', 'ownerId', 'owner_id'),
      ('public', 'exercises', 'primaryMuscle', 'primary_muscle'),
      ('public', 'exercises', 'secondaryMuscles', 'secondary_muscles'),
      ('public', 'exercises', 'updatedAt', 'updated_at'),
      ('public', 'friendships', 'addresseeId', 'addressee_id'),
      ('public', 'friendships', 'createdAt', 'created_at'),
      ('public', 'friendships', 'requestedAt', 'requested_at'),
      ('public', 'friendships', 'requesterId', 'requester_id'),
      ('public', 'friendships', 'respondedAt', 'responded_at'),
      ('public', 'friendships', 'updatedAt', 'updated_at'),
      ('public', 'rest_timer_events', 'actualRestSec', 'actual_rest_sec'),
      ('public', 'rest_timer_events', 'createdAt', 'created_at'),
      ('public', 'rest_timer_events', 'eventType', 'event_type'),
      ('public', 'rest_timer_events', 'plannedRestSec', 'planned_rest_sec'),
      ('public', 'rest_timer_events', 'sessionExerciseId', 'session_exercise_id'),
      ('public', 'rest_timer_events', 'sessionId', 'session_id'),
      ('public', 'rest_timer_events', 'triggeredAt', 'triggered_at'),
      ('public', 'rest_timer_events', 'updatedAt', 'updated_at'),
      ('public', 'rest_timer_events', 'workoutSetId', 'workout_set_id'),
      ('public', 'social_reactions', 'createdAt', 'created_at'),
      ('public', 'social_reactions', 'postId', 'post_id'),
      ('public', 'social_reactions', 'reactionType', 'reaction_type'),
      ('public', 'social_reactions', 'updatedAt', 'updated_at'),
      ('public', 'social_reactions', 'userId', 'user_id'),
      ('public', 'social_workout_posts', 'createdAt', 'created_at'),
      ('public', 'social_workout_posts', 'isDeleted', 'is_deleted'),
      ('public', 'social_workout_posts', 'sessionId', 'session_id'),
      ('public', 'social_workout_posts', 'updatedAt', 'updated_at'),
      ('public', 'social_workout_posts', 'userId', 'user_id'),
      ('public', 'sync_events', 'clientEventId', 'client_event_id'),
      ('public', 'sync_events', 'conflictData', 'conflict_data'),
      ('public', 'sync_events', 'createdAt', 'created_at'),
      ('public', 'sync_events', 'deviceId', 'device_id'),
      ('public', 'sync_events', 'entityId', 'entity_id'),
      ('public', 'sync_events', 'entityType', 'entity_type'),
      ('public', 'sync_events', 'eventStatus', 'event_status'),
      ('public', 'sync_events', 'occurredAt', 'occurred_at'),
      ('public', 'sync_events', 'processedAt', 'processed_at'),
      ('public', 'sync_events', 'updatedAt', 'updated_at'),
      ('public', 'sync_events', 'userId', 'user_id'),
      ('public', 'training_program_weeks', 'createdAt', 'created_at'),
      ('public', 'training_program_weeks', 'programId', 'program_id'),
      ('public', 'training_program_weeks', 'updatedAt', 'updated_at'),
      ('public', 'training_program_weeks', 'weekNumber', 'week_number'),
      ('public', 'training_program_workouts', 'createdAt', 'created_at'),
      ('public', 'training_program_workouts', 'dayOfWeek', 'day_of_week'),
      ('public', 'training_program_workouts', 'orderIndex', 'order_index'),
      ('public', 'training_program_workouts', 'templateId', 'template_id'),
      ('public', 'training_program_workouts', 'updatedAt', 'updated_at'),
      ('public', 'training_program_workouts', 'weekId', 'week_id'),
      ('public', 'training_programs', 'authorId', 'author_id'),
      ('public', 'training_programs', 'createdAt', 'created_at'),
      ('public', 'training_programs', 'currencyCode', 'currency_code'),
      ('public', 'training_programs', 'isArchived', 'is_archived'),
      ('public', 'training_programs', 'isMarketplaceListed', 'is_marketplace_listed'),
      ('public', 'training_programs', 'isPublic', 'is_public'),
      ('public', 'training_programs', 'priceCents', 'price_cents'),
      ('public', 'training_programs', 'updatedAt', 'updated_at'),
      ('public', 'user_achievements', 'achievementDefinitionId', 'achievement_definition_id'),
      ('public', 'user_achievements', 'awardedAt', 'awarded_at'),
      ('public', 'user_achievements', 'createdAt', 'created_at'),
      ('public', 'user_achievements', 'updatedAt', 'updated_at'),
      ('public', 'user_achievements', 'userId', 'user_id'),
      ('public', 'user_profiles', 'birthDate', 'birth_date'),
      ('public', 'user_profiles', 'bodyFatPercent', 'body_fat_percent'),
      ('public', 'user_profiles', 'createdAt', 'created_at'),
      ('public', 'user_profiles', 'displayName', 'display_name'),
      ('public', 'user_profiles', 'firstName', 'first_name'),
      ('public', 'user_profiles', 'heightCm', 'height_cm'),
      ('public', 'user_profiles', 'lastName', 'last_name'),
      ('public', 'user_profiles', 'updatedAt', 'updated_at'),
      ('public', 'user_profiles', 'userId', 'user_id'),
      ('public', 'user_profiles', 'weightKg', 'weight_kg'),
      ('public', 'user_streaks', 'createdAt', 'created_at'),
      ('public', 'user_streaks', 'currentCount', 'current_count'),
      ('public', 'user_streaks', 'isActive', 'is_active'),
      ('public', 'user_streaks', 'lastEventDate', 'last_event_date'),
      ('public', 'user_streaks', 'longestCount', 'longest_count'),
      ('public', 'user_streaks', 'streakStartDate', 'streak_start_date'),
      ('public', 'user_streaks', 'streakType', 'streak_type'),
      ('public', 'user_streaks', 'updatedAt', 'updated_at'),
      ('public', 'user_streaks', 'userId', 'user_id'),
      ('public', 'users', 'createdAt', 'created_at'),
      ('public', 'users', 'deletedAt', 'deleted_at'),
      ('public', 'users', 'isOnboarded', 'is_onboarded'),
      ('public', 'users', 'telegramUserId', 'telegram_user_id'),
      ('public', 'users', 'telegramUsername', 'telegram_username'),
      ('public', 'users', 'updatedAt', 'updated_at'),
      ('public', 'workout_session_exercises', 'avgRpe', 'avg_rpe'),
      ('public', 'workout_session_exercises', 'bestEstimated1Rm', 'best_estimated1_rm'),
      ('public', 'workout_session_exercises', 'blockKey', 'block_key'),
      ('public', 'workout_session_exercises', 'blockType', 'block_type'),
      ('public', 'workout_session_exercises', 'createdAt', 'created_at'),
      ('public', 'workout_session_exercises', 'exerciseId', 'exercise_id'),
      ('public', 'workout_session_exercises', 'orderIndex', 'order_index'),
      ('public', 'workout_session_exercises', 'performedSets', 'performed_sets'),
      ('public', 'workout_session_exercises', 'sessionId', 'session_id'),
      ('public', 'workout_session_exercises', 'templateItemId', 'template_item_id'),
      ('public', 'workout_session_exercises', 'updatedAt', 'updated_at'),
      ('public', 'workout_session_exercises', 'volumeKg', 'volume_kg'),
      ('public', 'workout_sessions', 'createdAt', 'created_at'),
      ('public', 'workout_sessions', 'deletedAt', 'deleted_at'),
      ('public', 'workout_sessions', 'durationSeconds', 'duration_seconds'),
      ('public', 'workout_sessions', 'endedAt', 'ended_at'),
      ('public', 'workout_sessions', 'peakEstimated1RmKg', 'peak_estimated1_rm_kg'),
      ('public', 'workout_sessions', 'sessionFatigueScore', 'session_fatigue_score'),
      ('public', 'workout_sessions', 'sourceDeviceId', 'source_device_id'),
      ('public', 'workout_sessions', 'startedAt', 'started_at'),
      ('public', 'workout_sessions', 'syncVersion', 'sync_version'),
      ('public', 'workout_sessions', 'templateId', 'template_id'),
      ('public', 'workout_sessions', 'totalReps', 'total_reps'),
      ('public', 'workout_sessions', 'totalSets', 'total_sets'),
      ('public', 'workout_sessions', 'totalVolumeKg', 'total_volume_kg'),
      ('public', 'workout_sessions', 'trainingProgramWorkoutId', 'training_program_workout_id'),
      ('public', 'workout_sessions', 'updatedAt', 'updated_at'),
      ('public', 'workout_sessions', 'userId', 'user_id'),
      ('public', 'workout_sets', 'actualRestSec', 'actual_rest_sec'),
      ('public', 'workout_sets', 'createdAt', 'created_at'),
      ('public', 'workout_sets', 'distanceMeters', 'distance_meters'),
      ('public', 'workout_sets', 'durationSec', 'duration_sec'),
      ('public', 'workout_sets', 'estimated1RmKg', 'estimated1_rm_kg'),
      ('public', 'workout_sets', 'fatigueScore', 'fatigue_score'),
      ('public', 'workout_sets', 'isCompleted', 'is_completed'),
      ('public', 'workout_sets', 'sessionExerciseId', 'session_exercise_id'),
      ('public', 'workout_sets', 'setOrder', 'set_order'),
      ('public', 'workout_sets', 'setType', 'set_type'),
      ('public', 'workout_sets', 'suggestedRestSec', 'suggested_rest_sec'),
      ('public', 'workout_sets', 'updatedAt', 'updated_at'),
      ('public', 'workout_sets', 'weightKg', 'weight_kg'),
      ('public', 'workout_template_items', 'blockKey', 'block_key'),
      ('public', 'workout_template_items', 'blockType', 'block_type'),
      ('public', 'workout_template_items', 'createdAt', 'created_at'),
      ('public', 'workout_template_items', 'exerciseId', 'exercise_id'),
      ('public', 'workout_template_items', 'orderIndex', 'order_index'),
      ('public', 'workout_template_items', 'restSeconds', 'rest_seconds'),
      ('public', 'workout_template_items', 'targetRepsMax', 'target_reps_max'),
      ('public', 'workout_template_items', 'targetRepsMin', 'target_reps_min'),
      ('public', 'workout_template_items', 'targetRpe', 'target_rpe'),
      ('public', 'workout_template_items', 'targetSets', 'target_sets'),
      ('public', 'workout_template_items', 'targetWeightKg', 'target_weight_kg'),
      ('public', 'workout_template_items', 'templateId', 'template_id'),
      ('public', 'workout_template_items', 'updatedAt', 'updated_at'),
      ('public', 'workout_templates', 'createdAt', 'created_at'),
      ('public', 'workout_templates', 'estimatedMinSec', 'estimated_min_sec'),
      ('public', 'workout_templates', 'isArchived', 'is_archived'),
      ('public', 'workout_templates', 'isPublic', 'is_public'),
      ('public', 'workout_templates', 'updatedAt', 'updated_at'),
      ('public', 'workout_templates', 'userId', 'user_id')
    ) AS t(schema_name, table_name, old_col, new_col)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.schema_name AND table_name = r.table_name AND column_name = r.old_col
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.schema_name AND table_name = r.table_name AND column_name = r.new_col
    ) THEN
      EXECUTE format('UPDATE %I.%I SET %I = %I WHERE %I IS NULL AND %I IS NOT NULL',
        r.schema_name, r.table_name, r.new_col, r.old_col, r.new_col, r.old_col);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.zdt_sync_achievement_definitions_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."is_active" IS NULL AND NEW."isActive" IS NOT NULL THEN NEW."is_active" := NEW."isActive"; END IF;
    IF NEW."isActive" IS NULL AND NEW."is_active" IS NOT NULL THEN NEW."isActive" := NEW."is_active"; END IF;
    IF NEW."is_repeatable" IS NULL AND NEW."isRepeatable" IS NOT NULL THEN NEW."is_repeatable" := NEW."isRepeatable"; END IF;
    IF NEW."isRepeatable" IS NULL AND NEW."is_repeatable" IS NOT NULL THEN NEW."isRepeatable" := NEW."is_repeatable"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."isActive" IS DISTINCT FROM OLD."isActive" AND NEW."is_active" IS NOT DISTINCT FROM OLD."is_active" THEN
      NEW."is_active" := NEW."isActive";
    ELSIF NEW."is_active" IS DISTINCT FROM OLD."is_active" AND NEW."isActive" IS NOT DISTINCT FROM OLD."isActive" THEN
      NEW."isActive" := NEW."is_active";
    ELSIF NEW."is_active" IS NULL AND NEW."isActive" IS NOT NULL THEN
      NEW."is_active" := NEW."isActive";
    ELSIF NEW."isActive" IS NULL AND NEW."is_active" IS NOT NULL THEN
      NEW."isActive" := NEW."is_active";
    END IF;
    IF NEW."isRepeatable" IS DISTINCT FROM OLD."isRepeatable" AND NEW."is_repeatable" IS NOT DISTINCT FROM OLD."is_repeatable" THEN
      NEW."is_repeatable" := NEW."isRepeatable";
    ELSIF NEW."is_repeatable" IS DISTINCT FROM OLD."is_repeatable" AND NEW."isRepeatable" IS NOT DISTINCT FROM OLD."isRepeatable" THEN
      NEW."isRepeatable" := NEW."is_repeatable";
    ELSIF NEW."is_repeatable" IS NULL AND NEW."isRepeatable" IS NOT NULL THEN
      NEW."is_repeatable" := NEW."isRepeatable";
    ELSIF NEW."isRepeatable" IS NULL AND NEW."is_repeatable" IS NOT NULL THEN
      NEW."isRepeatable" := NEW."is_repeatable";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_achievement_definitions_camel_snake ON public.achievement_definitions;
CREATE TRIGGER trg_zdt_sync_achievement_definitions_camel_snake
BEFORE INSERT OR UPDATE ON public.achievement_definitions
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_achievement_definitions_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_adaptive_recommendations_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."applied_at" IS NULL AND NEW."appliedAt" IS NOT NULL THEN NEW."applied_at" := NEW."appliedAt"; END IF;
    IF NEW."appliedAt" IS NULL AND NEW."applied_at" IS NOT NULL THEN NEW."appliedAt" := NEW."applied_at"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."current_value" IS NULL AND NEW."currentValue" IS NOT NULL THEN NEW."current_value" := NEW."currentValue"; END IF;
    IF NEW."currentValue" IS NULL AND NEW."current_value" IS NOT NULL THEN NEW."currentValue" := NEW."current_value"; END IF;
    IF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN NEW."exercise_id" := NEW."exerciseId"; END IF;
    IF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN NEW."exerciseId" := NEW."exercise_id"; END IF;
    IF NEW."input_snapshot" IS NULL AND NEW."inputSnapshot" IS NOT NULL THEN NEW."input_snapshot" := NEW."inputSnapshot"; END IF;
    IF NEW."inputSnapshot" IS NULL AND NEW."input_snapshot" IS NOT NULL THEN NEW."inputSnapshot" := NEW."input_snapshot"; END IF;
    IF NEW."model_version" IS NULL AND NEW."modelVersion" IS NOT NULL THEN NEW."model_version" := NEW."modelVersion"; END IF;
    IF NEW."modelVersion" IS NULL AND NEW."model_version" IS NOT NULL THEN NEW."modelVersion" := NEW."model_version"; END IF;
    IF NEW."reason_code" IS NULL AND NEW."reasonCode" IS NOT NULL THEN NEW."reason_code" := NEW."reasonCode"; END IF;
    IF NEW."reasonCode" IS NULL AND NEW."reason_code" IS NOT NULL THEN NEW."reasonCode" := NEW."reason_code"; END IF;
    IF NEW."recommendation_type" IS NULL AND NEW."recommendationType" IS NOT NULL THEN NEW."recommendation_type" := NEW."recommendationType"; END IF;
    IF NEW."recommendationType" IS NULL AND NEW."recommendation_type" IS NOT NULL THEN NEW."recommendationType" := NEW."recommendation_type"; END IF;
    IF NEW."session_exercise_id" IS NULL AND NEW."sessionExerciseId" IS NOT NULL THEN NEW."session_exercise_id" := NEW."sessionExerciseId"; END IF;
    IF NEW."sessionExerciseId" IS NULL AND NEW."session_exercise_id" IS NOT NULL THEN NEW."sessionExerciseId" := NEW."session_exercise_id"; END IF;
    IF NEW."suggested_value" IS NULL AND NEW."suggestedValue" IS NOT NULL THEN NEW."suggested_value" := NEW."suggestedValue"; END IF;
    IF NEW."suggestedValue" IS NULL AND NEW."suggested_value" IS NOT NULL THEN NEW."suggestedValue" := NEW."suggested_value"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
    IF NEW."valid_until" IS NULL AND NEW."validUntil" IS NOT NULL THEN NEW."valid_until" := NEW."validUntil"; END IF;
    IF NEW."validUntil" IS NULL AND NEW."valid_until" IS NOT NULL THEN NEW."validUntil" := NEW."valid_until"; END IF;
  ELSE
    IF NEW."appliedAt" IS DISTINCT FROM OLD."appliedAt" AND NEW."applied_at" IS NOT DISTINCT FROM OLD."applied_at" THEN
      NEW."applied_at" := NEW."appliedAt";
    ELSIF NEW."applied_at" IS DISTINCT FROM OLD."applied_at" AND NEW."appliedAt" IS NOT DISTINCT FROM OLD."appliedAt" THEN
      NEW."appliedAt" := NEW."applied_at";
    ELSIF NEW."applied_at" IS NULL AND NEW."appliedAt" IS NOT NULL THEN
      NEW."applied_at" := NEW."appliedAt";
    ELSIF NEW."appliedAt" IS NULL AND NEW."applied_at" IS NOT NULL THEN
      NEW."appliedAt" := NEW."applied_at";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."currentValue" IS DISTINCT FROM OLD."currentValue" AND NEW."current_value" IS NOT DISTINCT FROM OLD."current_value" THEN
      NEW."current_value" := NEW."currentValue";
    ELSIF NEW."current_value" IS DISTINCT FROM OLD."current_value" AND NEW."currentValue" IS NOT DISTINCT FROM OLD."currentValue" THEN
      NEW."currentValue" := NEW."current_value";
    ELSIF NEW."current_value" IS NULL AND NEW."currentValue" IS NOT NULL THEN
      NEW."current_value" := NEW."currentValue";
    ELSIF NEW."currentValue" IS NULL AND NEW."current_value" IS NOT NULL THEN
      NEW."currentValue" := NEW."current_value";
    END IF;
    IF NEW."exerciseId" IS DISTINCT FROM OLD."exerciseId" AND NEW."exercise_id" IS NOT DISTINCT FROM OLD."exercise_id" THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exercise_id" IS DISTINCT FROM OLD."exercise_id" AND NEW."exerciseId" IS NOT DISTINCT FROM OLD."exerciseId" THEN
      NEW."exerciseId" := NEW."exercise_id";
    ELSIF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN
      NEW."exerciseId" := NEW."exercise_id";
    END IF;
    IF NEW."inputSnapshot" IS DISTINCT FROM OLD."inputSnapshot" AND NEW."input_snapshot" IS NOT DISTINCT FROM OLD."input_snapshot" THEN
      NEW."input_snapshot" := NEW."inputSnapshot";
    ELSIF NEW."input_snapshot" IS DISTINCT FROM OLD."input_snapshot" AND NEW."inputSnapshot" IS NOT DISTINCT FROM OLD."inputSnapshot" THEN
      NEW."inputSnapshot" := NEW."input_snapshot";
    ELSIF NEW."input_snapshot" IS NULL AND NEW."inputSnapshot" IS NOT NULL THEN
      NEW."input_snapshot" := NEW."inputSnapshot";
    ELSIF NEW."inputSnapshot" IS NULL AND NEW."input_snapshot" IS NOT NULL THEN
      NEW."inputSnapshot" := NEW."input_snapshot";
    END IF;
    IF NEW."modelVersion" IS DISTINCT FROM OLD."modelVersion" AND NEW."model_version" IS NOT DISTINCT FROM OLD."model_version" THEN
      NEW."model_version" := NEW."modelVersion";
    ELSIF NEW."model_version" IS DISTINCT FROM OLD."model_version" AND NEW."modelVersion" IS NOT DISTINCT FROM OLD."modelVersion" THEN
      NEW."modelVersion" := NEW."model_version";
    ELSIF NEW."model_version" IS NULL AND NEW."modelVersion" IS NOT NULL THEN
      NEW."model_version" := NEW."modelVersion";
    ELSIF NEW."modelVersion" IS NULL AND NEW."model_version" IS NOT NULL THEN
      NEW."modelVersion" := NEW."model_version";
    END IF;
    IF NEW."reasonCode" IS DISTINCT FROM OLD."reasonCode" AND NEW."reason_code" IS NOT DISTINCT FROM OLD."reason_code" THEN
      NEW."reason_code" := NEW."reasonCode";
    ELSIF NEW."reason_code" IS DISTINCT FROM OLD."reason_code" AND NEW."reasonCode" IS NOT DISTINCT FROM OLD."reasonCode" THEN
      NEW."reasonCode" := NEW."reason_code";
    ELSIF NEW."reason_code" IS NULL AND NEW."reasonCode" IS NOT NULL THEN
      NEW."reason_code" := NEW."reasonCode";
    ELSIF NEW."reasonCode" IS NULL AND NEW."reason_code" IS NOT NULL THEN
      NEW."reasonCode" := NEW."reason_code";
    END IF;
    IF NEW."recommendationType" IS DISTINCT FROM OLD."recommendationType" AND NEW."recommendation_type" IS NOT DISTINCT FROM OLD."recommendation_type" THEN
      NEW."recommendation_type" := NEW."recommendationType";
    ELSIF NEW."recommendation_type" IS DISTINCT FROM OLD."recommendation_type" AND NEW."recommendationType" IS NOT DISTINCT FROM OLD."recommendationType" THEN
      NEW."recommendationType" := NEW."recommendation_type";
    ELSIF NEW."recommendation_type" IS NULL AND NEW."recommendationType" IS NOT NULL THEN
      NEW."recommendation_type" := NEW."recommendationType";
    ELSIF NEW."recommendationType" IS NULL AND NEW."recommendation_type" IS NOT NULL THEN
      NEW."recommendationType" := NEW."recommendation_type";
    END IF;
    IF NEW."sessionExerciseId" IS DISTINCT FROM OLD."sessionExerciseId" AND NEW."session_exercise_id" IS NOT DISTINCT FROM OLD."session_exercise_id" THEN
      NEW."session_exercise_id" := NEW."sessionExerciseId";
    ELSIF NEW."session_exercise_id" IS DISTINCT FROM OLD."session_exercise_id" AND NEW."sessionExerciseId" IS NOT DISTINCT FROM OLD."sessionExerciseId" THEN
      NEW."sessionExerciseId" := NEW."session_exercise_id";
    ELSIF NEW."session_exercise_id" IS NULL AND NEW."sessionExerciseId" IS NOT NULL THEN
      NEW."session_exercise_id" := NEW."sessionExerciseId";
    ELSIF NEW."sessionExerciseId" IS NULL AND NEW."session_exercise_id" IS NOT NULL THEN
      NEW."sessionExerciseId" := NEW."session_exercise_id";
    END IF;
    IF NEW."suggestedValue" IS DISTINCT FROM OLD."suggestedValue" AND NEW."suggested_value" IS NOT DISTINCT FROM OLD."suggested_value" THEN
      NEW."suggested_value" := NEW."suggestedValue";
    ELSIF NEW."suggested_value" IS DISTINCT FROM OLD."suggested_value" AND NEW."suggestedValue" IS NOT DISTINCT FROM OLD."suggestedValue" THEN
      NEW."suggestedValue" := NEW."suggested_value";
    ELSIF NEW."suggested_value" IS NULL AND NEW."suggestedValue" IS NOT NULL THEN
      NEW."suggested_value" := NEW."suggestedValue";
    ELSIF NEW."suggestedValue" IS NULL AND NEW."suggested_value" IS NOT NULL THEN
      NEW."suggestedValue" := NEW."suggested_value";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
    IF NEW."validUntil" IS DISTINCT FROM OLD."validUntil" AND NEW."valid_until" IS NOT DISTINCT FROM OLD."valid_until" THEN
      NEW."valid_until" := NEW."validUntil";
    ELSIF NEW."valid_until" IS DISTINCT FROM OLD."valid_until" AND NEW."validUntil" IS NOT DISTINCT FROM OLD."validUntil" THEN
      NEW."validUntil" := NEW."valid_until";
    ELSIF NEW."valid_until" IS NULL AND NEW."validUntil" IS NOT NULL THEN
      NEW."valid_until" := NEW."validUntil";
    ELSIF NEW."validUntil" IS NULL AND NEW."valid_until" IS NOT NULL THEN
      NEW."validUntil" := NEW."valid_until";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_adaptive_recommendations_camel_snake ON public.adaptive_recommendations;
CREATE TRIGGER trg_zdt_sync_adaptive_recommendations_camel_snake
BEFORE INSERT OR UPDATE ON public.adaptive_recommendations
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_adaptive_recommendations_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_ai_coach_messages_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."completion_tokens" IS NULL AND NEW."completionTokens" IS NOT NULL THEN NEW."completion_tokens" := NEW."completionTokens"; END IF;
    IF NEW."completionTokens" IS NULL AND NEW."completion_tokens" IS NOT NULL THEN NEW."completionTokens" := NEW."completion_tokens"; END IF;
    IF NEW."conversation_key" IS NULL AND NEW."conversationKey" IS NOT NULL THEN NEW."conversation_key" := NEW."conversationKey"; END IF;
    IF NEW."conversationKey" IS NULL AND NEW."conversation_key" IS NOT NULL THEN NEW."conversationKey" := NEW."conversation_key"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."insight_id" IS NULL AND NEW."insightId" IS NOT NULL THEN NEW."insight_id" := NEW."insightId"; END IF;
    IF NEW."insightId" IS NULL AND NEW."insight_id" IS NOT NULL THEN NEW."insightId" := NEW."insight_id"; END IF;
    IF NEW."model_name" IS NULL AND NEW."modelName" IS NOT NULL THEN NEW."model_name" := NEW."modelName"; END IF;
    IF NEW."modelName" IS NULL AND NEW."model_name" IS NOT NULL THEN NEW."modelName" := NEW."model_name"; END IF;
    IF NEW."prompt_tokens" IS NULL AND NEW."promptTokens" IS NOT NULL THEN NEW."prompt_tokens" := NEW."promptTokens"; END IF;
    IF NEW."promptTokens" IS NULL AND NEW."prompt_tokens" IS NOT NULL THEN NEW."promptTokens" := NEW."prompt_tokens"; END IF;
    IF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN NEW."session_id" := NEW."sessionId"; END IF;
    IF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN NEW."sessionId" := NEW."session_id"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."completionTokens" IS DISTINCT FROM OLD."completionTokens" AND NEW."completion_tokens" IS NOT DISTINCT FROM OLD."completion_tokens" THEN
      NEW."completion_tokens" := NEW."completionTokens";
    ELSIF NEW."completion_tokens" IS DISTINCT FROM OLD."completion_tokens" AND NEW."completionTokens" IS NOT DISTINCT FROM OLD."completionTokens" THEN
      NEW."completionTokens" := NEW."completion_tokens";
    ELSIF NEW."completion_tokens" IS NULL AND NEW."completionTokens" IS NOT NULL THEN
      NEW."completion_tokens" := NEW."completionTokens";
    ELSIF NEW."completionTokens" IS NULL AND NEW."completion_tokens" IS NOT NULL THEN
      NEW."completionTokens" := NEW."completion_tokens";
    END IF;
    IF NEW."conversationKey" IS DISTINCT FROM OLD."conversationKey" AND NEW."conversation_key" IS NOT DISTINCT FROM OLD."conversation_key" THEN
      NEW."conversation_key" := NEW."conversationKey";
    ELSIF NEW."conversation_key" IS DISTINCT FROM OLD."conversation_key" AND NEW."conversationKey" IS NOT DISTINCT FROM OLD."conversationKey" THEN
      NEW."conversationKey" := NEW."conversation_key";
    ELSIF NEW."conversation_key" IS NULL AND NEW."conversationKey" IS NOT NULL THEN
      NEW."conversation_key" := NEW."conversationKey";
    ELSIF NEW."conversationKey" IS NULL AND NEW."conversation_key" IS NOT NULL THEN
      NEW."conversationKey" := NEW."conversation_key";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."insightId" IS DISTINCT FROM OLD."insightId" AND NEW."insight_id" IS NOT DISTINCT FROM OLD."insight_id" THEN
      NEW."insight_id" := NEW."insightId";
    ELSIF NEW."insight_id" IS DISTINCT FROM OLD."insight_id" AND NEW."insightId" IS NOT DISTINCT FROM OLD."insightId" THEN
      NEW."insightId" := NEW."insight_id";
    ELSIF NEW."insight_id" IS NULL AND NEW."insightId" IS NOT NULL THEN
      NEW."insight_id" := NEW."insightId";
    ELSIF NEW."insightId" IS NULL AND NEW."insight_id" IS NOT NULL THEN
      NEW."insightId" := NEW."insight_id";
    END IF;
    IF NEW."modelName" IS DISTINCT FROM OLD."modelName" AND NEW."model_name" IS NOT DISTINCT FROM OLD."model_name" THEN
      NEW."model_name" := NEW."modelName";
    ELSIF NEW."model_name" IS DISTINCT FROM OLD."model_name" AND NEW."modelName" IS NOT DISTINCT FROM OLD."modelName" THEN
      NEW."modelName" := NEW."model_name";
    ELSIF NEW."model_name" IS NULL AND NEW."modelName" IS NOT NULL THEN
      NEW."model_name" := NEW."modelName";
    ELSIF NEW."modelName" IS NULL AND NEW."model_name" IS NOT NULL THEN
      NEW."modelName" := NEW."model_name";
    END IF;
    IF NEW."promptTokens" IS DISTINCT FROM OLD."promptTokens" AND NEW."prompt_tokens" IS NOT DISTINCT FROM OLD."prompt_tokens" THEN
      NEW."prompt_tokens" := NEW."promptTokens";
    ELSIF NEW."prompt_tokens" IS DISTINCT FROM OLD."prompt_tokens" AND NEW."promptTokens" IS NOT DISTINCT FROM OLD."promptTokens" THEN
      NEW."promptTokens" := NEW."prompt_tokens";
    ELSIF NEW."prompt_tokens" IS NULL AND NEW."promptTokens" IS NOT NULL THEN
      NEW."prompt_tokens" := NEW."promptTokens";
    ELSIF NEW."promptTokens" IS NULL AND NEW."prompt_tokens" IS NOT NULL THEN
      NEW."promptTokens" := NEW."prompt_tokens";
    END IF;
    IF NEW."sessionId" IS DISTINCT FROM OLD."sessionId" AND NEW."session_id" IS NOT DISTINCT FROM OLD."session_id" THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."session_id" IS DISTINCT FROM OLD."session_id" AND NEW."sessionId" IS NOT DISTINCT FROM OLD."sessionId" THEN
      NEW."sessionId" := NEW."session_id";
    ELSIF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN
      NEW."sessionId" := NEW."session_id";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_ai_coach_messages_camel_snake ON public.ai_coach_messages;
CREATE TRIGGER trg_zdt_sync_ai_coach_messages_camel_snake
BEFORE INSERT OR UPDATE ON public.ai_coach_messages
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_ai_coach_messages_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_ai_insights_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."insight_type" IS NULL AND NEW."insightType" IS NOT NULL THEN NEW."insight_type" := NEW."insightType"; END IF;
    IF NEW."insightType" IS NULL AND NEW."insight_type" IS NOT NULL THEN NEW."insightType" := NEW."insight_type"; END IF;
    IF NEW."model_version" IS NULL AND NEW."modelVersion" IS NOT NULL THEN NEW."model_version" := NEW."modelVersion"; END IF;
    IF NEW."modelVersion" IS NULL AND NEW."model_version" IS NOT NULL THEN NEW."modelVersion" := NEW."model_version"; END IF;
    IF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN NEW."session_id" := NEW."sessionId"; END IF;
    IF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN NEW."sessionId" := NEW."session_id"; END IF;
    IF NEW."tokens_used" IS NULL AND NEW."tokensUsed" IS NOT NULL THEN NEW."tokens_used" := NEW."tokensUsed"; END IF;
    IF NEW."tokensUsed" IS NULL AND NEW."tokens_used" IS NOT NULL THEN NEW."tokensUsed" := NEW."tokens_used"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."insightType" IS DISTINCT FROM OLD."insightType" AND NEW."insight_type" IS NOT DISTINCT FROM OLD."insight_type" THEN
      NEW."insight_type" := NEW."insightType";
    ELSIF NEW."insight_type" IS DISTINCT FROM OLD."insight_type" AND NEW."insightType" IS NOT DISTINCT FROM OLD."insightType" THEN
      NEW."insightType" := NEW."insight_type";
    ELSIF NEW."insight_type" IS NULL AND NEW."insightType" IS NOT NULL THEN
      NEW."insight_type" := NEW."insightType";
    ELSIF NEW."insightType" IS NULL AND NEW."insight_type" IS NOT NULL THEN
      NEW."insightType" := NEW."insight_type";
    END IF;
    IF NEW."modelVersion" IS DISTINCT FROM OLD."modelVersion" AND NEW."model_version" IS NOT DISTINCT FROM OLD."model_version" THEN
      NEW."model_version" := NEW."modelVersion";
    ELSIF NEW."model_version" IS DISTINCT FROM OLD."model_version" AND NEW."modelVersion" IS NOT DISTINCT FROM OLD."modelVersion" THEN
      NEW."modelVersion" := NEW."model_version";
    ELSIF NEW."model_version" IS NULL AND NEW."modelVersion" IS NOT NULL THEN
      NEW."model_version" := NEW."modelVersion";
    ELSIF NEW."modelVersion" IS NULL AND NEW."model_version" IS NOT NULL THEN
      NEW."modelVersion" := NEW."model_version";
    END IF;
    IF NEW."sessionId" IS DISTINCT FROM OLD."sessionId" AND NEW."session_id" IS NOT DISTINCT FROM OLD."session_id" THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."session_id" IS DISTINCT FROM OLD."session_id" AND NEW."sessionId" IS NOT DISTINCT FROM OLD."sessionId" THEN
      NEW."sessionId" := NEW."session_id";
    ELSIF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN
      NEW."sessionId" := NEW."session_id";
    END IF;
    IF NEW."tokensUsed" IS DISTINCT FROM OLD."tokensUsed" AND NEW."tokens_used" IS NOT DISTINCT FROM OLD."tokens_used" THEN
      NEW."tokens_used" := NEW."tokensUsed";
    ELSIF NEW."tokens_used" IS DISTINCT FROM OLD."tokens_used" AND NEW."tokensUsed" IS NOT DISTINCT FROM OLD."tokensUsed" THEN
      NEW."tokensUsed" := NEW."tokens_used";
    ELSIF NEW."tokens_used" IS NULL AND NEW."tokensUsed" IS NOT NULL THEN
      NEW."tokens_used" := NEW."tokensUsed";
    ELSIF NEW."tokensUsed" IS NULL AND NEW."tokens_used" IS NOT NULL THEN
      NEW."tokensUsed" := NEW."tokens_used";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_ai_insights_camel_snake ON public.ai_insights;
CREATE TRIGGER trg_zdt_sync_ai_insights_camel_snake
BEFORE INSERT OR UPDATE ON public.ai_insights
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_ai_insights_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_challenge_participants_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."challenge_id" IS NULL AND NEW."challengeId" IS NOT NULL THEN NEW."challenge_id" := NEW."challengeId"; END IF;
    IF NEW."challengeId" IS NULL AND NEW."challenge_id" IS NOT NULL THEN NEW."challengeId" := NEW."challenge_id"; END IF;
    IF NEW."completed_at" IS NULL AND NEW."completedAt" IS NOT NULL THEN NEW."completed_at" := NEW."completedAt"; END IF;
    IF NEW."completedAt" IS NULL AND NEW."completed_at" IS NOT NULL THEN NEW."completedAt" := NEW."completed_at"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."joined_at" IS NULL AND NEW."joinedAt" IS NOT NULL THEN NEW."joined_at" := NEW."joinedAt"; END IF;
    IF NEW."joinedAt" IS NULL AND NEW."joined_at" IS NOT NULL THEN NEW."joinedAt" := NEW."joined_at"; END IF;
    IF NEW."progress_value" IS NULL AND NEW."progressValue" IS NOT NULL THEN NEW."progress_value" := NEW."progressValue"; END IF;
    IF NEW."progressValue" IS NULL AND NEW."progress_value" IS NOT NULL THEN NEW."progressValue" := NEW."progress_value"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."challengeId" IS DISTINCT FROM OLD."challengeId" AND NEW."challenge_id" IS NOT DISTINCT FROM OLD."challenge_id" THEN
      NEW."challenge_id" := NEW."challengeId";
    ELSIF NEW."challenge_id" IS DISTINCT FROM OLD."challenge_id" AND NEW."challengeId" IS NOT DISTINCT FROM OLD."challengeId" THEN
      NEW."challengeId" := NEW."challenge_id";
    ELSIF NEW."challenge_id" IS NULL AND NEW."challengeId" IS NOT NULL THEN
      NEW."challenge_id" := NEW."challengeId";
    ELSIF NEW."challengeId" IS NULL AND NEW."challenge_id" IS NOT NULL THEN
      NEW."challengeId" := NEW."challenge_id";
    END IF;
    IF NEW."completedAt" IS DISTINCT FROM OLD."completedAt" AND NEW."completed_at" IS NOT DISTINCT FROM OLD."completed_at" THEN
      NEW."completed_at" := NEW."completedAt";
    ELSIF NEW."completed_at" IS DISTINCT FROM OLD."completed_at" AND NEW."completedAt" IS NOT DISTINCT FROM OLD."completedAt" THEN
      NEW."completedAt" := NEW."completed_at";
    ELSIF NEW."completed_at" IS NULL AND NEW."completedAt" IS NOT NULL THEN
      NEW."completed_at" := NEW."completedAt";
    ELSIF NEW."completedAt" IS NULL AND NEW."completed_at" IS NOT NULL THEN
      NEW."completedAt" := NEW."completed_at";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."joinedAt" IS DISTINCT FROM OLD."joinedAt" AND NEW."joined_at" IS NOT DISTINCT FROM OLD."joined_at" THEN
      NEW."joined_at" := NEW."joinedAt";
    ELSIF NEW."joined_at" IS DISTINCT FROM OLD."joined_at" AND NEW."joinedAt" IS NOT DISTINCT FROM OLD."joinedAt" THEN
      NEW."joinedAt" := NEW."joined_at";
    ELSIF NEW."joined_at" IS NULL AND NEW."joinedAt" IS NOT NULL THEN
      NEW."joined_at" := NEW."joinedAt";
    ELSIF NEW."joinedAt" IS NULL AND NEW."joined_at" IS NOT NULL THEN
      NEW."joinedAt" := NEW."joined_at";
    END IF;
    IF NEW."progressValue" IS DISTINCT FROM OLD."progressValue" AND NEW."progress_value" IS NOT DISTINCT FROM OLD."progress_value" THEN
      NEW."progress_value" := NEW."progressValue";
    ELSIF NEW."progress_value" IS DISTINCT FROM OLD."progress_value" AND NEW."progressValue" IS NOT DISTINCT FROM OLD."progressValue" THEN
      NEW."progressValue" := NEW."progress_value";
    ELSIF NEW."progress_value" IS NULL AND NEW."progressValue" IS NOT NULL THEN
      NEW."progress_value" := NEW."progressValue";
    ELSIF NEW."progressValue" IS NULL AND NEW."progress_value" IS NOT NULL THEN
      NEW."progressValue" := NEW."progress_value";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_challenge_participants_camel_snake ON public.challenge_participants;
CREATE TRIGGER trg_zdt_sync_challenge_participants_camel_snake
BEFORE INSERT OR UPDATE ON public.challenge_participants
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_challenge_participants_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_challenges_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."challenge_type" IS NULL AND NEW."challengeType" IS NOT NULL THEN NEW."challenge_type" := NEW."challengeType"; END IF;
    IF NEW."challengeType" IS NULL AND NEW."challenge_type" IS NOT NULL THEN NEW."challengeType" := NEW."challenge_type"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."creator_id" IS NULL AND NEW."creatorId" IS NOT NULL THEN NEW."creator_id" := NEW."creatorId"; END IF;
    IF NEW."creatorId" IS NULL AND NEW."creator_id" IS NOT NULL THEN NEW."creatorId" := NEW."creator_id"; END IF;
    IF NEW."end_date" IS NULL AND NEW."endDate" IS NOT NULL THEN NEW."end_date" := NEW."endDate"; END IF;
    IF NEW."endDate" IS NULL AND NEW."end_date" IS NOT NULL THEN NEW."endDate" := NEW."end_date"; END IF;
    IF NEW."is_public" IS NULL AND NEW."isPublic" IS NOT NULL THEN NEW."is_public" := NEW."isPublic"; END IF;
    IF NEW."isPublic" IS NULL AND NEW."is_public" IS NOT NULL THEN NEW."isPublic" := NEW."is_public"; END IF;
    IF NEW."start_date" IS NULL AND NEW."startDate" IS NOT NULL THEN NEW."start_date" := NEW."startDate"; END IF;
    IF NEW."startDate" IS NULL AND NEW."start_date" IS NOT NULL THEN NEW."startDate" := NEW."start_date"; END IF;
    IF NEW."target_value" IS NULL AND NEW."targetValue" IS NOT NULL THEN NEW."target_value" := NEW."targetValue"; END IF;
    IF NEW."targetValue" IS NULL AND NEW."target_value" IS NOT NULL THEN NEW."targetValue" := NEW."target_value"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
  ELSE
    IF NEW."challengeType" IS DISTINCT FROM OLD."challengeType" AND NEW."challenge_type" IS NOT DISTINCT FROM OLD."challenge_type" THEN
      NEW."challenge_type" := NEW."challengeType";
    ELSIF NEW."challenge_type" IS DISTINCT FROM OLD."challenge_type" AND NEW."challengeType" IS NOT DISTINCT FROM OLD."challengeType" THEN
      NEW."challengeType" := NEW."challenge_type";
    ELSIF NEW."challenge_type" IS NULL AND NEW."challengeType" IS NOT NULL THEN
      NEW."challenge_type" := NEW."challengeType";
    ELSIF NEW."challengeType" IS NULL AND NEW."challenge_type" IS NOT NULL THEN
      NEW."challengeType" := NEW."challenge_type";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."creatorId" IS DISTINCT FROM OLD."creatorId" AND NEW."creator_id" IS NOT DISTINCT FROM OLD."creator_id" THEN
      NEW."creator_id" := NEW."creatorId";
    ELSIF NEW."creator_id" IS DISTINCT FROM OLD."creator_id" AND NEW."creatorId" IS NOT DISTINCT FROM OLD."creatorId" THEN
      NEW."creatorId" := NEW."creator_id";
    ELSIF NEW."creator_id" IS NULL AND NEW."creatorId" IS NOT NULL THEN
      NEW."creator_id" := NEW."creatorId";
    ELSIF NEW."creatorId" IS NULL AND NEW."creator_id" IS NOT NULL THEN
      NEW."creatorId" := NEW."creator_id";
    END IF;
    IF NEW."endDate" IS DISTINCT FROM OLD."endDate" AND NEW."end_date" IS NOT DISTINCT FROM OLD."end_date" THEN
      NEW."end_date" := NEW."endDate";
    ELSIF NEW."end_date" IS DISTINCT FROM OLD."end_date" AND NEW."endDate" IS NOT DISTINCT FROM OLD."endDate" THEN
      NEW."endDate" := NEW."end_date";
    ELSIF NEW."end_date" IS NULL AND NEW."endDate" IS NOT NULL THEN
      NEW."end_date" := NEW."endDate";
    ELSIF NEW."endDate" IS NULL AND NEW."end_date" IS NOT NULL THEN
      NEW."endDate" := NEW."end_date";
    END IF;
    IF NEW."isPublic" IS DISTINCT FROM OLD."isPublic" AND NEW."is_public" IS NOT DISTINCT FROM OLD."is_public" THEN
      NEW."is_public" := NEW."isPublic";
    ELSIF NEW."is_public" IS DISTINCT FROM OLD."is_public" AND NEW."isPublic" IS NOT DISTINCT FROM OLD."isPublic" THEN
      NEW."isPublic" := NEW."is_public";
    ELSIF NEW."is_public" IS NULL AND NEW."isPublic" IS NOT NULL THEN
      NEW."is_public" := NEW."isPublic";
    ELSIF NEW."isPublic" IS NULL AND NEW."is_public" IS NOT NULL THEN
      NEW."isPublic" := NEW."is_public";
    END IF;
    IF NEW."startDate" IS DISTINCT FROM OLD."startDate" AND NEW."start_date" IS NOT DISTINCT FROM OLD."start_date" THEN
      NEW."start_date" := NEW."startDate";
    ELSIF NEW."start_date" IS DISTINCT FROM OLD."start_date" AND NEW."startDate" IS NOT DISTINCT FROM OLD."startDate" THEN
      NEW."startDate" := NEW."start_date";
    ELSIF NEW."start_date" IS NULL AND NEW."startDate" IS NOT NULL THEN
      NEW."start_date" := NEW."startDate";
    ELSIF NEW."startDate" IS NULL AND NEW."start_date" IS NOT NULL THEN
      NEW."startDate" := NEW."start_date";
    END IF;
    IF NEW."targetValue" IS DISTINCT FROM OLD."targetValue" AND NEW."target_value" IS NOT DISTINCT FROM OLD."target_value" THEN
      NEW."target_value" := NEW."targetValue";
    ELSIF NEW."target_value" IS DISTINCT FROM OLD."target_value" AND NEW."targetValue" IS NOT DISTINCT FROM OLD."targetValue" THEN
      NEW."targetValue" := NEW."target_value";
    ELSIF NEW."target_value" IS NULL AND NEW."targetValue" IS NOT NULL THEN
      NEW."target_value" := NEW."targetValue";
    ELSIF NEW."targetValue" IS NULL AND NEW."target_value" IS NOT NULL THEN
      NEW."targetValue" := NEW."target_value";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_challenges_camel_snake ON public.challenges;
CREATE TRIGGER trg_zdt_sync_challenges_camel_snake
BEFORE INSERT OR UPDATE ON public.challenges
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_challenges_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_exercise_aliases_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN NEW."exercise_id" := NEW."exerciseId"; END IF;
    IF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN NEW."exerciseId" := NEW."exercise_id"; END IF;
    IF NEW."normalized_alias" IS NULL AND NEW."normalizedAlias" IS NOT NULL THEN NEW."normalized_alias" := NEW."normalizedAlias"; END IF;
    IF NEW."normalizedAlias" IS NULL AND NEW."normalized_alias" IS NOT NULL THEN NEW."normalizedAlias" := NEW."normalized_alias"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."exerciseId" IS DISTINCT FROM OLD."exerciseId" AND NEW."exercise_id" IS NOT DISTINCT FROM OLD."exercise_id" THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exercise_id" IS DISTINCT FROM OLD."exercise_id" AND NEW."exerciseId" IS NOT DISTINCT FROM OLD."exerciseId" THEN
      NEW."exerciseId" := NEW."exercise_id";
    ELSIF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN
      NEW."exerciseId" := NEW."exercise_id";
    END IF;
    IF NEW."normalizedAlias" IS DISTINCT FROM OLD."normalizedAlias" AND NEW."normalized_alias" IS NOT DISTINCT FROM OLD."normalized_alias" THEN
      NEW."normalized_alias" := NEW."normalizedAlias";
    ELSIF NEW."normalized_alias" IS DISTINCT FROM OLD."normalized_alias" AND NEW."normalizedAlias" IS NOT DISTINCT FROM OLD."normalizedAlias" THEN
      NEW."normalizedAlias" := NEW."normalized_alias";
    ELSIF NEW."normalized_alias" IS NULL AND NEW."normalizedAlias" IS NOT NULL THEN
      NEW."normalized_alias" := NEW."normalizedAlias";
    ELSIF NEW."normalizedAlias" IS NULL AND NEW."normalized_alias" IS NOT NULL THEN
      NEW."normalizedAlias" := NEW."normalized_alias";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_exercise_aliases_camel_snake ON public.exercise_aliases;
CREATE TRIGGER trg_zdt_sync_exercise_aliases_camel_snake
BEFORE INSERT OR UPDATE ON public.exercise_aliases
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_exercise_aliases_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_exercise_personal_records_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."achieved_at" IS NULL AND NEW."achievedAt" IS NOT NULL THEN NEW."achieved_at" := NEW."achievedAt"; END IF;
    IF NEW."achievedAt" IS NULL AND NEW."achieved_at" IS NOT NULL THEN NEW."achievedAt" := NEW."achieved_at"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN NEW."exercise_id" := NEW."exerciseId"; END IF;
    IF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN NEW."exerciseId" := NEW."exercise_id"; END IF;
    IF NEW."source_session_id" IS NULL AND NEW."sourceSessionId" IS NOT NULL THEN NEW."source_session_id" := NEW."sourceSessionId"; END IF;
    IF NEW."sourceSessionId" IS NULL AND NEW."source_session_id" IS NOT NULL THEN NEW."sourceSessionId" := NEW."source_session_id"; END IF;
    IF NEW."source_workout_set_id" IS NULL AND NEW."sourceWorkoutSetId" IS NOT NULL THEN NEW."source_workout_set_id" := NEW."sourceWorkoutSetId"; END IF;
    IF NEW."sourceWorkoutSetId" IS NULL AND NEW."source_workout_set_id" IS NOT NULL THEN NEW."sourceWorkoutSetId" := NEW."source_workout_set_id"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."achievedAt" IS DISTINCT FROM OLD."achievedAt" AND NEW."achieved_at" IS NOT DISTINCT FROM OLD."achieved_at" THEN
      NEW."achieved_at" := NEW."achievedAt";
    ELSIF NEW."achieved_at" IS DISTINCT FROM OLD."achieved_at" AND NEW."achievedAt" IS NOT DISTINCT FROM OLD."achievedAt" THEN
      NEW."achievedAt" := NEW."achieved_at";
    ELSIF NEW."achieved_at" IS NULL AND NEW."achievedAt" IS NOT NULL THEN
      NEW."achieved_at" := NEW."achievedAt";
    ELSIF NEW."achievedAt" IS NULL AND NEW."achieved_at" IS NOT NULL THEN
      NEW."achievedAt" := NEW."achieved_at";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."exerciseId" IS DISTINCT FROM OLD."exerciseId" AND NEW."exercise_id" IS NOT DISTINCT FROM OLD."exercise_id" THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exercise_id" IS DISTINCT FROM OLD."exercise_id" AND NEW."exerciseId" IS NOT DISTINCT FROM OLD."exerciseId" THEN
      NEW."exerciseId" := NEW."exercise_id";
    ELSIF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN
      NEW."exerciseId" := NEW."exercise_id";
    END IF;
    IF NEW."sourceSessionId" IS DISTINCT FROM OLD."sourceSessionId" AND NEW."source_session_id" IS NOT DISTINCT FROM OLD."source_session_id" THEN
      NEW."source_session_id" := NEW."sourceSessionId";
    ELSIF NEW."source_session_id" IS DISTINCT FROM OLD."source_session_id" AND NEW."sourceSessionId" IS NOT DISTINCT FROM OLD."sourceSessionId" THEN
      NEW."sourceSessionId" := NEW."source_session_id";
    ELSIF NEW."source_session_id" IS NULL AND NEW."sourceSessionId" IS NOT NULL THEN
      NEW."source_session_id" := NEW."sourceSessionId";
    ELSIF NEW."sourceSessionId" IS NULL AND NEW."source_session_id" IS NOT NULL THEN
      NEW."sourceSessionId" := NEW."source_session_id";
    END IF;
    IF NEW."sourceWorkoutSetId" IS DISTINCT FROM OLD."sourceWorkoutSetId" AND NEW."source_workout_set_id" IS NOT DISTINCT FROM OLD."source_workout_set_id" THEN
      NEW."source_workout_set_id" := NEW."sourceWorkoutSetId";
    ELSIF NEW."source_workout_set_id" IS DISTINCT FROM OLD."source_workout_set_id" AND NEW."sourceWorkoutSetId" IS NOT DISTINCT FROM OLD."sourceWorkoutSetId" THEN
      NEW."sourceWorkoutSetId" := NEW."source_workout_set_id";
    ELSIF NEW."source_workout_set_id" IS NULL AND NEW."sourceWorkoutSetId" IS NOT NULL THEN
      NEW."source_workout_set_id" := NEW."sourceWorkoutSetId";
    ELSIF NEW."sourceWorkoutSetId" IS NULL AND NEW."source_workout_set_id" IS NOT NULL THEN
      NEW."sourceWorkoutSetId" := NEW."source_workout_set_id";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_exercise_personal_records_camel_snake ON public.exercise_personal_records;
CREATE TRIGGER trg_zdt_sync_exercise_personal_records_camel_snake
BEFORE INSERT OR UPDATE ON public.exercise_personal_records
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_exercise_personal_records_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_exercises_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."is_archived" IS NULL AND NEW."isArchived" IS NOT NULL THEN NEW."is_archived" := NEW."isArchived"; END IF;
    IF NEW."isArchived" IS NULL AND NEW."is_archived" IS NOT NULL THEN NEW."isArchived" := NEW."is_archived"; END IF;
    IF NEW."is_public" IS NULL AND NEW."isPublic" IS NOT NULL THEN NEW."is_public" := NEW."isPublic"; END IF;
    IF NEW."isPublic" IS NULL AND NEW."is_public" IS NOT NULL THEN NEW."isPublic" := NEW."is_public"; END IF;
    IF NEW."is_unilateral" IS NULL AND NEW."isUnilateral" IS NOT NULL THEN NEW."is_unilateral" := NEW."isUnilateral"; END IF;
    IF NEW."isUnilateral" IS NULL AND NEW."is_unilateral" IS NOT NULL THEN NEW."isUnilateral" := NEW."is_unilateral"; END IF;
    IF NEW."owner_id" IS NULL AND NEW."ownerId" IS NOT NULL THEN NEW."owner_id" := NEW."ownerId"; END IF;
    IF NEW."ownerId" IS NULL AND NEW."owner_id" IS NOT NULL THEN NEW."ownerId" := NEW."owner_id"; END IF;
    IF NEW."primary_muscle" IS NULL AND NEW."primaryMuscle" IS NOT NULL THEN NEW."primary_muscle" := NEW."primaryMuscle"; END IF;
    IF NEW."primaryMuscle" IS NULL AND NEW."primary_muscle" IS NOT NULL THEN NEW."primaryMuscle" := NEW."primary_muscle"; END IF;
    IF NEW."secondary_muscles" IS NULL AND NEW."secondaryMuscles" IS NOT NULL THEN NEW."secondary_muscles" := NEW."secondaryMuscles"; END IF;
    IF NEW."secondaryMuscles" IS NULL AND NEW."secondary_muscles" IS NOT NULL THEN NEW."secondaryMuscles" := NEW."secondary_muscles"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."isArchived" IS DISTINCT FROM OLD."isArchived" AND NEW."is_archived" IS NOT DISTINCT FROM OLD."is_archived" THEN
      NEW."is_archived" := NEW."isArchived";
    ELSIF NEW."is_archived" IS DISTINCT FROM OLD."is_archived" AND NEW."isArchived" IS NOT DISTINCT FROM OLD."isArchived" THEN
      NEW."isArchived" := NEW."is_archived";
    ELSIF NEW."is_archived" IS NULL AND NEW."isArchived" IS NOT NULL THEN
      NEW."is_archived" := NEW."isArchived";
    ELSIF NEW."isArchived" IS NULL AND NEW."is_archived" IS NOT NULL THEN
      NEW."isArchived" := NEW."is_archived";
    END IF;
    IF NEW."isPublic" IS DISTINCT FROM OLD."isPublic" AND NEW."is_public" IS NOT DISTINCT FROM OLD."is_public" THEN
      NEW."is_public" := NEW."isPublic";
    ELSIF NEW."is_public" IS DISTINCT FROM OLD."is_public" AND NEW."isPublic" IS NOT DISTINCT FROM OLD."isPublic" THEN
      NEW."isPublic" := NEW."is_public";
    ELSIF NEW."is_public" IS NULL AND NEW."isPublic" IS NOT NULL THEN
      NEW."is_public" := NEW."isPublic";
    ELSIF NEW."isPublic" IS NULL AND NEW."is_public" IS NOT NULL THEN
      NEW."isPublic" := NEW."is_public";
    END IF;
    IF NEW."isUnilateral" IS DISTINCT FROM OLD."isUnilateral" AND NEW."is_unilateral" IS NOT DISTINCT FROM OLD."is_unilateral" THEN
      NEW."is_unilateral" := NEW."isUnilateral";
    ELSIF NEW."is_unilateral" IS DISTINCT FROM OLD."is_unilateral" AND NEW."isUnilateral" IS NOT DISTINCT FROM OLD."isUnilateral" THEN
      NEW."isUnilateral" := NEW."is_unilateral";
    ELSIF NEW."is_unilateral" IS NULL AND NEW."isUnilateral" IS NOT NULL THEN
      NEW."is_unilateral" := NEW."isUnilateral";
    ELSIF NEW."isUnilateral" IS NULL AND NEW."is_unilateral" IS NOT NULL THEN
      NEW."isUnilateral" := NEW."is_unilateral";
    END IF;
    IF NEW."ownerId" IS DISTINCT FROM OLD."ownerId" AND NEW."owner_id" IS NOT DISTINCT FROM OLD."owner_id" THEN
      NEW."owner_id" := NEW."ownerId";
    ELSIF NEW."owner_id" IS DISTINCT FROM OLD."owner_id" AND NEW."ownerId" IS NOT DISTINCT FROM OLD."ownerId" THEN
      NEW."ownerId" := NEW."owner_id";
    ELSIF NEW."owner_id" IS NULL AND NEW."ownerId" IS NOT NULL THEN
      NEW."owner_id" := NEW."ownerId";
    ELSIF NEW."ownerId" IS NULL AND NEW."owner_id" IS NOT NULL THEN
      NEW."ownerId" := NEW."owner_id";
    END IF;
    IF NEW."primaryMuscle" IS DISTINCT FROM OLD."primaryMuscle" AND NEW."primary_muscle" IS NOT DISTINCT FROM OLD."primary_muscle" THEN
      NEW."primary_muscle" := NEW."primaryMuscle";
    ELSIF NEW."primary_muscle" IS DISTINCT FROM OLD."primary_muscle" AND NEW."primaryMuscle" IS NOT DISTINCT FROM OLD."primaryMuscle" THEN
      NEW."primaryMuscle" := NEW."primary_muscle";
    ELSIF NEW."primary_muscle" IS NULL AND NEW."primaryMuscle" IS NOT NULL THEN
      NEW."primary_muscle" := NEW."primaryMuscle";
    ELSIF NEW."primaryMuscle" IS NULL AND NEW."primary_muscle" IS NOT NULL THEN
      NEW."primaryMuscle" := NEW."primary_muscle";
    END IF;
    IF NEW."secondaryMuscles" IS DISTINCT FROM OLD."secondaryMuscles" AND NEW."secondary_muscles" IS NOT DISTINCT FROM OLD."secondary_muscles" THEN
      NEW."secondary_muscles" := NEW."secondaryMuscles";
    ELSIF NEW."secondary_muscles" IS DISTINCT FROM OLD."secondary_muscles" AND NEW."secondaryMuscles" IS NOT DISTINCT FROM OLD."secondaryMuscles" THEN
      NEW."secondaryMuscles" := NEW."secondary_muscles";
    ELSIF NEW."secondary_muscles" IS NULL AND NEW."secondaryMuscles" IS NOT NULL THEN
      NEW."secondary_muscles" := NEW."secondaryMuscles";
    ELSIF NEW."secondaryMuscles" IS NULL AND NEW."secondary_muscles" IS NOT NULL THEN
      NEW."secondaryMuscles" := NEW."secondary_muscles";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_exercises_camel_snake ON public.exercises;
CREATE TRIGGER trg_zdt_sync_exercises_camel_snake
BEFORE INSERT OR UPDATE ON public.exercises
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_exercises_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_friendships_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."addressee_id" IS NULL AND NEW."addresseeId" IS NOT NULL THEN NEW."addressee_id" := NEW."addresseeId"; END IF;
    IF NEW."addresseeId" IS NULL AND NEW."addressee_id" IS NOT NULL THEN NEW."addresseeId" := NEW."addressee_id"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."requested_at" IS NULL AND NEW."requestedAt" IS NOT NULL THEN NEW."requested_at" := NEW."requestedAt"; END IF;
    IF NEW."requestedAt" IS NULL AND NEW."requested_at" IS NOT NULL THEN NEW."requestedAt" := NEW."requested_at"; END IF;
    IF NEW."requester_id" IS NULL AND NEW."requesterId" IS NOT NULL THEN NEW."requester_id" := NEW."requesterId"; END IF;
    IF NEW."requesterId" IS NULL AND NEW."requester_id" IS NOT NULL THEN NEW."requesterId" := NEW."requester_id"; END IF;
    IF NEW."responded_at" IS NULL AND NEW."respondedAt" IS NOT NULL THEN NEW."responded_at" := NEW."respondedAt"; END IF;
    IF NEW."respondedAt" IS NULL AND NEW."responded_at" IS NOT NULL THEN NEW."respondedAt" := NEW."responded_at"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
  ELSE
    IF NEW."addresseeId" IS DISTINCT FROM OLD."addresseeId" AND NEW."addressee_id" IS NOT DISTINCT FROM OLD."addressee_id" THEN
      NEW."addressee_id" := NEW."addresseeId";
    ELSIF NEW."addressee_id" IS DISTINCT FROM OLD."addressee_id" AND NEW."addresseeId" IS NOT DISTINCT FROM OLD."addresseeId" THEN
      NEW."addresseeId" := NEW."addressee_id";
    ELSIF NEW."addressee_id" IS NULL AND NEW."addresseeId" IS NOT NULL THEN
      NEW."addressee_id" := NEW."addresseeId";
    ELSIF NEW."addresseeId" IS NULL AND NEW."addressee_id" IS NOT NULL THEN
      NEW."addresseeId" := NEW."addressee_id";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."requestedAt" IS DISTINCT FROM OLD."requestedAt" AND NEW."requested_at" IS NOT DISTINCT FROM OLD."requested_at" THEN
      NEW."requested_at" := NEW."requestedAt";
    ELSIF NEW."requested_at" IS DISTINCT FROM OLD."requested_at" AND NEW."requestedAt" IS NOT DISTINCT FROM OLD."requestedAt" THEN
      NEW."requestedAt" := NEW."requested_at";
    ELSIF NEW."requested_at" IS NULL AND NEW."requestedAt" IS NOT NULL THEN
      NEW."requested_at" := NEW."requestedAt";
    ELSIF NEW."requestedAt" IS NULL AND NEW."requested_at" IS NOT NULL THEN
      NEW."requestedAt" := NEW."requested_at";
    END IF;
    IF NEW."requesterId" IS DISTINCT FROM OLD."requesterId" AND NEW."requester_id" IS NOT DISTINCT FROM OLD."requester_id" THEN
      NEW."requester_id" := NEW."requesterId";
    ELSIF NEW."requester_id" IS DISTINCT FROM OLD."requester_id" AND NEW."requesterId" IS NOT DISTINCT FROM OLD."requesterId" THEN
      NEW."requesterId" := NEW."requester_id";
    ELSIF NEW."requester_id" IS NULL AND NEW."requesterId" IS NOT NULL THEN
      NEW."requester_id" := NEW."requesterId";
    ELSIF NEW."requesterId" IS NULL AND NEW."requester_id" IS NOT NULL THEN
      NEW."requesterId" := NEW."requester_id";
    END IF;
    IF NEW."respondedAt" IS DISTINCT FROM OLD."respondedAt" AND NEW."responded_at" IS NOT DISTINCT FROM OLD."responded_at" THEN
      NEW."responded_at" := NEW."respondedAt";
    ELSIF NEW."responded_at" IS DISTINCT FROM OLD."responded_at" AND NEW."respondedAt" IS NOT DISTINCT FROM OLD."respondedAt" THEN
      NEW."respondedAt" := NEW."responded_at";
    ELSIF NEW."responded_at" IS NULL AND NEW."respondedAt" IS NOT NULL THEN
      NEW."responded_at" := NEW."respondedAt";
    ELSIF NEW."respondedAt" IS NULL AND NEW."responded_at" IS NOT NULL THEN
      NEW."respondedAt" := NEW."responded_at";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_friendships_camel_snake ON public.friendships;
CREATE TRIGGER trg_zdt_sync_friendships_camel_snake
BEFORE INSERT OR UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_friendships_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_rest_timer_events_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."actual_rest_sec" IS NULL AND NEW."actualRestSec" IS NOT NULL THEN NEW."actual_rest_sec" := NEW."actualRestSec"; END IF;
    IF NEW."actualRestSec" IS NULL AND NEW."actual_rest_sec" IS NOT NULL THEN NEW."actualRestSec" := NEW."actual_rest_sec"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."event_type" IS NULL AND NEW."eventType" IS NOT NULL THEN NEW."event_type" := NEW."eventType"; END IF;
    IF NEW."eventType" IS NULL AND NEW."event_type" IS NOT NULL THEN NEW."eventType" := NEW."event_type"; END IF;
    IF NEW."planned_rest_sec" IS NULL AND NEW."plannedRestSec" IS NOT NULL THEN NEW."planned_rest_sec" := NEW."plannedRestSec"; END IF;
    IF NEW."plannedRestSec" IS NULL AND NEW."planned_rest_sec" IS NOT NULL THEN NEW."plannedRestSec" := NEW."planned_rest_sec"; END IF;
    IF NEW."session_exercise_id" IS NULL AND NEW."sessionExerciseId" IS NOT NULL THEN NEW."session_exercise_id" := NEW."sessionExerciseId"; END IF;
    IF NEW."sessionExerciseId" IS NULL AND NEW."session_exercise_id" IS NOT NULL THEN NEW."sessionExerciseId" := NEW."session_exercise_id"; END IF;
    IF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN NEW."session_id" := NEW."sessionId"; END IF;
    IF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN NEW."sessionId" := NEW."session_id"; END IF;
    IF NEW."triggered_at" IS NULL AND NEW."triggeredAt" IS NOT NULL THEN NEW."triggered_at" := NEW."triggeredAt"; END IF;
    IF NEW."triggeredAt" IS NULL AND NEW."triggered_at" IS NOT NULL THEN NEW."triggeredAt" := NEW."triggered_at"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."workout_set_id" IS NULL AND NEW."workoutSetId" IS NOT NULL THEN NEW."workout_set_id" := NEW."workoutSetId"; END IF;
    IF NEW."workoutSetId" IS NULL AND NEW."workout_set_id" IS NOT NULL THEN NEW."workoutSetId" := NEW."workout_set_id"; END IF;
  ELSE
    IF NEW."actualRestSec" IS DISTINCT FROM OLD."actualRestSec" AND NEW."actual_rest_sec" IS NOT DISTINCT FROM OLD."actual_rest_sec" THEN
      NEW."actual_rest_sec" := NEW."actualRestSec";
    ELSIF NEW."actual_rest_sec" IS DISTINCT FROM OLD."actual_rest_sec" AND NEW."actualRestSec" IS NOT DISTINCT FROM OLD."actualRestSec" THEN
      NEW."actualRestSec" := NEW."actual_rest_sec";
    ELSIF NEW."actual_rest_sec" IS NULL AND NEW."actualRestSec" IS NOT NULL THEN
      NEW."actual_rest_sec" := NEW."actualRestSec";
    ELSIF NEW."actualRestSec" IS NULL AND NEW."actual_rest_sec" IS NOT NULL THEN
      NEW."actualRestSec" := NEW."actual_rest_sec";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."eventType" IS DISTINCT FROM OLD."eventType" AND NEW."event_type" IS NOT DISTINCT FROM OLD."event_type" THEN
      NEW."event_type" := NEW."eventType";
    ELSIF NEW."event_type" IS DISTINCT FROM OLD."event_type" AND NEW."eventType" IS NOT DISTINCT FROM OLD."eventType" THEN
      NEW."eventType" := NEW."event_type";
    ELSIF NEW."event_type" IS NULL AND NEW."eventType" IS NOT NULL THEN
      NEW."event_type" := NEW."eventType";
    ELSIF NEW."eventType" IS NULL AND NEW."event_type" IS NOT NULL THEN
      NEW."eventType" := NEW."event_type";
    END IF;
    IF NEW."plannedRestSec" IS DISTINCT FROM OLD."plannedRestSec" AND NEW."planned_rest_sec" IS NOT DISTINCT FROM OLD."planned_rest_sec" THEN
      NEW."planned_rest_sec" := NEW."plannedRestSec";
    ELSIF NEW."planned_rest_sec" IS DISTINCT FROM OLD."planned_rest_sec" AND NEW."plannedRestSec" IS NOT DISTINCT FROM OLD."plannedRestSec" THEN
      NEW."plannedRestSec" := NEW."planned_rest_sec";
    ELSIF NEW."planned_rest_sec" IS NULL AND NEW."plannedRestSec" IS NOT NULL THEN
      NEW."planned_rest_sec" := NEW."plannedRestSec";
    ELSIF NEW."plannedRestSec" IS NULL AND NEW."planned_rest_sec" IS NOT NULL THEN
      NEW."plannedRestSec" := NEW."planned_rest_sec";
    END IF;
    IF NEW."sessionExerciseId" IS DISTINCT FROM OLD."sessionExerciseId" AND NEW."session_exercise_id" IS NOT DISTINCT FROM OLD."session_exercise_id" THEN
      NEW."session_exercise_id" := NEW."sessionExerciseId";
    ELSIF NEW."session_exercise_id" IS DISTINCT FROM OLD."session_exercise_id" AND NEW."sessionExerciseId" IS NOT DISTINCT FROM OLD."sessionExerciseId" THEN
      NEW."sessionExerciseId" := NEW."session_exercise_id";
    ELSIF NEW."session_exercise_id" IS NULL AND NEW."sessionExerciseId" IS NOT NULL THEN
      NEW."session_exercise_id" := NEW."sessionExerciseId";
    ELSIF NEW."sessionExerciseId" IS NULL AND NEW."session_exercise_id" IS NOT NULL THEN
      NEW."sessionExerciseId" := NEW."session_exercise_id";
    END IF;
    IF NEW."sessionId" IS DISTINCT FROM OLD."sessionId" AND NEW."session_id" IS NOT DISTINCT FROM OLD."session_id" THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."session_id" IS DISTINCT FROM OLD."session_id" AND NEW."sessionId" IS NOT DISTINCT FROM OLD."sessionId" THEN
      NEW."sessionId" := NEW."session_id";
    ELSIF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN
      NEW."sessionId" := NEW."session_id";
    END IF;
    IF NEW."triggeredAt" IS DISTINCT FROM OLD."triggeredAt" AND NEW."triggered_at" IS NOT DISTINCT FROM OLD."triggered_at" THEN
      NEW."triggered_at" := NEW."triggeredAt";
    ELSIF NEW."triggered_at" IS DISTINCT FROM OLD."triggered_at" AND NEW."triggeredAt" IS NOT DISTINCT FROM OLD."triggeredAt" THEN
      NEW."triggeredAt" := NEW."triggered_at";
    ELSIF NEW."triggered_at" IS NULL AND NEW."triggeredAt" IS NOT NULL THEN
      NEW."triggered_at" := NEW."triggeredAt";
    ELSIF NEW."triggeredAt" IS NULL AND NEW."triggered_at" IS NOT NULL THEN
      NEW."triggeredAt" := NEW."triggered_at";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."workoutSetId" IS DISTINCT FROM OLD."workoutSetId" AND NEW."workout_set_id" IS NOT DISTINCT FROM OLD."workout_set_id" THEN
      NEW."workout_set_id" := NEW."workoutSetId";
    ELSIF NEW."workout_set_id" IS DISTINCT FROM OLD."workout_set_id" AND NEW."workoutSetId" IS NOT DISTINCT FROM OLD."workoutSetId" THEN
      NEW."workoutSetId" := NEW."workout_set_id";
    ELSIF NEW."workout_set_id" IS NULL AND NEW."workoutSetId" IS NOT NULL THEN
      NEW."workout_set_id" := NEW."workoutSetId";
    ELSIF NEW."workoutSetId" IS NULL AND NEW."workout_set_id" IS NOT NULL THEN
      NEW."workoutSetId" := NEW."workout_set_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_rest_timer_events_camel_snake ON public.rest_timer_events;
CREATE TRIGGER trg_zdt_sync_rest_timer_events_camel_snake
BEFORE INSERT OR UPDATE ON public.rest_timer_events
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_rest_timer_events_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_social_reactions_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."post_id" IS NULL AND NEW."postId" IS NOT NULL THEN NEW."post_id" := NEW."postId"; END IF;
    IF NEW."postId" IS NULL AND NEW."post_id" IS NOT NULL THEN NEW."postId" := NEW."post_id"; END IF;
    IF NEW."reaction_type" IS NULL AND NEW."reactionType" IS NOT NULL THEN NEW."reaction_type" := NEW."reactionType"; END IF;
    IF NEW."reactionType" IS NULL AND NEW."reaction_type" IS NOT NULL THEN NEW."reactionType" := NEW."reaction_type"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."postId" IS DISTINCT FROM OLD."postId" AND NEW."post_id" IS NOT DISTINCT FROM OLD."post_id" THEN
      NEW."post_id" := NEW."postId";
    ELSIF NEW."post_id" IS DISTINCT FROM OLD."post_id" AND NEW."postId" IS NOT DISTINCT FROM OLD."postId" THEN
      NEW."postId" := NEW."post_id";
    ELSIF NEW."post_id" IS NULL AND NEW."postId" IS NOT NULL THEN
      NEW."post_id" := NEW."postId";
    ELSIF NEW."postId" IS NULL AND NEW."post_id" IS NOT NULL THEN
      NEW."postId" := NEW."post_id";
    END IF;
    IF NEW."reactionType" IS DISTINCT FROM OLD."reactionType" AND NEW."reaction_type" IS NOT DISTINCT FROM OLD."reaction_type" THEN
      NEW."reaction_type" := NEW."reactionType";
    ELSIF NEW."reaction_type" IS DISTINCT FROM OLD."reaction_type" AND NEW."reactionType" IS NOT DISTINCT FROM OLD."reactionType" THEN
      NEW."reactionType" := NEW."reaction_type";
    ELSIF NEW."reaction_type" IS NULL AND NEW."reactionType" IS NOT NULL THEN
      NEW."reaction_type" := NEW."reactionType";
    ELSIF NEW."reactionType" IS NULL AND NEW."reaction_type" IS NOT NULL THEN
      NEW."reactionType" := NEW."reaction_type";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_social_reactions_camel_snake ON public.social_reactions;
CREATE TRIGGER trg_zdt_sync_social_reactions_camel_snake
BEFORE INSERT OR UPDATE ON public.social_reactions
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_social_reactions_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_social_workout_posts_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."is_deleted" IS NULL AND NEW."isDeleted" IS NOT NULL THEN NEW."is_deleted" := NEW."isDeleted"; END IF;
    IF NEW."isDeleted" IS NULL AND NEW."is_deleted" IS NOT NULL THEN NEW."isDeleted" := NEW."is_deleted"; END IF;
    IF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN NEW."session_id" := NEW."sessionId"; END IF;
    IF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN NEW."sessionId" := NEW."session_id"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."isDeleted" IS DISTINCT FROM OLD."isDeleted" AND NEW."is_deleted" IS NOT DISTINCT FROM OLD."is_deleted" THEN
      NEW."is_deleted" := NEW."isDeleted";
    ELSIF NEW."is_deleted" IS DISTINCT FROM OLD."is_deleted" AND NEW."isDeleted" IS NOT DISTINCT FROM OLD."isDeleted" THEN
      NEW."isDeleted" := NEW."is_deleted";
    ELSIF NEW."is_deleted" IS NULL AND NEW."isDeleted" IS NOT NULL THEN
      NEW."is_deleted" := NEW."isDeleted";
    ELSIF NEW."isDeleted" IS NULL AND NEW."is_deleted" IS NOT NULL THEN
      NEW."isDeleted" := NEW."is_deleted";
    END IF;
    IF NEW."sessionId" IS DISTINCT FROM OLD."sessionId" AND NEW."session_id" IS NOT DISTINCT FROM OLD."session_id" THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."session_id" IS DISTINCT FROM OLD."session_id" AND NEW."sessionId" IS NOT DISTINCT FROM OLD."sessionId" THEN
      NEW."sessionId" := NEW."session_id";
    ELSIF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN
      NEW."sessionId" := NEW."session_id";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_social_workout_posts_camel_snake ON public.social_workout_posts;
CREATE TRIGGER trg_zdt_sync_social_workout_posts_camel_snake
BEFORE INSERT OR UPDATE ON public.social_workout_posts
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_social_workout_posts_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_sync_events_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."client_event_id" IS NULL AND NEW."clientEventId" IS NOT NULL THEN NEW."client_event_id" := NEW."clientEventId"; END IF;
    IF NEW."clientEventId" IS NULL AND NEW."client_event_id" IS NOT NULL THEN NEW."clientEventId" := NEW."client_event_id"; END IF;
    IF NEW."conflict_data" IS NULL AND NEW."conflictData" IS NOT NULL THEN NEW."conflict_data" := NEW."conflictData"; END IF;
    IF NEW."conflictData" IS NULL AND NEW."conflict_data" IS NOT NULL THEN NEW."conflictData" := NEW."conflict_data"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."device_id" IS NULL AND NEW."deviceId" IS NOT NULL THEN NEW."device_id" := NEW."deviceId"; END IF;
    IF NEW."deviceId" IS NULL AND NEW."device_id" IS NOT NULL THEN NEW."deviceId" := NEW."device_id"; END IF;
    IF NEW."entity_id" IS NULL AND NEW."entityId" IS NOT NULL THEN NEW."entity_id" := NEW."entityId"; END IF;
    IF NEW."entityId" IS NULL AND NEW."entity_id" IS NOT NULL THEN NEW."entityId" := NEW."entity_id"; END IF;
    IF NEW."entity_type" IS NULL AND NEW."entityType" IS NOT NULL THEN NEW."entity_type" := NEW."entityType"; END IF;
    IF NEW."entityType" IS NULL AND NEW."entity_type" IS NOT NULL THEN NEW."entityType" := NEW."entity_type"; END IF;
    IF NEW."event_status" IS NULL AND NEW."eventStatus" IS NOT NULL THEN NEW."event_status" := NEW."eventStatus"; END IF;
    IF NEW."eventStatus" IS NULL AND NEW."event_status" IS NOT NULL THEN NEW."eventStatus" := NEW."event_status"; END IF;
    IF NEW."occurred_at" IS NULL AND NEW."occurredAt" IS NOT NULL THEN NEW."occurred_at" := NEW."occurredAt"; END IF;
    IF NEW."occurredAt" IS NULL AND NEW."occurred_at" IS NOT NULL THEN NEW."occurredAt" := NEW."occurred_at"; END IF;
    IF NEW."processed_at" IS NULL AND NEW."processedAt" IS NOT NULL THEN NEW."processed_at" := NEW."processedAt"; END IF;
    IF NEW."processedAt" IS NULL AND NEW."processed_at" IS NOT NULL THEN NEW."processedAt" := NEW."processed_at"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."clientEventId" IS DISTINCT FROM OLD."clientEventId" AND NEW."client_event_id" IS NOT DISTINCT FROM OLD."client_event_id" THEN
      NEW."client_event_id" := NEW."clientEventId";
    ELSIF NEW."client_event_id" IS DISTINCT FROM OLD."client_event_id" AND NEW."clientEventId" IS NOT DISTINCT FROM OLD."clientEventId" THEN
      NEW."clientEventId" := NEW."client_event_id";
    ELSIF NEW."client_event_id" IS NULL AND NEW."clientEventId" IS NOT NULL THEN
      NEW."client_event_id" := NEW."clientEventId";
    ELSIF NEW."clientEventId" IS NULL AND NEW."client_event_id" IS NOT NULL THEN
      NEW."clientEventId" := NEW."client_event_id";
    END IF;
    IF NEW."conflictData" IS DISTINCT FROM OLD."conflictData" AND NEW."conflict_data" IS NOT DISTINCT FROM OLD."conflict_data" THEN
      NEW."conflict_data" := NEW."conflictData";
    ELSIF NEW."conflict_data" IS DISTINCT FROM OLD."conflict_data" AND NEW."conflictData" IS NOT DISTINCT FROM OLD."conflictData" THEN
      NEW."conflictData" := NEW."conflict_data";
    ELSIF NEW."conflict_data" IS NULL AND NEW."conflictData" IS NOT NULL THEN
      NEW."conflict_data" := NEW."conflictData";
    ELSIF NEW."conflictData" IS NULL AND NEW."conflict_data" IS NOT NULL THEN
      NEW."conflictData" := NEW."conflict_data";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."deviceId" IS DISTINCT FROM OLD."deviceId" AND NEW."device_id" IS NOT DISTINCT FROM OLD."device_id" THEN
      NEW."device_id" := NEW."deviceId";
    ELSIF NEW."device_id" IS DISTINCT FROM OLD."device_id" AND NEW."deviceId" IS NOT DISTINCT FROM OLD."deviceId" THEN
      NEW."deviceId" := NEW."device_id";
    ELSIF NEW."device_id" IS NULL AND NEW."deviceId" IS NOT NULL THEN
      NEW."device_id" := NEW."deviceId";
    ELSIF NEW."deviceId" IS NULL AND NEW."device_id" IS NOT NULL THEN
      NEW."deviceId" := NEW."device_id";
    END IF;
    IF NEW."entityId" IS DISTINCT FROM OLD."entityId" AND NEW."entity_id" IS NOT DISTINCT FROM OLD."entity_id" THEN
      NEW."entity_id" := NEW."entityId";
    ELSIF NEW."entity_id" IS DISTINCT FROM OLD."entity_id" AND NEW."entityId" IS NOT DISTINCT FROM OLD."entityId" THEN
      NEW."entityId" := NEW."entity_id";
    ELSIF NEW."entity_id" IS NULL AND NEW."entityId" IS NOT NULL THEN
      NEW."entity_id" := NEW."entityId";
    ELSIF NEW."entityId" IS NULL AND NEW."entity_id" IS NOT NULL THEN
      NEW."entityId" := NEW."entity_id";
    END IF;
    IF NEW."entityType" IS DISTINCT FROM OLD."entityType" AND NEW."entity_type" IS NOT DISTINCT FROM OLD."entity_type" THEN
      NEW."entity_type" := NEW."entityType";
    ELSIF NEW."entity_type" IS DISTINCT FROM OLD."entity_type" AND NEW."entityType" IS NOT DISTINCT FROM OLD."entityType" THEN
      NEW."entityType" := NEW."entity_type";
    ELSIF NEW."entity_type" IS NULL AND NEW."entityType" IS NOT NULL THEN
      NEW."entity_type" := NEW."entityType";
    ELSIF NEW."entityType" IS NULL AND NEW."entity_type" IS NOT NULL THEN
      NEW."entityType" := NEW."entity_type";
    END IF;
    IF NEW."eventStatus" IS DISTINCT FROM OLD."eventStatus" AND NEW."event_status" IS NOT DISTINCT FROM OLD."event_status" THEN
      NEW."event_status" := NEW."eventStatus";
    ELSIF NEW."event_status" IS DISTINCT FROM OLD."event_status" AND NEW."eventStatus" IS NOT DISTINCT FROM OLD."eventStatus" THEN
      NEW."eventStatus" := NEW."event_status";
    ELSIF NEW."event_status" IS NULL AND NEW."eventStatus" IS NOT NULL THEN
      NEW."event_status" := NEW."eventStatus";
    ELSIF NEW."eventStatus" IS NULL AND NEW."event_status" IS NOT NULL THEN
      NEW."eventStatus" := NEW."event_status";
    END IF;
    IF NEW."occurredAt" IS DISTINCT FROM OLD."occurredAt" AND NEW."occurred_at" IS NOT DISTINCT FROM OLD."occurred_at" THEN
      NEW."occurred_at" := NEW."occurredAt";
    ELSIF NEW."occurred_at" IS DISTINCT FROM OLD."occurred_at" AND NEW."occurredAt" IS NOT DISTINCT FROM OLD."occurredAt" THEN
      NEW."occurredAt" := NEW."occurred_at";
    ELSIF NEW."occurred_at" IS NULL AND NEW."occurredAt" IS NOT NULL THEN
      NEW."occurred_at" := NEW."occurredAt";
    ELSIF NEW."occurredAt" IS NULL AND NEW."occurred_at" IS NOT NULL THEN
      NEW."occurredAt" := NEW."occurred_at";
    END IF;
    IF NEW."processedAt" IS DISTINCT FROM OLD."processedAt" AND NEW."processed_at" IS NOT DISTINCT FROM OLD."processed_at" THEN
      NEW."processed_at" := NEW."processedAt";
    ELSIF NEW."processed_at" IS DISTINCT FROM OLD."processed_at" AND NEW."processedAt" IS NOT DISTINCT FROM OLD."processedAt" THEN
      NEW."processedAt" := NEW."processed_at";
    ELSIF NEW."processed_at" IS NULL AND NEW."processedAt" IS NOT NULL THEN
      NEW."processed_at" := NEW."processedAt";
    ELSIF NEW."processedAt" IS NULL AND NEW."processed_at" IS NOT NULL THEN
      NEW."processedAt" := NEW."processed_at";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_sync_events_camel_snake ON public.sync_events;
CREATE TRIGGER trg_zdt_sync_sync_events_camel_snake
BEFORE INSERT OR UPDATE ON public.sync_events
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_sync_events_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_training_program_weeks_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."program_id" IS NULL AND NEW."programId" IS NOT NULL THEN NEW."program_id" := NEW."programId"; END IF;
    IF NEW."programId" IS NULL AND NEW."program_id" IS NOT NULL THEN NEW."programId" := NEW."program_id"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."week_number" IS NULL AND NEW."weekNumber" IS NOT NULL THEN NEW."week_number" := NEW."weekNumber"; END IF;
    IF NEW."weekNumber" IS NULL AND NEW."week_number" IS NOT NULL THEN NEW."weekNumber" := NEW."week_number"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."programId" IS DISTINCT FROM OLD."programId" AND NEW."program_id" IS NOT DISTINCT FROM OLD."program_id" THEN
      NEW."program_id" := NEW."programId";
    ELSIF NEW."program_id" IS DISTINCT FROM OLD."program_id" AND NEW."programId" IS NOT DISTINCT FROM OLD."programId" THEN
      NEW."programId" := NEW."program_id";
    ELSIF NEW."program_id" IS NULL AND NEW."programId" IS NOT NULL THEN
      NEW."program_id" := NEW."programId";
    ELSIF NEW."programId" IS NULL AND NEW."program_id" IS NOT NULL THEN
      NEW."programId" := NEW."program_id";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."weekNumber" IS DISTINCT FROM OLD."weekNumber" AND NEW."week_number" IS NOT DISTINCT FROM OLD."week_number" THEN
      NEW."week_number" := NEW."weekNumber";
    ELSIF NEW."week_number" IS DISTINCT FROM OLD."week_number" AND NEW."weekNumber" IS NOT DISTINCT FROM OLD."weekNumber" THEN
      NEW."weekNumber" := NEW."week_number";
    ELSIF NEW."week_number" IS NULL AND NEW."weekNumber" IS NOT NULL THEN
      NEW."week_number" := NEW."weekNumber";
    ELSIF NEW."weekNumber" IS NULL AND NEW."week_number" IS NOT NULL THEN
      NEW."weekNumber" := NEW."week_number";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_training_program_weeks_camel_snake ON public.training_program_weeks;
CREATE TRIGGER trg_zdt_sync_training_program_weeks_camel_snake
BEFORE INSERT OR UPDATE ON public.training_program_weeks
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_training_program_weeks_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_training_program_workouts_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."day_of_week" IS NULL AND NEW."dayOfWeek" IS NOT NULL THEN NEW."day_of_week" := NEW."dayOfWeek"; END IF;
    IF NEW."dayOfWeek" IS NULL AND NEW."day_of_week" IS NOT NULL THEN NEW."dayOfWeek" := NEW."day_of_week"; END IF;
    IF NEW."order_index" IS NULL AND NEW."orderIndex" IS NOT NULL THEN NEW."order_index" := NEW."orderIndex"; END IF;
    IF NEW."orderIndex" IS NULL AND NEW."order_index" IS NOT NULL THEN NEW."orderIndex" := NEW."order_index"; END IF;
    IF NEW."template_id" IS NULL AND NEW."templateId" IS NOT NULL THEN NEW."template_id" := NEW."templateId"; END IF;
    IF NEW."templateId" IS NULL AND NEW."template_id" IS NOT NULL THEN NEW."templateId" := NEW."template_id"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."week_id" IS NULL AND NEW."weekId" IS NOT NULL THEN NEW."week_id" := NEW."weekId"; END IF;
    IF NEW."weekId" IS NULL AND NEW."week_id" IS NOT NULL THEN NEW."weekId" := NEW."week_id"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."dayOfWeek" IS DISTINCT FROM OLD."dayOfWeek" AND NEW."day_of_week" IS NOT DISTINCT FROM OLD."day_of_week" THEN
      NEW."day_of_week" := NEW."dayOfWeek";
    ELSIF NEW."day_of_week" IS DISTINCT FROM OLD."day_of_week" AND NEW."dayOfWeek" IS NOT DISTINCT FROM OLD."dayOfWeek" THEN
      NEW."dayOfWeek" := NEW."day_of_week";
    ELSIF NEW."day_of_week" IS NULL AND NEW."dayOfWeek" IS NOT NULL THEN
      NEW."day_of_week" := NEW."dayOfWeek";
    ELSIF NEW."dayOfWeek" IS NULL AND NEW."day_of_week" IS NOT NULL THEN
      NEW."dayOfWeek" := NEW."day_of_week";
    END IF;
    IF NEW."orderIndex" IS DISTINCT FROM OLD."orderIndex" AND NEW."order_index" IS NOT DISTINCT FROM OLD."order_index" THEN
      NEW."order_index" := NEW."orderIndex";
    ELSIF NEW."order_index" IS DISTINCT FROM OLD."order_index" AND NEW."orderIndex" IS NOT DISTINCT FROM OLD."orderIndex" THEN
      NEW."orderIndex" := NEW."order_index";
    ELSIF NEW."order_index" IS NULL AND NEW."orderIndex" IS NOT NULL THEN
      NEW."order_index" := NEW."orderIndex";
    ELSIF NEW."orderIndex" IS NULL AND NEW."order_index" IS NOT NULL THEN
      NEW."orderIndex" := NEW."order_index";
    END IF;
    IF NEW."templateId" IS DISTINCT FROM OLD."templateId" AND NEW."template_id" IS NOT DISTINCT FROM OLD."template_id" THEN
      NEW."template_id" := NEW."templateId";
    ELSIF NEW."template_id" IS DISTINCT FROM OLD."template_id" AND NEW."templateId" IS NOT DISTINCT FROM OLD."templateId" THEN
      NEW."templateId" := NEW."template_id";
    ELSIF NEW."template_id" IS NULL AND NEW."templateId" IS NOT NULL THEN
      NEW."template_id" := NEW."templateId";
    ELSIF NEW."templateId" IS NULL AND NEW."template_id" IS NOT NULL THEN
      NEW."templateId" := NEW."template_id";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."weekId" IS DISTINCT FROM OLD."weekId" AND NEW."week_id" IS NOT DISTINCT FROM OLD."week_id" THEN
      NEW."week_id" := NEW."weekId";
    ELSIF NEW."week_id" IS DISTINCT FROM OLD."week_id" AND NEW."weekId" IS NOT DISTINCT FROM OLD."weekId" THEN
      NEW."weekId" := NEW."week_id";
    ELSIF NEW."week_id" IS NULL AND NEW."weekId" IS NOT NULL THEN
      NEW."week_id" := NEW."weekId";
    ELSIF NEW."weekId" IS NULL AND NEW."week_id" IS NOT NULL THEN
      NEW."weekId" := NEW."week_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_training_program_workouts_camel_snake ON public.training_program_workouts;
CREATE TRIGGER trg_zdt_sync_training_program_workouts_camel_snake
BEFORE INSERT OR UPDATE ON public.training_program_workouts
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_training_program_workouts_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_training_programs_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."author_id" IS NULL AND NEW."authorId" IS NOT NULL THEN NEW."author_id" := NEW."authorId"; END IF;
    IF NEW."authorId" IS NULL AND NEW."author_id" IS NOT NULL THEN NEW."authorId" := NEW."author_id"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."currency_code" IS NULL AND NEW."currencyCode" IS NOT NULL THEN NEW."currency_code" := NEW."currencyCode"; END IF;
    IF NEW."currencyCode" IS NULL AND NEW."currency_code" IS NOT NULL THEN NEW."currencyCode" := NEW."currency_code"; END IF;
    IF NEW."is_archived" IS NULL AND NEW."isArchived" IS NOT NULL THEN NEW."is_archived" := NEW."isArchived"; END IF;
    IF NEW."isArchived" IS NULL AND NEW."is_archived" IS NOT NULL THEN NEW."isArchived" := NEW."is_archived"; END IF;
    IF NEW."is_marketplace_listed" IS NULL AND NEW."isMarketplaceListed" IS NOT NULL THEN NEW."is_marketplace_listed" := NEW."isMarketplaceListed"; END IF;
    IF NEW."isMarketplaceListed" IS NULL AND NEW."is_marketplace_listed" IS NOT NULL THEN NEW."isMarketplaceListed" := NEW."is_marketplace_listed"; END IF;
    IF NEW."is_public" IS NULL AND NEW."isPublic" IS NOT NULL THEN NEW."is_public" := NEW."isPublic"; END IF;
    IF NEW."isPublic" IS NULL AND NEW."is_public" IS NOT NULL THEN NEW."isPublic" := NEW."is_public"; END IF;
    IF NEW."price_cents" IS NULL AND NEW."priceCents" IS NOT NULL THEN NEW."price_cents" := NEW."priceCents"; END IF;
    IF NEW."priceCents" IS NULL AND NEW."price_cents" IS NOT NULL THEN NEW."priceCents" := NEW."price_cents"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
  ELSE
    IF NEW."authorId" IS DISTINCT FROM OLD."authorId" AND NEW."author_id" IS NOT DISTINCT FROM OLD."author_id" THEN
      NEW."author_id" := NEW."authorId";
    ELSIF NEW."author_id" IS DISTINCT FROM OLD."author_id" AND NEW."authorId" IS NOT DISTINCT FROM OLD."authorId" THEN
      NEW."authorId" := NEW."author_id";
    ELSIF NEW."author_id" IS NULL AND NEW."authorId" IS NOT NULL THEN
      NEW."author_id" := NEW."authorId";
    ELSIF NEW."authorId" IS NULL AND NEW."author_id" IS NOT NULL THEN
      NEW."authorId" := NEW."author_id";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode" AND NEW."currency_code" IS NOT DISTINCT FROM OLD."currency_code" THEN
      NEW."currency_code" := NEW."currencyCode";
    ELSIF NEW."currency_code" IS DISTINCT FROM OLD."currency_code" AND NEW."currencyCode" IS NOT DISTINCT FROM OLD."currencyCode" THEN
      NEW."currencyCode" := NEW."currency_code";
    ELSIF NEW."currency_code" IS NULL AND NEW."currencyCode" IS NOT NULL THEN
      NEW."currency_code" := NEW."currencyCode";
    ELSIF NEW."currencyCode" IS NULL AND NEW."currency_code" IS NOT NULL THEN
      NEW."currencyCode" := NEW."currency_code";
    END IF;
    IF NEW."isArchived" IS DISTINCT FROM OLD."isArchived" AND NEW."is_archived" IS NOT DISTINCT FROM OLD."is_archived" THEN
      NEW."is_archived" := NEW."isArchived";
    ELSIF NEW."is_archived" IS DISTINCT FROM OLD."is_archived" AND NEW."isArchived" IS NOT DISTINCT FROM OLD."isArchived" THEN
      NEW."isArchived" := NEW."is_archived";
    ELSIF NEW."is_archived" IS NULL AND NEW."isArchived" IS NOT NULL THEN
      NEW."is_archived" := NEW."isArchived";
    ELSIF NEW."isArchived" IS NULL AND NEW."is_archived" IS NOT NULL THEN
      NEW."isArchived" := NEW."is_archived";
    END IF;
    IF NEW."isMarketplaceListed" IS DISTINCT FROM OLD."isMarketplaceListed" AND NEW."is_marketplace_listed" IS NOT DISTINCT FROM OLD."is_marketplace_listed" THEN
      NEW."is_marketplace_listed" := NEW."isMarketplaceListed";
    ELSIF NEW."is_marketplace_listed" IS DISTINCT FROM OLD."is_marketplace_listed" AND NEW."isMarketplaceListed" IS NOT DISTINCT FROM OLD."isMarketplaceListed" THEN
      NEW."isMarketplaceListed" := NEW."is_marketplace_listed";
    ELSIF NEW."is_marketplace_listed" IS NULL AND NEW."isMarketplaceListed" IS NOT NULL THEN
      NEW."is_marketplace_listed" := NEW."isMarketplaceListed";
    ELSIF NEW."isMarketplaceListed" IS NULL AND NEW."is_marketplace_listed" IS NOT NULL THEN
      NEW."isMarketplaceListed" := NEW."is_marketplace_listed";
    END IF;
    IF NEW."isPublic" IS DISTINCT FROM OLD."isPublic" AND NEW."is_public" IS NOT DISTINCT FROM OLD."is_public" THEN
      NEW."is_public" := NEW."isPublic";
    ELSIF NEW."is_public" IS DISTINCT FROM OLD."is_public" AND NEW."isPublic" IS NOT DISTINCT FROM OLD."isPublic" THEN
      NEW."isPublic" := NEW."is_public";
    ELSIF NEW."is_public" IS NULL AND NEW."isPublic" IS NOT NULL THEN
      NEW."is_public" := NEW."isPublic";
    ELSIF NEW."isPublic" IS NULL AND NEW."is_public" IS NOT NULL THEN
      NEW."isPublic" := NEW."is_public";
    END IF;
    IF NEW."priceCents" IS DISTINCT FROM OLD."priceCents" AND NEW."price_cents" IS NOT DISTINCT FROM OLD."price_cents" THEN
      NEW."price_cents" := NEW."priceCents";
    ELSIF NEW."price_cents" IS DISTINCT FROM OLD."price_cents" AND NEW."priceCents" IS NOT DISTINCT FROM OLD."priceCents" THEN
      NEW."priceCents" := NEW."price_cents";
    ELSIF NEW."price_cents" IS NULL AND NEW."priceCents" IS NOT NULL THEN
      NEW."price_cents" := NEW."priceCents";
    ELSIF NEW."priceCents" IS NULL AND NEW."price_cents" IS NOT NULL THEN
      NEW."priceCents" := NEW."price_cents";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_training_programs_camel_snake ON public.training_programs;
CREATE TRIGGER trg_zdt_sync_training_programs_camel_snake
BEFORE INSERT OR UPDATE ON public.training_programs
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_training_programs_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_user_achievements_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."achievement_definition_id" IS NULL AND NEW."achievementDefinitionId" IS NOT NULL THEN NEW."achievement_definition_id" := NEW."achievementDefinitionId"; END IF;
    IF NEW."achievementDefinitionId" IS NULL AND NEW."achievement_definition_id" IS NOT NULL THEN NEW."achievementDefinitionId" := NEW."achievement_definition_id"; END IF;
    IF NEW."awarded_at" IS NULL AND NEW."awardedAt" IS NOT NULL THEN NEW."awarded_at" := NEW."awardedAt"; END IF;
    IF NEW."awardedAt" IS NULL AND NEW."awarded_at" IS NOT NULL THEN NEW."awardedAt" := NEW."awarded_at"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."achievementDefinitionId" IS DISTINCT FROM OLD."achievementDefinitionId" AND NEW."achievement_definition_id" IS NOT DISTINCT FROM OLD."achievement_definition_id" THEN
      NEW."achievement_definition_id" := NEW."achievementDefinitionId";
    ELSIF NEW."achievement_definition_id" IS DISTINCT FROM OLD."achievement_definition_id" AND NEW."achievementDefinitionId" IS NOT DISTINCT FROM OLD."achievementDefinitionId" THEN
      NEW."achievementDefinitionId" := NEW."achievement_definition_id";
    ELSIF NEW."achievement_definition_id" IS NULL AND NEW."achievementDefinitionId" IS NOT NULL THEN
      NEW."achievement_definition_id" := NEW."achievementDefinitionId";
    ELSIF NEW."achievementDefinitionId" IS NULL AND NEW."achievement_definition_id" IS NOT NULL THEN
      NEW."achievementDefinitionId" := NEW."achievement_definition_id";
    END IF;
    IF NEW."awardedAt" IS DISTINCT FROM OLD."awardedAt" AND NEW."awarded_at" IS NOT DISTINCT FROM OLD."awarded_at" THEN
      NEW."awarded_at" := NEW."awardedAt";
    ELSIF NEW."awarded_at" IS DISTINCT FROM OLD."awarded_at" AND NEW."awardedAt" IS NOT DISTINCT FROM OLD."awardedAt" THEN
      NEW."awardedAt" := NEW."awarded_at";
    ELSIF NEW."awarded_at" IS NULL AND NEW."awardedAt" IS NOT NULL THEN
      NEW."awarded_at" := NEW."awardedAt";
    ELSIF NEW."awardedAt" IS NULL AND NEW."awarded_at" IS NOT NULL THEN
      NEW."awardedAt" := NEW."awarded_at";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_user_achievements_camel_snake ON public.user_achievements;
CREATE TRIGGER trg_zdt_sync_user_achievements_camel_snake
BEFORE INSERT OR UPDATE ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_user_achievements_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_user_profiles_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."birth_date" IS NULL AND NEW."birthDate" IS NOT NULL THEN NEW."birth_date" := NEW."birthDate"; END IF;
    IF NEW."birthDate" IS NULL AND NEW."birth_date" IS NOT NULL THEN NEW."birthDate" := NEW."birth_date"; END IF;
    IF NEW."body_fat_percent" IS NULL AND NEW."bodyFatPercent" IS NOT NULL THEN NEW."body_fat_percent" := NEW."bodyFatPercent"; END IF;
    IF NEW."bodyFatPercent" IS NULL AND NEW."body_fat_percent" IS NOT NULL THEN NEW."bodyFatPercent" := NEW."body_fat_percent"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."display_name" IS NULL AND NEW."displayName" IS NOT NULL THEN NEW."display_name" := NEW."displayName"; END IF;
    IF NEW."displayName" IS NULL AND NEW."display_name" IS NOT NULL THEN NEW."displayName" := NEW."display_name"; END IF;
    IF NEW."first_name" IS NULL AND NEW."firstName" IS NOT NULL THEN NEW."first_name" := NEW."firstName"; END IF;
    IF NEW."firstName" IS NULL AND NEW."first_name" IS NOT NULL THEN NEW."firstName" := NEW."first_name"; END IF;
    IF NEW."height_cm" IS NULL AND NEW."heightCm" IS NOT NULL THEN NEW."height_cm" := NEW."heightCm"; END IF;
    IF NEW."heightCm" IS NULL AND NEW."height_cm" IS NOT NULL THEN NEW."heightCm" := NEW."height_cm"; END IF;
    IF NEW."last_name" IS NULL AND NEW."lastName" IS NOT NULL THEN NEW."last_name" := NEW."lastName"; END IF;
    IF NEW."lastName" IS NULL AND NEW."last_name" IS NOT NULL THEN NEW."lastName" := NEW."last_name"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
    IF NEW."weight_kg" IS NULL AND NEW."weightKg" IS NOT NULL THEN NEW."weight_kg" := NEW."weightKg"; END IF;
    IF NEW."weightKg" IS NULL AND NEW."weight_kg" IS NOT NULL THEN NEW."weightKg" := NEW."weight_kg"; END IF;
  ELSE
    IF NEW."birthDate" IS DISTINCT FROM OLD."birthDate" AND NEW."birth_date" IS NOT DISTINCT FROM OLD."birth_date" THEN
      NEW."birth_date" := NEW."birthDate";
    ELSIF NEW."birth_date" IS DISTINCT FROM OLD."birth_date" AND NEW."birthDate" IS NOT DISTINCT FROM OLD."birthDate" THEN
      NEW."birthDate" := NEW."birth_date";
    ELSIF NEW."birth_date" IS NULL AND NEW."birthDate" IS NOT NULL THEN
      NEW."birth_date" := NEW."birthDate";
    ELSIF NEW."birthDate" IS NULL AND NEW."birth_date" IS NOT NULL THEN
      NEW."birthDate" := NEW."birth_date";
    END IF;
    IF NEW."bodyFatPercent" IS DISTINCT FROM OLD."bodyFatPercent" AND NEW."body_fat_percent" IS NOT DISTINCT FROM OLD."body_fat_percent" THEN
      NEW."body_fat_percent" := NEW."bodyFatPercent";
    ELSIF NEW."body_fat_percent" IS DISTINCT FROM OLD."body_fat_percent" AND NEW."bodyFatPercent" IS NOT DISTINCT FROM OLD."bodyFatPercent" THEN
      NEW."bodyFatPercent" := NEW."body_fat_percent";
    ELSIF NEW."body_fat_percent" IS NULL AND NEW."bodyFatPercent" IS NOT NULL THEN
      NEW."body_fat_percent" := NEW."bodyFatPercent";
    ELSIF NEW."bodyFatPercent" IS NULL AND NEW."body_fat_percent" IS NOT NULL THEN
      NEW."bodyFatPercent" := NEW."body_fat_percent";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."displayName" IS DISTINCT FROM OLD."displayName" AND NEW."display_name" IS NOT DISTINCT FROM OLD."display_name" THEN
      NEW."display_name" := NEW."displayName";
    ELSIF NEW."display_name" IS DISTINCT FROM OLD."display_name" AND NEW."displayName" IS NOT DISTINCT FROM OLD."displayName" THEN
      NEW."displayName" := NEW."display_name";
    ELSIF NEW."display_name" IS NULL AND NEW."displayName" IS NOT NULL THEN
      NEW."display_name" := NEW."displayName";
    ELSIF NEW."displayName" IS NULL AND NEW."display_name" IS NOT NULL THEN
      NEW."displayName" := NEW."display_name";
    END IF;
    IF NEW."firstName" IS DISTINCT FROM OLD."firstName" AND NEW."first_name" IS NOT DISTINCT FROM OLD."first_name" THEN
      NEW."first_name" := NEW."firstName";
    ELSIF NEW."first_name" IS DISTINCT FROM OLD."first_name" AND NEW."firstName" IS NOT DISTINCT FROM OLD."firstName" THEN
      NEW."firstName" := NEW."first_name";
    ELSIF NEW."first_name" IS NULL AND NEW."firstName" IS NOT NULL THEN
      NEW."first_name" := NEW."firstName";
    ELSIF NEW."firstName" IS NULL AND NEW."first_name" IS NOT NULL THEN
      NEW."firstName" := NEW."first_name";
    END IF;
    IF NEW."heightCm" IS DISTINCT FROM OLD."heightCm" AND NEW."height_cm" IS NOT DISTINCT FROM OLD."height_cm" THEN
      NEW."height_cm" := NEW."heightCm";
    ELSIF NEW."height_cm" IS DISTINCT FROM OLD."height_cm" AND NEW."heightCm" IS NOT DISTINCT FROM OLD."heightCm" THEN
      NEW."heightCm" := NEW."height_cm";
    ELSIF NEW."height_cm" IS NULL AND NEW."heightCm" IS NOT NULL THEN
      NEW."height_cm" := NEW."heightCm";
    ELSIF NEW."heightCm" IS NULL AND NEW."height_cm" IS NOT NULL THEN
      NEW."heightCm" := NEW."height_cm";
    END IF;
    IF NEW."lastName" IS DISTINCT FROM OLD."lastName" AND NEW."last_name" IS NOT DISTINCT FROM OLD."last_name" THEN
      NEW."last_name" := NEW."lastName";
    ELSIF NEW."last_name" IS DISTINCT FROM OLD."last_name" AND NEW."lastName" IS NOT DISTINCT FROM OLD."lastName" THEN
      NEW."lastName" := NEW."last_name";
    ELSIF NEW."last_name" IS NULL AND NEW."lastName" IS NOT NULL THEN
      NEW."last_name" := NEW."lastName";
    ELSIF NEW."lastName" IS NULL AND NEW."last_name" IS NOT NULL THEN
      NEW."lastName" := NEW."last_name";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
    IF NEW."weightKg" IS DISTINCT FROM OLD."weightKg" AND NEW."weight_kg" IS NOT DISTINCT FROM OLD."weight_kg" THEN
      NEW."weight_kg" := NEW."weightKg";
    ELSIF NEW."weight_kg" IS DISTINCT FROM OLD."weight_kg" AND NEW."weightKg" IS NOT DISTINCT FROM OLD."weightKg" THEN
      NEW."weightKg" := NEW."weight_kg";
    ELSIF NEW."weight_kg" IS NULL AND NEW."weightKg" IS NOT NULL THEN
      NEW."weight_kg" := NEW."weightKg";
    ELSIF NEW."weightKg" IS NULL AND NEW."weight_kg" IS NOT NULL THEN
      NEW."weightKg" := NEW."weight_kg";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_user_profiles_camel_snake ON public.user_profiles;
CREATE TRIGGER trg_zdt_sync_user_profiles_camel_snake
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_user_profiles_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_user_streaks_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."current_count" IS NULL AND NEW."currentCount" IS NOT NULL THEN NEW."current_count" := NEW."currentCount"; END IF;
    IF NEW."currentCount" IS NULL AND NEW."current_count" IS NOT NULL THEN NEW."currentCount" := NEW."current_count"; END IF;
    IF NEW."is_active" IS NULL AND NEW."isActive" IS NOT NULL THEN NEW."is_active" := NEW."isActive"; END IF;
    IF NEW."isActive" IS NULL AND NEW."is_active" IS NOT NULL THEN NEW."isActive" := NEW."is_active"; END IF;
    IF NEW."last_event_date" IS NULL AND NEW."lastEventDate" IS NOT NULL THEN NEW."last_event_date" := NEW."lastEventDate"; END IF;
    IF NEW."lastEventDate" IS NULL AND NEW."last_event_date" IS NOT NULL THEN NEW."lastEventDate" := NEW."last_event_date"; END IF;
    IF NEW."longest_count" IS NULL AND NEW."longestCount" IS NOT NULL THEN NEW."longest_count" := NEW."longestCount"; END IF;
    IF NEW."longestCount" IS NULL AND NEW."longest_count" IS NOT NULL THEN NEW."longestCount" := NEW."longest_count"; END IF;
    IF NEW."streak_start_date" IS NULL AND NEW."streakStartDate" IS NOT NULL THEN NEW."streak_start_date" := NEW."streakStartDate"; END IF;
    IF NEW."streakStartDate" IS NULL AND NEW."streak_start_date" IS NOT NULL THEN NEW."streakStartDate" := NEW."streak_start_date"; END IF;
    IF NEW."streak_type" IS NULL AND NEW."streakType" IS NOT NULL THEN NEW."streak_type" := NEW."streakType"; END IF;
    IF NEW."streakType" IS NULL AND NEW."streak_type" IS NOT NULL THEN NEW."streakType" := NEW."streak_type"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."currentCount" IS DISTINCT FROM OLD."currentCount" AND NEW."current_count" IS NOT DISTINCT FROM OLD."current_count" THEN
      NEW."current_count" := NEW."currentCount";
    ELSIF NEW."current_count" IS DISTINCT FROM OLD."current_count" AND NEW."currentCount" IS NOT DISTINCT FROM OLD."currentCount" THEN
      NEW."currentCount" := NEW."current_count";
    ELSIF NEW."current_count" IS NULL AND NEW."currentCount" IS NOT NULL THEN
      NEW."current_count" := NEW."currentCount";
    ELSIF NEW."currentCount" IS NULL AND NEW."current_count" IS NOT NULL THEN
      NEW."currentCount" := NEW."current_count";
    END IF;
    IF NEW."isActive" IS DISTINCT FROM OLD."isActive" AND NEW."is_active" IS NOT DISTINCT FROM OLD."is_active" THEN
      NEW."is_active" := NEW."isActive";
    ELSIF NEW."is_active" IS DISTINCT FROM OLD."is_active" AND NEW."isActive" IS NOT DISTINCT FROM OLD."isActive" THEN
      NEW."isActive" := NEW."is_active";
    ELSIF NEW."is_active" IS NULL AND NEW."isActive" IS NOT NULL THEN
      NEW."is_active" := NEW."isActive";
    ELSIF NEW."isActive" IS NULL AND NEW."is_active" IS NOT NULL THEN
      NEW."isActive" := NEW."is_active";
    END IF;
    IF NEW."lastEventDate" IS DISTINCT FROM OLD."lastEventDate" AND NEW."last_event_date" IS NOT DISTINCT FROM OLD."last_event_date" THEN
      NEW."last_event_date" := NEW."lastEventDate";
    ELSIF NEW."last_event_date" IS DISTINCT FROM OLD."last_event_date" AND NEW."lastEventDate" IS NOT DISTINCT FROM OLD."lastEventDate" THEN
      NEW."lastEventDate" := NEW."last_event_date";
    ELSIF NEW."last_event_date" IS NULL AND NEW."lastEventDate" IS NOT NULL THEN
      NEW."last_event_date" := NEW."lastEventDate";
    ELSIF NEW."lastEventDate" IS NULL AND NEW."last_event_date" IS NOT NULL THEN
      NEW."lastEventDate" := NEW."last_event_date";
    END IF;
    IF NEW."longestCount" IS DISTINCT FROM OLD."longestCount" AND NEW."longest_count" IS NOT DISTINCT FROM OLD."longest_count" THEN
      NEW."longest_count" := NEW."longestCount";
    ELSIF NEW."longest_count" IS DISTINCT FROM OLD."longest_count" AND NEW."longestCount" IS NOT DISTINCT FROM OLD."longestCount" THEN
      NEW."longestCount" := NEW."longest_count";
    ELSIF NEW."longest_count" IS NULL AND NEW."longestCount" IS NOT NULL THEN
      NEW."longest_count" := NEW."longestCount";
    ELSIF NEW."longestCount" IS NULL AND NEW."longest_count" IS NOT NULL THEN
      NEW."longestCount" := NEW."longest_count";
    END IF;
    IF NEW."streakStartDate" IS DISTINCT FROM OLD."streakStartDate" AND NEW."streak_start_date" IS NOT DISTINCT FROM OLD."streak_start_date" THEN
      NEW."streak_start_date" := NEW."streakStartDate";
    ELSIF NEW."streak_start_date" IS DISTINCT FROM OLD."streak_start_date" AND NEW."streakStartDate" IS NOT DISTINCT FROM OLD."streakStartDate" THEN
      NEW."streakStartDate" := NEW."streak_start_date";
    ELSIF NEW."streak_start_date" IS NULL AND NEW."streakStartDate" IS NOT NULL THEN
      NEW."streak_start_date" := NEW."streakStartDate";
    ELSIF NEW."streakStartDate" IS NULL AND NEW."streak_start_date" IS NOT NULL THEN
      NEW."streakStartDate" := NEW."streak_start_date";
    END IF;
    IF NEW."streakType" IS DISTINCT FROM OLD."streakType" AND NEW."streak_type" IS NOT DISTINCT FROM OLD."streak_type" THEN
      NEW."streak_type" := NEW."streakType";
    ELSIF NEW."streak_type" IS DISTINCT FROM OLD."streak_type" AND NEW."streakType" IS NOT DISTINCT FROM OLD."streakType" THEN
      NEW."streakType" := NEW."streak_type";
    ELSIF NEW."streak_type" IS NULL AND NEW."streakType" IS NOT NULL THEN
      NEW."streak_type" := NEW."streakType";
    ELSIF NEW."streakType" IS NULL AND NEW."streak_type" IS NOT NULL THEN
      NEW."streakType" := NEW."streak_type";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_user_streaks_camel_snake ON public.user_streaks;
CREATE TRIGGER trg_zdt_sync_user_streaks_camel_snake
BEFORE INSERT OR UPDATE ON public.user_streaks
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_user_streaks_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_users_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."deleted_at" IS NULL AND NEW."deletedAt" IS NOT NULL THEN NEW."deleted_at" := NEW."deletedAt"; END IF;
    IF NEW."deletedAt" IS NULL AND NEW."deleted_at" IS NOT NULL THEN NEW."deletedAt" := NEW."deleted_at"; END IF;
    IF NEW."is_onboarded" IS NULL AND NEW."isOnboarded" IS NOT NULL THEN NEW."is_onboarded" := NEW."isOnboarded"; END IF;
    IF NEW."isOnboarded" IS NULL AND NEW."is_onboarded" IS NOT NULL THEN NEW."isOnboarded" := NEW."is_onboarded"; END IF;
    IF NEW."telegram_user_id" IS NULL AND NEW."telegramUserId" IS NOT NULL THEN NEW."telegram_user_id" := NEW."telegramUserId"; END IF;
    IF NEW."telegramUserId" IS NULL AND NEW."telegram_user_id" IS NOT NULL THEN NEW."telegramUserId" := NEW."telegram_user_id"; END IF;
    IF NEW."telegram_username" IS NULL AND NEW."telegramUsername" IS NOT NULL THEN NEW."telegram_username" := NEW."telegramUsername"; END IF;
    IF NEW."telegramUsername" IS NULL AND NEW."telegram_username" IS NOT NULL THEN NEW."telegramUsername" := NEW."telegram_username"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" AND NEW."deleted_at" IS NOT DISTINCT FROM OLD."deleted_at" THEN
      NEW."deleted_at" := NEW."deletedAt";
    ELSIF NEW."deleted_at" IS DISTINCT FROM OLD."deleted_at" AND NEW."deletedAt" IS NOT DISTINCT FROM OLD."deletedAt" THEN
      NEW."deletedAt" := NEW."deleted_at";
    ELSIF NEW."deleted_at" IS NULL AND NEW."deletedAt" IS NOT NULL THEN
      NEW."deleted_at" := NEW."deletedAt";
    ELSIF NEW."deletedAt" IS NULL AND NEW."deleted_at" IS NOT NULL THEN
      NEW."deletedAt" := NEW."deleted_at";
    END IF;
    IF NEW."isOnboarded" IS DISTINCT FROM OLD."isOnboarded" AND NEW."is_onboarded" IS NOT DISTINCT FROM OLD."is_onboarded" THEN
      NEW."is_onboarded" := NEW."isOnboarded";
    ELSIF NEW."is_onboarded" IS DISTINCT FROM OLD."is_onboarded" AND NEW."isOnboarded" IS NOT DISTINCT FROM OLD."isOnboarded" THEN
      NEW."isOnboarded" := NEW."is_onboarded";
    ELSIF NEW."is_onboarded" IS NULL AND NEW."isOnboarded" IS NOT NULL THEN
      NEW."is_onboarded" := NEW."isOnboarded";
    ELSIF NEW."isOnboarded" IS NULL AND NEW."is_onboarded" IS NOT NULL THEN
      NEW."isOnboarded" := NEW."is_onboarded";
    END IF;
    IF NEW."telegramUserId" IS DISTINCT FROM OLD."telegramUserId" AND NEW."telegram_user_id" IS NOT DISTINCT FROM OLD."telegram_user_id" THEN
      NEW."telegram_user_id" := NEW."telegramUserId";
    ELSIF NEW."telegram_user_id" IS DISTINCT FROM OLD."telegram_user_id" AND NEW."telegramUserId" IS NOT DISTINCT FROM OLD."telegramUserId" THEN
      NEW."telegramUserId" := NEW."telegram_user_id";
    ELSIF NEW."telegram_user_id" IS NULL AND NEW."telegramUserId" IS NOT NULL THEN
      NEW."telegram_user_id" := NEW."telegramUserId";
    ELSIF NEW."telegramUserId" IS NULL AND NEW."telegram_user_id" IS NOT NULL THEN
      NEW."telegramUserId" := NEW."telegram_user_id";
    END IF;
    IF NEW."telegramUsername" IS DISTINCT FROM OLD."telegramUsername" AND NEW."telegram_username" IS NOT DISTINCT FROM OLD."telegram_username" THEN
      NEW."telegram_username" := NEW."telegramUsername";
    ELSIF NEW."telegram_username" IS DISTINCT FROM OLD."telegram_username" AND NEW."telegramUsername" IS NOT DISTINCT FROM OLD."telegramUsername" THEN
      NEW."telegramUsername" := NEW."telegram_username";
    ELSIF NEW."telegram_username" IS NULL AND NEW."telegramUsername" IS NOT NULL THEN
      NEW."telegram_username" := NEW."telegramUsername";
    ELSIF NEW."telegramUsername" IS NULL AND NEW."telegram_username" IS NOT NULL THEN
      NEW."telegramUsername" := NEW."telegram_username";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_users_camel_snake ON public.users;
CREATE TRIGGER trg_zdt_sync_users_camel_snake
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_users_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_workout_session_exercises_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."avg_rpe" IS NULL AND NEW."avgRpe" IS NOT NULL THEN NEW."avg_rpe" := NEW."avgRpe"; END IF;
    IF NEW."avgRpe" IS NULL AND NEW."avg_rpe" IS NOT NULL THEN NEW."avgRpe" := NEW."avg_rpe"; END IF;
    IF NEW."best_estimated1_rm" IS NULL AND NEW."bestEstimated1Rm" IS NOT NULL THEN NEW."best_estimated1_rm" := NEW."bestEstimated1Rm"; END IF;
    IF NEW."bestEstimated1Rm" IS NULL AND NEW."best_estimated1_rm" IS NOT NULL THEN NEW."bestEstimated1Rm" := NEW."best_estimated1_rm"; END IF;
    IF NEW."block_key" IS NULL AND NEW."blockKey" IS NOT NULL THEN NEW."block_key" := NEW."blockKey"; END IF;
    IF NEW."blockKey" IS NULL AND NEW."block_key" IS NOT NULL THEN NEW."blockKey" := NEW."block_key"; END IF;
    IF NEW."block_type" IS NULL AND NEW."blockType" IS NOT NULL THEN NEW."block_type" := NEW."blockType"; END IF;
    IF NEW."blockType" IS NULL AND NEW."block_type" IS NOT NULL THEN NEW."blockType" := NEW."block_type"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN NEW."exercise_id" := NEW."exerciseId"; END IF;
    IF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN NEW."exerciseId" := NEW."exercise_id"; END IF;
    IF NEW."order_index" IS NULL AND NEW."orderIndex" IS NOT NULL THEN NEW."order_index" := NEW."orderIndex"; END IF;
    IF NEW."orderIndex" IS NULL AND NEW."order_index" IS NOT NULL THEN NEW."orderIndex" := NEW."order_index"; END IF;
    IF NEW."performed_sets" IS NULL AND NEW."performedSets" IS NOT NULL THEN NEW."performed_sets" := NEW."performedSets"; END IF;
    IF NEW."performedSets" IS NULL AND NEW."performed_sets" IS NOT NULL THEN NEW."performedSets" := NEW."performed_sets"; END IF;
    IF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN NEW."session_id" := NEW."sessionId"; END IF;
    IF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN NEW."sessionId" := NEW."session_id"; END IF;
    IF NEW."template_item_id" IS NULL AND NEW."templateItemId" IS NOT NULL THEN NEW."template_item_id" := NEW."templateItemId"; END IF;
    IF NEW."templateItemId" IS NULL AND NEW."template_item_id" IS NOT NULL THEN NEW."templateItemId" := NEW."template_item_id"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."volume_kg" IS NULL AND NEW."volumeKg" IS NOT NULL THEN NEW."volume_kg" := NEW."volumeKg"; END IF;
    IF NEW."volumeKg" IS NULL AND NEW."volume_kg" IS NOT NULL THEN NEW."volumeKg" := NEW."volume_kg"; END IF;
  ELSE
    IF NEW."avgRpe" IS DISTINCT FROM OLD."avgRpe" AND NEW."avg_rpe" IS NOT DISTINCT FROM OLD."avg_rpe" THEN
      NEW."avg_rpe" := NEW."avgRpe";
    ELSIF NEW."avg_rpe" IS DISTINCT FROM OLD."avg_rpe" AND NEW."avgRpe" IS NOT DISTINCT FROM OLD."avgRpe" THEN
      NEW."avgRpe" := NEW."avg_rpe";
    ELSIF NEW."avg_rpe" IS NULL AND NEW."avgRpe" IS NOT NULL THEN
      NEW."avg_rpe" := NEW."avgRpe";
    ELSIF NEW."avgRpe" IS NULL AND NEW."avg_rpe" IS NOT NULL THEN
      NEW."avgRpe" := NEW."avg_rpe";
    END IF;
    IF NEW."bestEstimated1Rm" IS DISTINCT FROM OLD."bestEstimated1Rm" AND NEW."best_estimated1_rm" IS NOT DISTINCT FROM OLD."best_estimated1_rm" THEN
      NEW."best_estimated1_rm" := NEW."bestEstimated1Rm";
    ELSIF NEW."best_estimated1_rm" IS DISTINCT FROM OLD."best_estimated1_rm" AND NEW."bestEstimated1Rm" IS NOT DISTINCT FROM OLD."bestEstimated1Rm" THEN
      NEW."bestEstimated1Rm" := NEW."best_estimated1_rm";
    ELSIF NEW."best_estimated1_rm" IS NULL AND NEW."bestEstimated1Rm" IS NOT NULL THEN
      NEW."best_estimated1_rm" := NEW."bestEstimated1Rm";
    ELSIF NEW."bestEstimated1Rm" IS NULL AND NEW."best_estimated1_rm" IS NOT NULL THEN
      NEW."bestEstimated1Rm" := NEW."best_estimated1_rm";
    END IF;
    IF NEW."blockKey" IS DISTINCT FROM OLD."blockKey" AND NEW."block_key" IS NOT DISTINCT FROM OLD."block_key" THEN
      NEW."block_key" := NEW."blockKey";
    ELSIF NEW."block_key" IS DISTINCT FROM OLD."block_key" AND NEW."blockKey" IS NOT DISTINCT FROM OLD."blockKey" THEN
      NEW."blockKey" := NEW."block_key";
    ELSIF NEW."block_key" IS NULL AND NEW."blockKey" IS NOT NULL THEN
      NEW."block_key" := NEW."blockKey";
    ELSIF NEW."blockKey" IS NULL AND NEW."block_key" IS NOT NULL THEN
      NEW."blockKey" := NEW."block_key";
    END IF;
    IF NEW."blockType" IS DISTINCT FROM OLD."blockType" AND NEW."block_type" IS NOT DISTINCT FROM OLD."block_type" THEN
      NEW."block_type" := NEW."blockType";
    ELSIF NEW."block_type" IS DISTINCT FROM OLD."block_type" AND NEW."blockType" IS NOT DISTINCT FROM OLD."blockType" THEN
      NEW."blockType" := NEW."block_type";
    ELSIF NEW."block_type" IS NULL AND NEW."blockType" IS NOT NULL THEN
      NEW."block_type" := NEW."blockType";
    ELSIF NEW."blockType" IS NULL AND NEW."block_type" IS NOT NULL THEN
      NEW."blockType" := NEW."block_type";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."exerciseId" IS DISTINCT FROM OLD."exerciseId" AND NEW."exercise_id" IS NOT DISTINCT FROM OLD."exercise_id" THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exercise_id" IS DISTINCT FROM OLD."exercise_id" AND NEW."exerciseId" IS NOT DISTINCT FROM OLD."exerciseId" THEN
      NEW."exerciseId" := NEW."exercise_id";
    ELSIF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN
      NEW."exerciseId" := NEW."exercise_id";
    END IF;
    IF NEW."orderIndex" IS DISTINCT FROM OLD."orderIndex" AND NEW."order_index" IS NOT DISTINCT FROM OLD."order_index" THEN
      NEW."order_index" := NEW."orderIndex";
    ELSIF NEW."order_index" IS DISTINCT FROM OLD."order_index" AND NEW."orderIndex" IS NOT DISTINCT FROM OLD."orderIndex" THEN
      NEW."orderIndex" := NEW."order_index";
    ELSIF NEW."order_index" IS NULL AND NEW."orderIndex" IS NOT NULL THEN
      NEW."order_index" := NEW."orderIndex";
    ELSIF NEW."orderIndex" IS NULL AND NEW."order_index" IS NOT NULL THEN
      NEW."orderIndex" := NEW."order_index";
    END IF;
    IF NEW."performedSets" IS DISTINCT FROM OLD."performedSets" AND NEW."performed_sets" IS NOT DISTINCT FROM OLD."performed_sets" THEN
      NEW."performed_sets" := NEW."performedSets";
    ELSIF NEW."performed_sets" IS DISTINCT FROM OLD."performed_sets" AND NEW."performedSets" IS NOT DISTINCT FROM OLD."performedSets" THEN
      NEW."performedSets" := NEW."performed_sets";
    ELSIF NEW."performed_sets" IS NULL AND NEW."performedSets" IS NOT NULL THEN
      NEW."performed_sets" := NEW."performedSets";
    ELSIF NEW."performedSets" IS NULL AND NEW."performed_sets" IS NOT NULL THEN
      NEW."performedSets" := NEW."performed_sets";
    END IF;
    IF NEW."sessionId" IS DISTINCT FROM OLD."sessionId" AND NEW."session_id" IS NOT DISTINCT FROM OLD."session_id" THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."session_id" IS DISTINCT FROM OLD."session_id" AND NEW."sessionId" IS NOT DISTINCT FROM OLD."sessionId" THEN
      NEW."sessionId" := NEW."session_id";
    ELSIF NEW."session_id" IS NULL AND NEW."sessionId" IS NOT NULL THEN
      NEW."session_id" := NEW."sessionId";
    ELSIF NEW."sessionId" IS NULL AND NEW."session_id" IS NOT NULL THEN
      NEW."sessionId" := NEW."session_id";
    END IF;
    IF NEW."templateItemId" IS DISTINCT FROM OLD."templateItemId" AND NEW."template_item_id" IS NOT DISTINCT FROM OLD."template_item_id" THEN
      NEW."template_item_id" := NEW."templateItemId";
    ELSIF NEW."template_item_id" IS DISTINCT FROM OLD."template_item_id" AND NEW."templateItemId" IS NOT DISTINCT FROM OLD."templateItemId" THEN
      NEW."templateItemId" := NEW."template_item_id";
    ELSIF NEW."template_item_id" IS NULL AND NEW."templateItemId" IS NOT NULL THEN
      NEW."template_item_id" := NEW."templateItemId";
    ELSIF NEW."templateItemId" IS NULL AND NEW."template_item_id" IS NOT NULL THEN
      NEW."templateItemId" := NEW."template_item_id";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."volumeKg" IS DISTINCT FROM OLD."volumeKg" AND NEW."volume_kg" IS NOT DISTINCT FROM OLD."volume_kg" THEN
      NEW."volume_kg" := NEW."volumeKg";
    ELSIF NEW."volume_kg" IS DISTINCT FROM OLD."volume_kg" AND NEW."volumeKg" IS NOT DISTINCT FROM OLD."volumeKg" THEN
      NEW."volumeKg" := NEW."volume_kg";
    ELSIF NEW."volume_kg" IS NULL AND NEW."volumeKg" IS NOT NULL THEN
      NEW."volume_kg" := NEW."volumeKg";
    ELSIF NEW."volumeKg" IS NULL AND NEW."volume_kg" IS NOT NULL THEN
      NEW."volumeKg" := NEW."volume_kg";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_session_exercises_camel_snake ON public.workout_session_exercises;
CREATE TRIGGER trg_zdt_sync_workout_session_exercises_camel_snake
BEFORE INSERT OR UPDATE ON public.workout_session_exercises
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_workout_session_exercises_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_workout_sessions_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."deleted_at" IS NULL AND NEW."deletedAt" IS NOT NULL THEN NEW."deleted_at" := NEW."deletedAt"; END IF;
    IF NEW."deletedAt" IS NULL AND NEW."deleted_at" IS NOT NULL THEN NEW."deletedAt" := NEW."deleted_at"; END IF;
    IF NEW."duration_seconds" IS NULL AND NEW."durationSeconds" IS NOT NULL THEN NEW."duration_seconds" := NEW."durationSeconds"; END IF;
    IF NEW."durationSeconds" IS NULL AND NEW."duration_seconds" IS NOT NULL THEN NEW."durationSeconds" := NEW."duration_seconds"; END IF;
    IF NEW."ended_at" IS NULL AND NEW."endedAt" IS NOT NULL THEN NEW."ended_at" := NEW."endedAt"; END IF;
    IF NEW."endedAt" IS NULL AND NEW."ended_at" IS NOT NULL THEN NEW."endedAt" := NEW."ended_at"; END IF;
    IF NEW."peak_estimated1_rm_kg" IS NULL AND NEW."peakEstimated1RmKg" IS NOT NULL THEN NEW."peak_estimated1_rm_kg" := NEW."peakEstimated1RmKg"; END IF;
    IF NEW."peakEstimated1RmKg" IS NULL AND NEW."peak_estimated1_rm_kg" IS NOT NULL THEN NEW."peakEstimated1RmKg" := NEW."peak_estimated1_rm_kg"; END IF;
    IF NEW."session_fatigue_score" IS NULL AND NEW."sessionFatigueScore" IS NOT NULL THEN NEW."session_fatigue_score" := NEW."sessionFatigueScore"; END IF;
    IF NEW."sessionFatigueScore" IS NULL AND NEW."session_fatigue_score" IS NOT NULL THEN NEW."sessionFatigueScore" := NEW."session_fatigue_score"; END IF;
    IF NEW."source_device_id" IS NULL AND NEW."sourceDeviceId" IS NOT NULL THEN NEW."source_device_id" := NEW."sourceDeviceId"; END IF;
    IF NEW."sourceDeviceId" IS NULL AND NEW."source_device_id" IS NOT NULL THEN NEW."sourceDeviceId" := NEW."source_device_id"; END IF;
    IF NEW."started_at" IS NULL AND NEW."startedAt" IS NOT NULL THEN NEW."started_at" := NEW."startedAt"; END IF;
    IF NEW."startedAt" IS NULL AND NEW."started_at" IS NOT NULL THEN NEW."startedAt" := NEW."started_at"; END IF;
    IF NEW."sync_version" IS NULL AND NEW."syncVersion" IS NOT NULL THEN NEW."sync_version" := NEW."syncVersion"; END IF;
    IF NEW."syncVersion" IS NULL AND NEW."sync_version" IS NOT NULL THEN NEW."syncVersion" := NEW."sync_version"; END IF;
    IF NEW."template_id" IS NULL AND NEW."templateId" IS NOT NULL THEN NEW."template_id" := NEW."templateId"; END IF;
    IF NEW."templateId" IS NULL AND NEW."template_id" IS NOT NULL THEN NEW."templateId" := NEW."template_id"; END IF;
    IF NEW."total_reps" IS NULL AND NEW."totalReps" IS NOT NULL THEN NEW."total_reps" := NEW."totalReps"; END IF;
    IF NEW."totalReps" IS NULL AND NEW."total_reps" IS NOT NULL THEN NEW."totalReps" := NEW."total_reps"; END IF;
    IF NEW."total_sets" IS NULL AND NEW."totalSets" IS NOT NULL THEN NEW."total_sets" := NEW."totalSets"; END IF;
    IF NEW."totalSets" IS NULL AND NEW."total_sets" IS NOT NULL THEN NEW."totalSets" := NEW."total_sets"; END IF;
    IF NEW."total_volume_kg" IS NULL AND NEW."totalVolumeKg" IS NOT NULL THEN NEW."total_volume_kg" := NEW."totalVolumeKg"; END IF;
    IF NEW."totalVolumeKg" IS NULL AND NEW."total_volume_kg" IS NOT NULL THEN NEW."totalVolumeKg" := NEW."total_volume_kg"; END IF;
    IF NEW."training_program_workout_id" IS NULL AND NEW."trainingProgramWorkoutId" IS NOT NULL THEN NEW."training_program_workout_id" := NEW."trainingProgramWorkoutId"; END IF;
    IF NEW."trainingProgramWorkoutId" IS NULL AND NEW."training_program_workout_id" IS NOT NULL THEN NEW."trainingProgramWorkoutId" := NEW."training_program_workout_id"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" AND NEW."deleted_at" IS NOT DISTINCT FROM OLD."deleted_at" THEN
      NEW."deleted_at" := NEW."deletedAt";
    ELSIF NEW."deleted_at" IS DISTINCT FROM OLD."deleted_at" AND NEW."deletedAt" IS NOT DISTINCT FROM OLD."deletedAt" THEN
      NEW."deletedAt" := NEW."deleted_at";
    ELSIF NEW."deleted_at" IS NULL AND NEW."deletedAt" IS NOT NULL THEN
      NEW."deleted_at" := NEW."deletedAt";
    ELSIF NEW."deletedAt" IS NULL AND NEW."deleted_at" IS NOT NULL THEN
      NEW."deletedAt" := NEW."deleted_at";
    END IF;
    IF NEW."durationSeconds" IS DISTINCT FROM OLD."durationSeconds" AND NEW."duration_seconds" IS NOT DISTINCT FROM OLD."duration_seconds" THEN
      NEW."duration_seconds" := NEW."durationSeconds";
    ELSIF NEW."duration_seconds" IS DISTINCT FROM OLD."duration_seconds" AND NEW."durationSeconds" IS NOT DISTINCT FROM OLD."durationSeconds" THEN
      NEW."durationSeconds" := NEW."duration_seconds";
    ELSIF NEW."duration_seconds" IS NULL AND NEW."durationSeconds" IS NOT NULL THEN
      NEW."duration_seconds" := NEW."durationSeconds";
    ELSIF NEW."durationSeconds" IS NULL AND NEW."duration_seconds" IS NOT NULL THEN
      NEW."durationSeconds" := NEW."duration_seconds";
    END IF;
    IF NEW."endedAt" IS DISTINCT FROM OLD."endedAt" AND NEW."ended_at" IS NOT DISTINCT FROM OLD."ended_at" THEN
      NEW."ended_at" := NEW."endedAt";
    ELSIF NEW."ended_at" IS DISTINCT FROM OLD."ended_at" AND NEW."endedAt" IS NOT DISTINCT FROM OLD."endedAt" THEN
      NEW."endedAt" := NEW."ended_at";
    ELSIF NEW."ended_at" IS NULL AND NEW."endedAt" IS NOT NULL THEN
      NEW."ended_at" := NEW."endedAt";
    ELSIF NEW."endedAt" IS NULL AND NEW."ended_at" IS NOT NULL THEN
      NEW."endedAt" := NEW."ended_at";
    END IF;
    IF NEW."peakEstimated1RmKg" IS DISTINCT FROM OLD."peakEstimated1RmKg" AND NEW."peak_estimated1_rm_kg" IS NOT DISTINCT FROM OLD."peak_estimated1_rm_kg" THEN
      NEW."peak_estimated1_rm_kg" := NEW."peakEstimated1RmKg";
    ELSIF NEW."peak_estimated1_rm_kg" IS DISTINCT FROM OLD."peak_estimated1_rm_kg" AND NEW."peakEstimated1RmKg" IS NOT DISTINCT FROM OLD."peakEstimated1RmKg" THEN
      NEW."peakEstimated1RmKg" := NEW."peak_estimated1_rm_kg";
    ELSIF NEW."peak_estimated1_rm_kg" IS NULL AND NEW."peakEstimated1RmKg" IS NOT NULL THEN
      NEW."peak_estimated1_rm_kg" := NEW."peakEstimated1RmKg";
    ELSIF NEW."peakEstimated1RmKg" IS NULL AND NEW."peak_estimated1_rm_kg" IS NOT NULL THEN
      NEW."peakEstimated1RmKg" := NEW."peak_estimated1_rm_kg";
    END IF;
    IF NEW."sessionFatigueScore" IS DISTINCT FROM OLD."sessionFatigueScore" AND NEW."session_fatigue_score" IS NOT DISTINCT FROM OLD."session_fatigue_score" THEN
      NEW."session_fatigue_score" := NEW."sessionFatigueScore";
    ELSIF NEW."session_fatigue_score" IS DISTINCT FROM OLD."session_fatigue_score" AND NEW."sessionFatigueScore" IS NOT DISTINCT FROM OLD."sessionFatigueScore" THEN
      NEW."sessionFatigueScore" := NEW."session_fatigue_score";
    ELSIF NEW."session_fatigue_score" IS NULL AND NEW."sessionFatigueScore" IS NOT NULL THEN
      NEW."session_fatigue_score" := NEW."sessionFatigueScore";
    ELSIF NEW."sessionFatigueScore" IS NULL AND NEW."session_fatigue_score" IS NOT NULL THEN
      NEW."sessionFatigueScore" := NEW."session_fatigue_score";
    END IF;
    IF NEW."sourceDeviceId" IS DISTINCT FROM OLD."sourceDeviceId" AND NEW."source_device_id" IS NOT DISTINCT FROM OLD."source_device_id" THEN
      NEW."source_device_id" := NEW."sourceDeviceId";
    ELSIF NEW."source_device_id" IS DISTINCT FROM OLD."source_device_id" AND NEW."sourceDeviceId" IS NOT DISTINCT FROM OLD."sourceDeviceId" THEN
      NEW."sourceDeviceId" := NEW."source_device_id";
    ELSIF NEW."source_device_id" IS NULL AND NEW."sourceDeviceId" IS NOT NULL THEN
      NEW."source_device_id" := NEW."sourceDeviceId";
    ELSIF NEW."sourceDeviceId" IS NULL AND NEW."source_device_id" IS NOT NULL THEN
      NEW."sourceDeviceId" := NEW."source_device_id";
    END IF;
    IF NEW."startedAt" IS DISTINCT FROM OLD."startedAt" AND NEW."started_at" IS NOT DISTINCT FROM OLD."started_at" THEN
      NEW."started_at" := NEW."startedAt";
    ELSIF NEW."started_at" IS DISTINCT FROM OLD."started_at" AND NEW."startedAt" IS NOT DISTINCT FROM OLD."startedAt" THEN
      NEW."startedAt" := NEW."started_at";
    ELSIF NEW."started_at" IS NULL AND NEW."startedAt" IS NOT NULL THEN
      NEW."started_at" := NEW."startedAt";
    ELSIF NEW."startedAt" IS NULL AND NEW."started_at" IS NOT NULL THEN
      NEW."startedAt" := NEW."started_at";
    END IF;
    IF NEW."syncVersion" IS DISTINCT FROM OLD."syncVersion" AND NEW."sync_version" IS NOT DISTINCT FROM OLD."sync_version" THEN
      NEW."sync_version" := NEW."syncVersion";
    ELSIF NEW."sync_version" IS DISTINCT FROM OLD."sync_version" AND NEW."syncVersion" IS NOT DISTINCT FROM OLD."syncVersion" THEN
      NEW."syncVersion" := NEW."sync_version";
    ELSIF NEW."sync_version" IS NULL AND NEW."syncVersion" IS NOT NULL THEN
      NEW."sync_version" := NEW."syncVersion";
    ELSIF NEW."syncVersion" IS NULL AND NEW."sync_version" IS NOT NULL THEN
      NEW."syncVersion" := NEW."sync_version";
    END IF;
    IF NEW."templateId" IS DISTINCT FROM OLD."templateId" AND NEW."template_id" IS NOT DISTINCT FROM OLD."template_id" THEN
      NEW."template_id" := NEW."templateId";
    ELSIF NEW."template_id" IS DISTINCT FROM OLD."template_id" AND NEW."templateId" IS NOT DISTINCT FROM OLD."templateId" THEN
      NEW."templateId" := NEW."template_id";
    ELSIF NEW."template_id" IS NULL AND NEW."templateId" IS NOT NULL THEN
      NEW."template_id" := NEW."templateId";
    ELSIF NEW."templateId" IS NULL AND NEW."template_id" IS NOT NULL THEN
      NEW."templateId" := NEW."template_id";
    END IF;
    IF NEW."totalReps" IS DISTINCT FROM OLD."totalReps" AND NEW."total_reps" IS NOT DISTINCT FROM OLD."total_reps" THEN
      NEW."total_reps" := NEW."totalReps";
    ELSIF NEW."total_reps" IS DISTINCT FROM OLD."total_reps" AND NEW."totalReps" IS NOT DISTINCT FROM OLD."totalReps" THEN
      NEW."totalReps" := NEW."total_reps";
    ELSIF NEW."total_reps" IS NULL AND NEW."totalReps" IS NOT NULL THEN
      NEW."total_reps" := NEW."totalReps";
    ELSIF NEW."totalReps" IS NULL AND NEW."total_reps" IS NOT NULL THEN
      NEW."totalReps" := NEW."total_reps";
    END IF;
    IF NEW."totalSets" IS DISTINCT FROM OLD."totalSets" AND NEW."total_sets" IS NOT DISTINCT FROM OLD."total_sets" THEN
      NEW."total_sets" := NEW."totalSets";
    ELSIF NEW."total_sets" IS DISTINCT FROM OLD."total_sets" AND NEW."totalSets" IS NOT DISTINCT FROM OLD."totalSets" THEN
      NEW."totalSets" := NEW."total_sets";
    ELSIF NEW."total_sets" IS NULL AND NEW."totalSets" IS NOT NULL THEN
      NEW."total_sets" := NEW."totalSets";
    ELSIF NEW."totalSets" IS NULL AND NEW."total_sets" IS NOT NULL THEN
      NEW."totalSets" := NEW."total_sets";
    END IF;
    IF NEW."totalVolumeKg" IS DISTINCT FROM OLD."totalVolumeKg" AND NEW."total_volume_kg" IS NOT DISTINCT FROM OLD."total_volume_kg" THEN
      NEW."total_volume_kg" := NEW."totalVolumeKg";
    ELSIF NEW."total_volume_kg" IS DISTINCT FROM OLD."total_volume_kg" AND NEW."totalVolumeKg" IS NOT DISTINCT FROM OLD."totalVolumeKg" THEN
      NEW."totalVolumeKg" := NEW."total_volume_kg";
    ELSIF NEW."total_volume_kg" IS NULL AND NEW."totalVolumeKg" IS NOT NULL THEN
      NEW."total_volume_kg" := NEW."totalVolumeKg";
    ELSIF NEW."totalVolumeKg" IS NULL AND NEW."total_volume_kg" IS NOT NULL THEN
      NEW."totalVolumeKg" := NEW."total_volume_kg";
    END IF;
    IF NEW."trainingProgramWorkoutId" IS DISTINCT FROM OLD."trainingProgramWorkoutId" AND NEW."training_program_workout_id" IS NOT DISTINCT FROM OLD."training_program_workout_id" THEN
      NEW."training_program_workout_id" := NEW."trainingProgramWorkoutId";
    ELSIF NEW."training_program_workout_id" IS DISTINCT FROM OLD."training_program_workout_id" AND NEW."trainingProgramWorkoutId" IS NOT DISTINCT FROM OLD."trainingProgramWorkoutId" THEN
      NEW."trainingProgramWorkoutId" := NEW."training_program_workout_id";
    ELSIF NEW."training_program_workout_id" IS NULL AND NEW."trainingProgramWorkoutId" IS NOT NULL THEN
      NEW."training_program_workout_id" := NEW."trainingProgramWorkoutId";
    ELSIF NEW."trainingProgramWorkoutId" IS NULL AND NEW."training_program_workout_id" IS NOT NULL THEN
      NEW."trainingProgramWorkoutId" := NEW."training_program_workout_id";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_sessions_camel_snake ON public.workout_sessions;
CREATE TRIGGER trg_zdt_sync_workout_sessions_camel_snake
BEFORE INSERT OR UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_workout_sessions_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_workout_sets_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."actual_rest_sec" IS NULL AND NEW."actualRestSec" IS NOT NULL THEN NEW."actual_rest_sec" := NEW."actualRestSec"; END IF;
    IF NEW."actualRestSec" IS NULL AND NEW."actual_rest_sec" IS NOT NULL THEN NEW."actualRestSec" := NEW."actual_rest_sec"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."distance_meters" IS NULL AND NEW."distanceMeters" IS NOT NULL THEN NEW."distance_meters" := NEW."distanceMeters"; END IF;
    IF NEW."distanceMeters" IS NULL AND NEW."distance_meters" IS NOT NULL THEN NEW."distanceMeters" := NEW."distance_meters"; END IF;
    IF NEW."duration_sec" IS NULL AND NEW."durationSec" IS NOT NULL THEN NEW."duration_sec" := NEW."durationSec"; END IF;
    IF NEW."durationSec" IS NULL AND NEW."duration_sec" IS NOT NULL THEN NEW."durationSec" := NEW."duration_sec"; END IF;
    IF NEW."estimated1_rm_kg" IS NULL AND NEW."estimated1RmKg" IS NOT NULL THEN NEW."estimated1_rm_kg" := NEW."estimated1RmKg"; END IF;
    IF NEW."estimated1RmKg" IS NULL AND NEW."estimated1_rm_kg" IS NOT NULL THEN NEW."estimated1RmKg" := NEW."estimated1_rm_kg"; END IF;
    IF NEW."fatigue_score" IS NULL AND NEW."fatigueScore" IS NOT NULL THEN NEW."fatigue_score" := NEW."fatigueScore"; END IF;
    IF NEW."fatigueScore" IS NULL AND NEW."fatigue_score" IS NOT NULL THEN NEW."fatigueScore" := NEW."fatigue_score"; END IF;
    IF NEW."is_completed" IS NULL AND NEW."isCompleted" IS NOT NULL THEN NEW."is_completed" := NEW."isCompleted"; END IF;
    IF NEW."isCompleted" IS NULL AND NEW."is_completed" IS NOT NULL THEN NEW."isCompleted" := NEW."is_completed"; END IF;
    IF NEW."session_exercise_id" IS NULL AND NEW."sessionExerciseId" IS NOT NULL THEN NEW."session_exercise_id" := NEW."sessionExerciseId"; END IF;
    IF NEW."sessionExerciseId" IS NULL AND NEW."session_exercise_id" IS NOT NULL THEN NEW."sessionExerciseId" := NEW."session_exercise_id"; END IF;
    IF NEW."set_order" IS NULL AND NEW."setOrder" IS NOT NULL THEN NEW."set_order" := NEW."setOrder"; END IF;
    IF NEW."setOrder" IS NULL AND NEW."set_order" IS NOT NULL THEN NEW."setOrder" := NEW."set_order"; END IF;
    IF NEW."set_type" IS NULL AND NEW."setType" IS NOT NULL THEN NEW."set_type" := NEW."setType"; END IF;
    IF NEW."setType" IS NULL AND NEW."set_type" IS NOT NULL THEN NEW."setType" := NEW."set_type"; END IF;
    IF NEW."suggested_rest_sec" IS NULL AND NEW."suggestedRestSec" IS NOT NULL THEN NEW."suggested_rest_sec" := NEW."suggestedRestSec"; END IF;
    IF NEW."suggestedRestSec" IS NULL AND NEW."suggested_rest_sec" IS NOT NULL THEN NEW."suggestedRestSec" := NEW."suggested_rest_sec"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."weight_kg" IS NULL AND NEW."weightKg" IS NOT NULL THEN NEW."weight_kg" := NEW."weightKg"; END IF;
    IF NEW."weightKg" IS NULL AND NEW."weight_kg" IS NOT NULL THEN NEW."weightKg" := NEW."weight_kg"; END IF;
  ELSE
    IF NEW."actualRestSec" IS DISTINCT FROM OLD."actualRestSec" AND NEW."actual_rest_sec" IS NOT DISTINCT FROM OLD."actual_rest_sec" THEN
      NEW."actual_rest_sec" := NEW."actualRestSec";
    ELSIF NEW."actual_rest_sec" IS DISTINCT FROM OLD."actual_rest_sec" AND NEW."actualRestSec" IS NOT DISTINCT FROM OLD."actualRestSec" THEN
      NEW."actualRestSec" := NEW."actual_rest_sec";
    ELSIF NEW."actual_rest_sec" IS NULL AND NEW."actualRestSec" IS NOT NULL THEN
      NEW."actual_rest_sec" := NEW."actualRestSec";
    ELSIF NEW."actualRestSec" IS NULL AND NEW."actual_rest_sec" IS NOT NULL THEN
      NEW."actualRestSec" := NEW."actual_rest_sec";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."distanceMeters" IS DISTINCT FROM OLD."distanceMeters" AND NEW."distance_meters" IS NOT DISTINCT FROM OLD."distance_meters" THEN
      NEW."distance_meters" := NEW."distanceMeters";
    ELSIF NEW."distance_meters" IS DISTINCT FROM OLD."distance_meters" AND NEW."distanceMeters" IS NOT DISTINCT FROM OLD."distanceMeters" THEN
      NEW."distanceMeters" := NEW."distance_meters";
    ELSIF NEW."distance_meters" IS NULL AND NEW."distanceMeters" IS NOT NULL THEN
      NEW."distance_meters" := NEW."distanceMeters";
    ELSIF NEW."distanceMeters" IS NULL AND NEW."distance_meters" IS NOT NULL THEN
      NEW."distanceMeters" := NEW."distance_meters";
    END IF;
    IF NEW."durationSec" IS DISTINCT FROM OLD."durationSec" AND NEW."duration_sec" IS NOT DISTINCT FROM OLD."duration_sec" THEN
      NEW."duration_sec" := NEW."durationSec";
    ELSIF NEW."duration_sec" IS DISTINCT FROM OLD."duration_sec" AND NEW."durationSec" IS NOT DISTINCT FROM OLD."durationSec" THEN
      NEW."durationSec" := NEW."duration_sec";
    ELSIF NEW."duration_sec" IS NULL AND NEW."durationSec" IS NOT NULL THEN
      NEW."duration_sec" := NEW."durationSec";
    ELSIF NEW."durationSec" IS NULL AND NEW."duration_sec" IS NOT NULL THEN
      NEW."durationSec" := NEW."duration_sec";
    END IF;
    IF NEW."estimated1RmKg" IS DISTINCT FROM OLD."estimated1RmKg" AND NEW."estimated1_rm_kg" IS NOT DISTINCT FROM OLD."estimated1_rm_kg" THEN
      NEW."estimated1_rm_kg" := NEW."estimated1RmKg";
    ELSIF NEW."estimated1_rm_kg" IS DISTINCT FROM OLD."estimated1_rm_kg" AND NEW."estimated1RmKg" IS NOT DISTINCT FROM OLD."estimated1RmKg" THEN
      NEW."estimated1RmKg" := NEW."estimated1_rm_kg";
    ELSIF NEW."estimated1_rm_kg" IS NULL AND NEW."estimated1RmKg" IS NOT NULL THEN
      NEW."estimated1_rm_kg" := NEW."estimated1RmKg";
    ELSIF NEW."estimated1RmKg" IS NULL AND NEW."estimated1_rm_kg" IS NOT NULL THEN
      NEW."estimated1RmKg" := NEW."estimated1_rm_kg";
    END IF;
    IF NEW."fatigueScore" IS DISTINCT FROM OLD."fatigueScore" AND NEW."fatigue_score" IS NOT DISTINCT FROM OLD."fatigue_score" THEN
      NEW."fatigue_score" := NEW."fatigueScore";
    ELSIF NEW."fatigue_score" IS DISTINCT FROM OLD."fatigue_score" AND NEW."fatigueScore" IS NOT DISTINCT FROM OLD."fatigueScore" THEN
      NEW."fatigueScore" := NEW."fatigue_score";
    ELSIF NEW."fatigue_score" IS NULL AND NEW."fatigueScore" IS NOT NULL THEN
      NEW."fatigue_score" := NEW."fatigueScore";
    ELSIF NEW."fatigueScore" IS NULL AND NEW."fatigue_score" IS NOT NULL THEN
      NEW."fatigueScore" := NEW."fatigue_score";
    END IF;
    IF NEW."isCompleted" IS DISTINCT FROM OLD."isCompleted" AND NEW."is_completed" IS NOT DISTINCT FROM OLD."is_completed" THEN
      NEW."is_completed" := NEW."isCompleted";
    ELSIF NEW."is_completed" IS DISTINCT FROM OLD."is_completed" AND NEW."isCompleted" IS NOT DISTINCT FROM OLD."isCompleted" THEN
      NEW."isCompleted" := NEW."is_completed";
    ELSIF NEW."is_completed" IS NULL AND NEW."isCompleted" IS NOT NULL THEN
      NEW."is_completed" := NEW."isCompleted";
    ELSIF NEW."isCompleted" IS NULL AND NEW."is_completed" IS NOT NULL THEN
      NEW."isCompleted" := NEW."is_completed";
    END IF;
    IF NEW."sessionExerciseId" IS DISTINCT FROM OLD."sessionExerciseId" AND NEW."session_exercise_id" IS NOT DISTINCT FROM OLD."session_exercise_id" THEN
      NEW."session_exercise_id" := NEW."sessionExerciseId";
    ELSIF NEW."session_exercise_id" IS DISTINCT FROM OLD."session_exercise_id" AND NEW."sessionExerciseId" IS NOT DISTINCT FROM OLD."sessionExerciseId" THEN
      NEW."sessionExerciseId" := NEW."session_exercise_id";
    ELSIF NEW."session_exercise_id" IS NULL AND NEW."sessionExerciseId" IS NOT NULL THEN
      NEW."session_exercise_id" := NEW."sessionExerciseId";
    ELSIF NEW."sessionExerciseId" IS NULL AND NEW."session_exercise_id" IS NOT NULL THEN
      NEW."sessionExerciseId" := NEW."session_exercise_id";
    END IF;
    IF NEW."setOrder" IS DISTINCT FROM OLD."setOrder" AND NEW."set_order" IS NOT DISTINCT FROM OLD."set_order" THEN
      NEW."set_order" := NEW."setOrder";
    ELSIF NEW."set_order" IS DISTINCT FROM OLD."set_order" AND NEW."setOrder" IS NOT DISTINCT FROM OLD."setOrder" THEN
      NEW."setOrder" := NEW."set_order";
    ELSIF NEW."set_order" IS NULL AND NEW."setOrder" IS NOT NULL THEN
      NEW."set_order" := NEW."setOrder";
    ELSIF NEW."setOrder" IS NULL AND NEW."set_order" IS NOT NULL THEN
      NEW."setOrder" := NEW."set_order";
    END IF;
    IF NEW."setType" IS DISTINCT FROM OLD."setType" AND NEW."set_type" IS NOT DISTINCT FROM OLD."set_type" THEN
      NEW."set_type" := NEW."setType";
    ELSIF NEW."set_type" IS DISTINCT FROM OLD."set_type" AND NEW."setType" IS NOT DISTINCT FROM OLD."setType" THEN
      NEW."setType" := NEW."set_type";
    ELSIF NEW."set_type" IS NULL AND NEW."setType" IS NOT NULL THEN
      NEW."set_type" := NEW."setType";
    ELSIF NEW."setType" IS NULL AND NEW."set_type" IS NOT NULL THEN
      NEW."setType" := NEW."set_type";
    END IF;
    IF NEW."suggestedRestSec" IS DISTINCT FROM OLD."suggestedRestSec" AND NEW."suggested_rest_sec" IS NOT DISTINCT FROM OLD."suggested_rest_sec" THEN
      NEW."suggested_rest_sec" := NEW."suggestedRestSec";
    ELSIF NEW."suggested_rest_sec" IS DISTINCT FROM OLD."suggested_rest_sec" AND NEW."suggestedRestSec" IS NOT DISTINCT FROM OLD."suggestedRestSec" THEN
      NEW."suggestedRestSec" := NEW."suggested_rest_sec";
    ELSIF NEW."suggested_rest_sec" IS NULL AND NEW."suggestedRestSec" IS NOT NULL THEN
      NEW."suggested_rest_sec" := NEW."suggestedRestSec";
    ELSIF NEW."suggestedRestSec" IS NULL AND NEW."suggested_rest_sec" IS NOT NULL THEN
      NEW."suggestedRestSec" := NEW."suggested_rest_sec";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."weightKg" IS DISTINCT FROM OLD."weightKg" AND NEW."weight_kg" IS NOT DISTINCT FROM OLD."weight_kg" THEN
      NEW."weight_kg" := NEW."weightKg";
    ELSIF NEW."weight_kg" IS DISTINCT FROM OLD."weight_kg" AND NEW."weightKg" IS NOT DISTINCT FROM OLD."weightKg" THEN
      NEW."weightKg" := NEW."weight_kg";
    ELSIF NEW."weight_kg" IS NULL AND NEW."weightKg" IS NOT NULL THEN
      NEW."weight_kg" := NEW."weightKg";
    ELSIF NEW."weightKg" IS NULL AND NEW."weight_kg" IS NOT NULL THEN
      NEW."weightKg" := NEW."weight_kg";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_sets_camel_snake ON public.workout_sets;
CREATE TRIGGER trg_zdt_sync_workout_sets_camel_snake
BEFORE INSERT OR UPDATE ON public.workout_sets
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_workout_sets_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_workout_template_items_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."block_key" IS NULL AND NEW."blockKey" IS NOT NULL THEN NEW."block_key" := NEW."blockKey"; END IF;
    IF NEW."blockKey" IS NULL AND NEW."block_key" IS NOT NULL THEN NEW."blockKey" := NEW."block_key"; END IF;
    IF NEW."block_type" IS NULL AND NEW."blockType" IS NOT NULL THEN NEW."block_type" := NEW."blockType"; END IF;
    IF NEW."blockType" IS NULL AND NEW."block_type" IS NOT NULL THEN NEW."blockType" := NEW."block_type"; END IF;
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN NEW."exercise_id" := NEW."exerciseId"; END IF;
    IF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN NEW."exerciseId" := NEW."exercise_id"; END IF;
    IF NEW."order_index" IS NULL AND NEW."orderIndex" IS NOT NULL THEN NEW."order_index" := NEW."orderIndex"; END IF;
    IF NEW."orderIndex" IS NULL AND NEW."order_index" IS NOT NULL THEN NEW."orderIndex" := NEW."order_index"; END IF;
    IF NEW."rest_seconds" IS NULL AND NEW."restSeconds" IS NOT NULL THEN NEW."rest_seconds" := NEW."restSeconds"; END IF;
    IF NEW."restSeconds" IS NULL AND NEW."rest_seconds" IS NOT NULL THEN NEW."restSeconds" := NEW."rest_seconds"; END IF;
    IF NEW."target_reps_max" IS NULL AND NEW."targetRepsMax" IS NOT NULL THEN NEW."target_reps_max" := NEW."targetRepsMax"; END IF;
    IF NEW."targetRepsMax" IS NULL AND NEW."target_reps_max" IS NOT NULL THEN NEW."targetRepsMax" := NEW."target_reps_max"; END IF;
    IF NEW."target_reps_min" IS NULL AND NEW."targetRepsMin" IS NOT NULL THEN NEW."target_reps_min" := NEW."targetRepsMin"; END IF;
    IF NEW."targetRepsMin" IS NULL AND NEW."target_reps_min" IS NOT NULL THEN NEW."targetRepsMin" := NEW."target_reps_min"; END IF;
    IF NEW."target_rpe" IS NULL AND NEW."targetRpe" IS NOT NULL THEN NEW."target_rpe" := NEW."targetRpe"; END IF;
    IF NEW."targetRpe" IS NULL AND NEW."target_rpe" IS NOT NULL THEN NEW."targetRpe" := NEW."target_rpe"; END IF;
    IF NEW."target_sets" IS NULL AND NEW."targetSets" IS NOT NULL THEN NEW."target_sets" := NEW."targetSets"; END IF;
    IF NEW."targetSets" IS NULL AND NEW."target_sets" IS NOT NULL THEN NEW."targetSets" := NEW."target_sets"; END IF;
    IF NEW."target_weight_kg" IS NULL AND NEW."targetWeightKg" IS NOT NULL THEN NEW."target_weight_kg" := NEW."targetWeightKg"; END IF;
    IF NEW."targetWeightKg" IS NULL AND NEW."target_weight_kg" IS NOT NULL THEN NEW."targetWeightKg" := NEW."target_weight_kg"; END IF;
    IF NEW."template_id" IS NULL AND NEW."templateId" IS NOT NULL THEN NEW."template_id" := NEW."templateId"; END IF;
    IF NEW."templateId" IS NULL AND NEW."template_id" IS NOT NULL THEN NEW."templateId" := NEW."template_id"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
  ELSE
    IF NEW."blockKey" IS DISTINCT FROM OLD."blockKey" AND NEW."block_key" IS NOT DISTINCT FROM OLD."block_key" THEN
      NEW."block_key" := NEW."blockKey";
    ELSIF NEW."block_key" IS DISTINCT FROM OLD."block_key" AND NEW."blockKey" IS NOT DISTINCT FROM OLD."blockKey" THEN
      NEW."blockKey" := NEW."block_key";
    ELSIF NEW."block_key" IS NULL AND NEW."blockKey" IS NOT NULL THEN
      NEW."block_key" := NEW."blockKey";
    ELSIF NEW."blockKey" IS NULL AND NEW."block_key" IS NOT NULL THEN
      NEW."blockKey" := NEW."block_key";
    END IF;
    IF NEW."blockType" IS DISTINCT FROM OLD."blockType" AND NEW."block_type" IS NOT DISTINCT FROM OLD."block_type" THEN
      NEW."block_type" := NEW."blockType";
    ELSIF NEW."block_type" IS DISTINCT FROM OLD."block_type" AND NEW."blockType" IS NOT DISTINCT FROM OLD."blockType" THEN
      NEW."blockType" := NEW."block_type";
    ELSIF NEW."block_type" IS NULL AND NEW."blockType" IS NOT NULL THEN
      NEW."block_type" := NEW."blockType";
    ELSIF NEW."blockType" IS NULL AND NEW."block_type" IS NOT NULL THEN
      NEW."blockType" := NEW."block_type";
    END IF;
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."exerciseId" IS DISTINCT FROM OLD."exerciseId" AND NEW."exercise_id" IS NOT DISTINCT FROM OLD."exercise_id" THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exercise_id" IS DISTINCT FROM OLD."exercise_id" AND NEW."exerciseId" IS NOT DISTINCT FROM OLD."exerciseId" THEN
      NEW."exerciseId" := NEW."exercise_id";
    ELSIF NEW."exercise_id" IS NULL AND NEW."exerciseId" IS NOT NULL THEN
      NEW."exercise_id" := NEW."exerciseId";
    ELSIF NEW."exerciseId" IS NULL AND NEW."exercise_id" IS NOT NULL THEN
      NEW."exerciseId" := NEW."exercise_id";
    END IF;
    IF NEW."orderIndex" IS DISTINCT FROM OLD."orderIndex" AND NEW."order_index" IS NOT DISTINCT FROM OLD."order_index" THEN
      NEW."order_index" := NEW."orderIndex";
    ELSIF NEW."order_index" IS DISTINCT FROM OLD."order_index" AND NEW."orderIndex" IS NOT DISTINCT FROM OLD."orderIndex" THEN
      NEW."orderIndex" := NEW."order_index";
    ELSIF NEW."order_index" IS NULL AND NEW."orderIndex" IS NOT NULL THEN
      NEW."order_index" := NEW."orderIndex";
    ELSIF NEW."orderIndex" IS NULL AND NEW."order_index" IS NOT NULL THEN
      NEW."orderIndex" := NEW."order_index";
    END IF;
    IF NEW."restSeconds" IS DISTINCT FROM OLD."restSeconds" AND NEW."rest_seconds" IS NOT DISTINCT FROM OLD."rest_seconds" THEN
      NEW."rest_seconds" := NEW."restSeconds";
    ELSIF NEW."rest_seconds" IS DISTINCT FROM OLD."rest_seconds" AND NEW."restSeconds" IS NOT DISTINCT FROM OLD."restSeconds" THEN
      NEW."restSeconds" := NEW."rest_seconds";
    ELSIF NEW."rest_seconds" IS NULL AND NEW."restSeconds" IS NOT NULL THEN
      NEW."rest_seconds" := NEW."restSeconds";
    ELSIF NEW."restSeconds" IS NULL AND NEW."rest_seconds" IS NOT NULL THEN
      NEW."restSeconds" := NEW."rest_seconds";
    END IF;
    IF NEW."targetRepsMax" IS DISTINCT FROM OLD."targetRepsMax" AND NEW."target_reps_max" IS NOT DISTINCT FROM OLD."target_reps_max" THEN
      NEW."target_reps_max" := NEW."targetRepsMax";
    ELSIF NEW."target_reps_max" IS DISTINCT FROM OLD."target_reps_max" AND NEW."targetRepsMax" IS NOT DISTINCT FROM OLD."targetRepsMax" THEN
      NEW."targetRepsMax" := NEW."target_reps_max";
    ELSIF NEW."target_reps_max" IS NULL AND NEW."targetRepsMax" IS NOT NULL THEN
      NEW."target_reps_max" := NEW."targetRepsMax";
    ELSIF NEW."targetRepsMax" IS NULL AND NEW."target_reps_max" IS NOT NULL THEN
      NEW."targetRepsMax" := NEW."target_reps_max";
    END IF;
    IF NEW."targetRepsMin" IS DISTINCT FROM OLD."targetRepsMin" AND NEW."target_reps_min" IS NOT DISTINCT FROM OLD."target_reps_min" THEN
      NEW."target_reps_min" := NEW."targetRepsMin";
    ELSIF NEW."target_reps_min" IS DISTINCT FROM OLD."target_reps_min" AND NEW."targetRepsMin" IS NOT DISTINCT FROM OLD."targetRepsMin" THEN
      NEW."targetRepsMin" := NEW."target_reps_min";
    ELSIF NEW."target_reps_min" IS NULL AND NEW."targetRepsMin" IS NOT NULL THEN
      NEW."target_reps_min" := NEW."targetRepsMin";
    ELSIF NEW."targetRepsMin" IS NULL AND NEW."target_reps_min" IS NOT NULL THEN
      NEW."targetRepsMin" := NEW."target_reps_min";
    END IF;
    IF NEW."targetRpe" IS DISTINCT FROM OLD."targetRpe" AND NEW."target_rpe" IS NOT DISTINCT FROM OLD."target_rpe" THEN
      NEW."target_rpe" := NEW."targetRpe";
    ELSIF NEW."target_rpe" IS DISTINCT FROM OLD."target_rpe" AND NEW."targetRpe" IS NOT DISTINCT FROM OLD."targetRpe" THEN
      NEW."targetRpe" := NEW."target_rpe";
    ELSIF NEW."target_rpe" IS NULL AND NEW."targetRpe" IS NOT NULL THEN
      NEW."target_rpe" := NEW."targetRpe";
    ELSIF NEW."targetRpe" IS NULL AND NEW."target_rpe" IS NOT NULL THEN
      NEW."targetRpe" := NEW."target_rpe";
    END IF;
    IF NEW."targetSets" IS DISTINCT FROM OLD."targetSets" AND NEW."target_sets" IS NOT DISTINCT FROM OLD."target_sets" THEN
      NEW."target_sets" := NEW."targetSets";
    ELSIF NEW."target_sets" IS DISTINCT FROM OLD."target_sets" AND NEW."targetSets" IS NOT DISTINCT FROM OLD."targetSets" THEN
      NEW."targetSets" := NEW."target_sets";
    ELSIF NEW."target_sets" IS NULL AND NEW."targetSets" IS NOT NULL THEN
      NEW."target_sets" := NEW."targetSets";
    ELSIF NEW."targetSets" IS NULL AND NEW."target_sets" IS NOT NULL THEN
      NEW."targetSets" := NEW."target_sets";
    END IF;
    IF NEW."targetWeightKg" IS DISTINCT FROM OLD."targetWeightKg" AND NEW."target_weight_kg" IS NOT DISTINCT FROM OLD."target_weight_kg" THEN
      NEW."target_weight_kg" := NEW."targetWeightKg";
    ELSIF NEW."target_weight_kg" IS DISTINCT FROM OLD."target_weight_kg" AND NEW."targetWeightKg" IS NOT DISTINCT FROM OLD."targetWeightKg" THEN
      NEW."targetWeightKg" := NEW."target_weight_kg";
    ELSIF NEW."target_weight_kg" IS NULL AND NEW."targetWeightKg" IS NOT NULL THEN
      NEW."target_weight_kg" := NEW."targetWeightKg";
    ELSIF NEW."targetWeightKg" IS NULL AND NEW."target_weight_kg" IS NOT NULL THEN
      NEW."targetWeightKg" := NEW."target_weight_kg";
    END IF;
    IF NEW."templateId" IS DISTINCT FROM OLD."templateId" AND NEW."template_id" IS NOT DISTINCT FROM OLD."template_id" THEN
      NEW."template_id" := NEW."templateId";
    ELSIF NEW."template_id" IS DISTINCT FROM OLD."template_id" AND NEW."templateId" IS NOT DISTINCT FROM OLD."templateId" THEN
      NEW."templateId" := NEW."template_id";
    ELSIF NEW."template_id" IS NULL AND NEW."templateId" IS NOT NULL THEN
      NEW."template_id" := NEW."templateId";
    ELSIF NEW."templateId" IS NULL AND NEW."template_id" IS NOT NULL THEN
      NEW."templateId" := NEW."template_id";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_template_items_camel_snake ON public.workout_template_items;
CREATE TRIGGER trg_zdt_sync_workout_template_items_camel_snake
BEFORE INSERT OR UPDATE ON public.workout_template_items
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_workout_template_items_camel_snake();

CREATE OR REPLACE FUNCTION public.zdt_sync_workout_templates_camel_snake()
RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN NEW."created_at" := NEW."createdAt"; END IF;
    IF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN NEW."createdAt" := NEW."created_at"; END IF;
    IF NEW."estimated_min_sec" IS NULL AND NEW."estimatedMinSec" IS NOT NULL THEN NEW."estimated_min_sec" := NEW."estimatedMinSec"; END IF;
    IF NEW."estimatedMinSec" IS NULL AND NEW."estimated_min_sec" IS NOT NULL THEN NEW."estimatedMinSec" := NEW."estimated_min_sec"; END IF;
    IF NEW."is_archived" IS NULL AND NEW."isArchived" IS NOT NULL THEN NEW."is_archived" := NEW."isArchived"; END IF;
    IF NEW."isArchived" IS NULL AND NEW."is_archived" IS NOT NULL THEN NEW."isArchived" := NEW."is_archived"; END IF;
    IF NEW."is_public" IS NULL AND NEW."isPublic" IS NOT NULL THEN NEW."is_public" := NEW."isPublic"; END IF;
    IF NEW."isPublic" IS NULL AND NEW."is_public" IS NOT NULL THEN NEW."isPublic" := NEW."is_public"; END IF;
    IF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN NEW."updated_at" := NEW."updatedAt"; END IF;
    IF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN NEW."updatedAt" := NEW."updated_at"; END IF;
    IF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN NEW."user_id" := NEW."userId"; END IF;
    IF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN NEW."userId" := NEW."user_id"; END IF;
  ELSE
    IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at" THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."created_at" IS DISTINCT FROM OLD."created_at" AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
      NEW."createdAt" := NEW."created_at";
    ELSIF NEW."created_at" IS NULL AND NEW."createdAt" IS NOT NULL THEN
      NEW."created_at" := NEW."createdAt";
    ELSIF NEW."createdAt" IS NULL AND NEW."created_at" IS NOT NULL THEN
      NEW."createdAt" := NEW."created_at";
    END IF;
    IF NEW."estimatedMinSec" IS DISTINCT FROM OLD."estimatedMinSec" AND NEW."estimated_min_sec" IS NOT DISTINCT FROM OLD."estimated_min_sec" THEN
      NEW."estimated_min_sec" := NEW."estimatedMinSec";
    ELSIF NEW."estimated_min_sec" IS DISTINCT FROM OLD."estimated_min_sec" AND NEW."estimatedMinSec" IS NOT DISTINCT FROM OLD."estimatedMinSec" THEN
      NEW."estimatedMinSec" := NEW."estimated_min_sec";
    ELSIF NEW."estimated_min_sec" IS NULL AND NEW."estimatedMinSec" IS NOT NULL THEN
      NEW."estimated_min_sec" := NEW."estimatedMinSec";
    ELSIF NEW."estimatedMinSec" IS NULL AND NEW."estimated_min_sec" IS NOT NULL THEN
      NEW."estimatedMinSec" := NEW."estimated_min_sec";
    END IF;
    IF NEW."isArchived" IS DISTINCT FROM OLD."isArchived" AND NEW."is_archived" IS NOT DISTINCT FROM OLD."is_archived" THEN
      NEW."is_archived" := NEW."isArchived";
    ELSIF NEW."is_archived" IS DISTINCT FROM OLD."is_archived" AND NEW."isArchived" IS NOT DISTINCT FROM OLD."isArchived" THEN
      NEW."isArchived" := NEW."is_archived";
    ELSIF NEW."is_archived" IS NULL AND NEW."isArchived" IS NOT NULL THEN
      NEW."is_archived" := NEW."isArchived";
    ELSIF NEW."isArchived" IS NULL AND NEW."is_archived" IS NOT NULL THEN
      NEW."isArchived" := NEW."is_archived";
    END IF;
    IF NEW."isPublic" IS DISTINCT FROM OLD."isPublic" AND NEW."is_public" IS NOT DISTINCT FROM OLD."is_public" THEN
      NEW."is_public" := NEW."isPublic";
    ELSIF NEW."is_public" IS DISTINCT FROM OLD."is_public" AND NEW."isPublic" IS NOT DISTINCT FROM OLD."isPublic" THEN
      NEW."isPublic" := NEW."is_public";
    ELSIF NEW."is_public" IS NULL AND NEW."isPublic" IS NOT NULL THEN
      NEW."is_public" := NEW."isPublic";
    ELSIF NEW."isPublic" IS NULL AND NEW."is_public" IS NOT NULL THEN
      NEW."isPublic" := NEW."is_public";
    END IF;
    IF NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt" AND NEW."updated_at" IS NOT DISTINCT FROM OLD."updated_at" THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updated_at" IS DISTINCT FROM OLD."updated_at" AND NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
      NEW."updatedAt" := NEW."updated_at";
    ELSIF NEW."updated_at" IS NULL AND NEW."updatedAt" IS NOT NULL THEN
      NEW."updated_at" := NEW."updatedAt";
    ELSIF NEW."updatedAt" IS NULL AND NEW."updated_at" IS NOT NULL THEN
      NEW."updatedAt" := NEW."updated_at";
    END IF;
    IF NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."user_id" IS NOT DISTINCT FROM OLD."user_id" THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."userId" IS NOT DISTINCT FROM OLD."userId" THEN
      NEW."userId" := NEW."user_id";
    ELSIF NEW."user_id" IS NULL AND NEW."userId" IS NOT NULL THEN
      NEW."user_id" := NEW."userId";
    ELSIF NEW."userId" IS NULL AND NEW."user_id" IS NOT NULL THEN
      NEW."userId" := NEW."user_id";
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_templates_camel_snake ON public.workout_templates;
CREATE TRIGGER trg_zdt_sync_workout_templates_camel_snake
BEFORE INSERT OR UPDATE ON public.workout_templates
FOR EACH ROW EXECUTE FUNCTION public.zdt_sync_workout_templates_camel_snake();

COMMIT;

-- Total mapping pairs: 211
