CREATE TABLE IF NOT EXISTS public.set_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_set_id UUID,
  session_exercise_id UUID,
  event_type VARCHAR(16) NOT NULL,
  changed_by_user_id UUID,
  source_device_id VARCHAR(64),
  before_state JSONB,
  after_state JSONB,
  changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT set_history_event_type_check
    CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE')),
  CONSTRAINT set_history_payload_check
    CHECK (before_state IS NOT NULL OR after_state IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS set_history_workout_set_id_changed_at_idx
  ON public.set_history (workout_set_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS set_history_session_exercise_id_changed_at_idx
  ON public.set_history (session_exercise_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS set_history_changed_by_user_id_changed_at_idx
  ON public.set_history (changed_by_user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS set_history_event_type_changed_at_idx
  ON public.set_history (event_type, changed_at DESC);

CREATE INDEX IF NOT EXISTS set_history_changed_fields_gin_idx
  ON public.set_history USING GIN (changed_fields);

CREATE OR REPLACE FUNCTION public.capture_set_history_from_workout_sets()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_workout_set_id UUID;
  v_session_exercise_id UUID;
  v_changed_by_user_id UUID;
  v_source_device_id VARCHAR(64);
  v_old_state JSONB;
  v_new_state JSONB;
  v_changed_fields TEXT[];
BEGIN
  v_workout_set_id := COALESCE(NEW.id, OLD.id);
  v_session_exercise_id := COALESCE(NEW.session_exercise_id, OLD.session_exercise_id);

  SELECT ws.user_id, ws.source_device_id
    INTO v_changed_by_user_id, v_source_device_id
  FROM public.workout_session_exercises wse
  JOIN public.workout_sessions ws
    ON ws.id = wse.session_id
  WHERE wse.id = v_session_exercise_id
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_old_state := NULL;
    v_new_state := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_state := to_jsonb(OLD);
    v_new_state := to_jsonb(NEW);
  ELSE
    v_old_state := to_jsonb(OLD);
    v_new_state := NULL;
  END IF;

  SELECT COALESCE(array_agg(diff_key ORDER BY diff_key), ARRAY[]::TEXT[])
    INTO v_changed_fields
  FROM (
    SELECT key AS diff_key
    FROM jsonb_object_keys(
      COALESCE(v_old_state, '{}'::jsonb) || COALESCE(v_new_state, '{}'::jsonb)
    ) AS key
    WHERE key <> 'updated_at'
      AND (v_old_state->key) IS DISTINCT FROM (v_new_state->key)
  ) AS changed_keys;

  INSERT INTO public.set_history (
    workout_set_id,
    session_exercise_id,
    event_type,
    changed_by_user_id,
    source_device_id,
    before_state,
    after_state,
    changed_fields,
    changed_at
  )
  VALUES (
    v_workout_set_id,
    v_session_exercise_id,
    TG_OP,
    v_changed_by_user_id,
    v_source_device_id,
    v_old_state,
    v_new_state,
    v_changed_fields,
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_workout_sets_set_history ON public.workout_sets;

CREATE TRIGGER trg_workout_sets_set_history
AFTER INSERT OR UPDATE OR DELETE ON public.workout_sets
FOR EACH ROW
EXECUTE FUNCTION public.capture_set_history_from_workout_sets();
