DO $$
DECLARE
  v_table_exists boolean;
  v_data_type text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = 'workout_sets'
  )
    INTO v_table_exists;

  -- Some environments still use legacy tables without workout_sets.
  IF NOT v_table_exists THEN
    RETURN;
  END IF;

  SELECT c.data_type
    INTO v_data_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'workout_sets'
    AND c.column_name = 'rir';

  IF v_data_type IS NULL THEN
    ALTER TABLE public.workout_sets
      ADD COLUMN rir NUMERIC(3, 1);
    RETURN;
  END IF;

  IF v_data_type <> 'numeric' THEN
    RAISE EXCEPTION 'public.workout_sets.rir has unexpected type: %', v_data_type;
  END IF;
END $$;
