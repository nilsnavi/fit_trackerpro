DO $$
DECLARE
  v_column_name text;
  v_data_type text;
  v_non_numeric_count bigint;
BEGIN
  SELECT c.column_name
    INTO v_column_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'users'
    AND c.column_name IN ('telegram_user_id', 'telegram_id')
  ORDER BY CASE WHEN c.column_name = 'telegram_user_id' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_column_name IS NULL THEN
    RETURN;
  END IF;

  SELECT c.data_type
    INTO v_data_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'users'
    AND c.column_name = v_column_name;

  -- Already migrated or missing column: nothing to do.
  IF v_data_type IS NULL OR v_data_type IN ('bigint', 'int8') THEN
    RETURN;
  END IF;

  IF v_data_type <> 'character varying' THEN
    IF v_data_type = 'text' THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'users.% has unexpected type: %', v_column_name, v_data_type;
    END IF;
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM public.users u WHERE u.%I IS NOT NULL AND u.%I !~ ''^[0-9]+$''',
    v_column_name,
    v_column_name
  )
    INTO v_non_numeric_count
  ;

  IF v_non_numeric_count > 0 THEN
    RAISE EXCEPTION 'Cannot cast users.% to BIGINT: % non-numeric rows found', v_column_name, v_non_numeric_count;
  END IF;

  EXECUTE format(
    'ALTER TABLE public.users ALTER COLUMN %I TYPE BIGINT USING %I::BIGINT',
    v_column_name,
    v_column_name
  );
END $$;
