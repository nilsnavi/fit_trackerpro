DO $$
DECLARE
  v_table_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = 'exercise_muscles'
  )
    INTO v_table_exists;

  IF NOT v_table_exists THEN
    CREATE TABLE public.exercise_muscles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      exercise_id UUID NOT NULL,
      muscle_group "MuscleGroup" NOT NULL,
      load_factor NUMERIC(4, 3) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT exercise_muscles_exercise_id_fkey
        FOREIGN KEY (exercise_id)
        REFERENCES public.exercises(id)
        ON DELETE CASCADE,
      CONSTRAINT exercise_muscles_load_factor_check
        CHECK (load_factor > 0 AND load_factor <= 1)
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS exercise_muscles_exercise_id_muscle_group_key
  ON public.exercise_muscles (exercise_id, muscle_group);

CREATE INDEX IF NOT EXISTS exercise_muscles_muscle_group_idx
  ON public.exercise_muscles (muscle_group);

CREATE INDEX IF NOT EXISTS exercise_muscles_exercise_id_load_factor_idx
  ON public.exercise_muscles (exercise_id, load_factor);

-- Backfill from legacy columns to unblock muscle load analytics for AI.
INSERT INTO public.exercise_muscles (exercise_id, muscle_group, load_factor)
SELECT
  e.id,
  e.primary_muscle,
  0.700
FROM public.exercises e
WHERE e.primary_muscle IS NOT NULL
ON CONFLICT (exercise_id, muscle_group)
DO UPDATE SET load_factor = EXCLUDED.load_factor;

INSERT INTO public.exercise_muscles (exercise_id, muscle_group, load_factor)
SELECT
  e.id,
  sm.muscle_group,
  0.300
FROM public.exercises e
CROSS JOIN LATERAL unnest(COALESCE(e.secondary_muscles, ARRAY[]::"MuscleGroup"[])) AS sm(muscle_group)
WHERE sm.muscle_group IS DISTINCT FROM e.primary_muscle
ON CONFLICT (exercise_id, muscle_group)
DO UPDATE SET load_factor = EXCLUDED.load_factor;
