-- Read-only preflight checks before applying db integrity constraints migration.
-- Intended to be run manually against the target PostgreSQL database.
--
-- For fast signal, queries mostly return COUNT(*) or a small set of offending groups.

-- USERS: telegram_id must be positive
SELECT COUNT(*) AS invalid_users_telegram_id
FROM public.users
WHERE telegram_id <= 0;

-- EMERGENCY_CONTACTS: priority range
SELECT COUNT(*) AS invalid_emergency_contacts_priority
FROM public.emergency_contacts
WHERE priority < 1 OR priority > 10;

-- EMERGENCY_CONTACTS: contact_name non-empty (after trimming)
SELECT COUNT(*) AS blank_emergency_contacts_contact_name
FROM public.emergency_contacts
WHERE trim(contact_name) = '';

-- EMERGENCY_CONTACTS: must have at least one non-empty contact channel
SELECT COUNT(*) AS emergency_contacts_missing_contact_channel
FROM public.emergency_contacts
WHERE NOT (
  trim(COALESCE(contact_username, '')) <> ''
  OR trim(COALESCE(phone, '')) <> ''
);

-- EMERGENCY_CONTACTS: UNIQUE(user_id, contact_username) for non-null / non-empty usernames
SELECT
  user_id,
  contact_username,
  COUNT(*) AS duplicate_cnt
FROM public.emergency_contacts
WHERE contact_username IS NOT NULL AND trim(contact_username) <> ''
GROUP BY user_id, contact_username
HAVING COUNT(*) > 1
ORDER BY duplicate_cnt DESC, user_id;

-- EMERGENCY_CONTACTS: UNIQUE(user_id, phone) for non-null / non-empty phones
SELECT
  user_id,
  phone,
  COUNT(*) AS duplicate_cnt
FROM public.emergency_contacts
WHERE phone IS NOT NULL AND trim(phone) <> ''
GROUP BY user_id, phone
HAVING COUNT(*) > 1
ORDER BY duplicate_cnt DESC, user_id;

-- GLUCOSE_LOGS: value range
SELECT COUNT(*) AS invalid_glucose_logs_value
FROM public.glucose_logs
WHERE value < 2 OR value > 30;

-- GLUCOSE_LOGS: measurement_type allowed set
SELECT COUNT(*) AS invalid_glucose_logs_measurement_type
FROM public.glucose_logs
WHERE measurement_type NOT IN (
  'fasting',
  'pre_workout',
  'post_workout',
  'random',
  'bedtime'
);

-- WORKOUT_LOGS: duration in minutes when present
SELECT COUNT(*) AS invalid_workout_logs_duration
FROM public.workout_logs
WHERE duration IS NOT NULL AND (duration < 1 OR duration > 1440);

-- WORKOUT_LOGS: glucose_before in range when present
SELECT COUNT(*) AS invalid_workout_logs_glucose_before
FROM public.workout_logs
WHERE glucose_before IS NOT NULL
  AND (glucose_before < 2 OR glucose_before > 30);

-- WORKOUT_LOGS: glucose_after in range when present
SELECT COUNT(*) AS invalid_workout_logs_glucose_after
FROM public.workout_logs
WHERE glucose_after IS NOT NULL
  AND (glucose_after < 2 OR glucose_after > 30);

-- WORKOUT_TEMPLATES: type allowed set
SELECT COUNT(*) AS invalid_workout_templates_type
FROM public.workout_templates
WHERE type NOT IN ('cardio', 'strength', 'flexibility', 'mixed');

-- EXERCISES: category + status allowed sets
SELECT COUNT(*) AS invalid_exercises_category
FROM public.exercises
WHERE category NOT IN ('strength', 'cardio', 'flexibility', 'balance', 'sport');

SELECT COUNT(*) AS invalid_exercises_status
FROM public.exercises
WHERE status NOT IN ('active', 'pending', 'archived');

-- CHALLENGES: type, status allowed sets; max_participants upper bound
SELECT COUNT(*) AS invalid_challenges_type
FROM public.challenges
WHERE type NOT IN ('workout_count', 'duration', 'calories', 'distance', 'custom');

SELECT COUNT(*) AS invalid_challenges_status
FROM public.challenges
WHERE status NOT IN ('upcoming', 'active', 'completed', 'cancelled');

SELECT COUNT(*) AS invalid_challenges_max_participants
FROM public.challenges
WHERE max_participants > 1000000;

-- ACHIEVEMENTS: points non-negative
SELECT COUNT(*) AS invalid_achievements_points
FROM public.achievements
WHERE points < 0;

-- USER_ACHIEVEMENTS: progress non-negative
SELECT COUNT(*) AS invalid_user_achievements_progress
FROM public.user_achievements
WHERE progress < 0;

