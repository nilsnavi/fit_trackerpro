CREATE OR REPLACE VIEW public.muscle_load_by_user AS
WITH set_facts AS (
  SELECT
    ws.user_id,
    date_trunc('day', ws.started_at)::date AS session_date,
    wse.exercise_id,
    wset.reps,
    wset.weight_kg,
    wset.rpe,
    wset.rir,
    wset.is_completed
  FROM public.workout_sets wset
  JOIN public.workout_session_exercises wse
    ON wse.id = wset.session_exercise_id
  JOIN public.workout_sessions ws
    ON ws.id = wse.session_id
  WHERE ws.deleted_at IS NULL
    AND ws.status = 'COMPLETED'
    AND wset.is_completed = TRUE
)
SELECT
  sf.user_id,
  sf.session_date,
  em.muscle_group,
  COUNT(*)::int AS set_count,
  COALESCE(SUM(sf.reps), 0)::int AS rep_count,
  COALESCE(SUM(COALESCE(sf.weight_kg, 0) * COALESCE(sf.reps, 0)), 0)::numeric(16, 3) AS raw_volume_kg,
  COALESCE(
    SUM(COALESCE(sf.weight_kg, 0) * COALESCE(sf.reps, 0) * em.load_factor),
    0
  )::numeric(16, 3) AS weighted_volume_kg,
  COALESCE(SUM(em.load_factor), 0)::numeric(12, 3) AS weighted_set_count,
  COALESCE(SUM(COALESCE(sf.reps, 0) * em.load_factor), 0)::numeric(16, 3) AS weighted_rep_count,
  ROUND(AVG(sf.rpe)::numeric, 2) AS avg_rpe,
  ROUND(AVG(sf.rir)::numeric, 2) AS avg_rir,
  MAX(sf.session_date) AS last_trained_date
FROM set_facts sf
JOIN public.exercise_muscles em
  ON em.exercise_id = sf.exercise_id
GROUP BY
  sf.user_id,
  sf.session_date,
  em.muscle_group;
