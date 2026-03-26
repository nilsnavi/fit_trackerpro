-- Zero-downtime CONTRACT migration (safe finalize step)
-- Use only after:
-- 1) Expand migration is applied,
-- 2) app is deployed with Prisma @map("snake_case"),
-- 3) validate script confirms no drift.
--
-- This step intentionally removes dual-write triggers/functions only.
-- It does NOT drop legacy camelCase columns to avoid accidental loss of
-- legacy constraints/indexes that may still depend on those columns.
-- Hard cleanup should be done in a separate, audited migration.

BEGIN;

DROP TRIGGER IF EXISTS trg_zdt_sync_achievement_definitions_camel_snake ON public.achievement_definitions;
DROP FUNCTION IF EXISTS public.zdt_sync_achievement_definitions_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_adaptive_recommendations_camel_snake ON public.adaptive_recommendations;
DROP FUNCTION IF EXISTS public.zdt_sync_adaptive_recommendations_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_ai_coach_messages_camel_snake ON public.ai_coach_messages;
DROP FUNCTION IF EXISTS public.zdt_sync_ai_coach_messages_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_ai_insights_camel_snake ON public.ai_insights;
DROP FUNCTION IF EXISTS public.zdt_sync_ai_insights_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_challenge_participants_camel_snake ON public.challenge_participants;
DROP FUNCTION IF EXISTS public.zdt_sync_challenge_participants_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_challenges_camel_snake ON public.challenges;
DROP FUNCTION IF EXISTS public.zdt_sync_challenges_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_exercise_aliases_camel_snake ON public.exercise_aliases;
DROP FUNCTION IF EXISTS public.zdt_sync_exercise_aliases_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_exercise_personal_records_camel_snake ON public.exercise_personal_records;
DROP FUNCTION IF EXISTS public.zdt_sync_exercise_personal_records_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_exercises_camel_snake ON public.exercises;
DROP FUNCTION IF EXISTS public.zdt_sync_exercises_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_friendships_camel_snake ON public.friendships;
DROP FUNCTION IF EXISTS public.zdt_sync_friendships_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_rest_timer_events_camel_snake ON public.rest_timer_events;
DROP FUNCTION IF EXISTS public.zdt_sync_rest_timer_events_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_social_reactions_camel_snake ON public.social_reactions;
DROP FUNCTION IF EXISTS public.zdt_sync_social_reactions_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_social_workout_posts_camel_snake ON public.social_workout_posts;
DROP FUNCTION IF EXISTS public.zdt_sync_social_workout_posts_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_sync_events_camel_snake ON public.sync_events;
DROP FUNCTION IF EXISTS public.zdt_sync_sync_events_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_training_program_weeks_camel_snake ON public.training_program_weeks;
DROP FUNCTION IF EXISTS public.zdt_sync_training_program_weeks_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_training_program_workouts_camel_snake ON public.training_program_workouts;
DROP FUNCTION IF EXISTS public.zdt_sync_training_program_workouts_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_training_programs_camel_snake ON public.training_programs;
DROP FUNCTION IF EXISTS public.zdt_sync_training_programs_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_user_achievements_camel_snake ON public.user_achievements;
DROP FUNCTION IF EXISTS public.zdt_sync_user_achievements_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_user_profiles_camel_snake ON public.user_profiles;
DROP FUNCTION IF EXISTS public.zdt_sync_user_profiles_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_user_streaks_camel_snake ON public.user_streaks;
DROP FUNCTION IF EXISTS public.zdt_sync_user_streaks_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_users_camel_snake ON public.users;
DROP FUNCTION IF EXISTS public.zdt_sync_users_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_session_exercises_camel_snake ON public.workout_session_exercises;
DROP FUNCTION IF EXISTS public.zdt_sync_workout_session_exercises_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_sessions_camel_snake ON public.workout_sessions;
DROP FUNCTION IF EXISTS public.zdt_sync_workout_sessions_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_sets_camel_snake ON public.workout_sets;
DROP FUNCTION IF EXISTS public.zdt_sync_workout_sets_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_template_items_camel_snake ON public.workout_template_items;
DROP FUNCTION IF EXISTS public.zdt_sync_workout_template_items_camel_snake();
DROP TRIGGER IF EXISTS trg_zdt_sync_workout_templates_camel_snake ON public.workout_templates;
DROP FUNCTION IF EXISTS public.zdt_sync_workout_templates_camel_snake();

COMMIT;
