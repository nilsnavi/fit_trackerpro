-- FitTracker Pro: recommended production indexes/extensions
-- Apply after core tables are created.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- NOTE:
-- Script is compatibility-aware for snake_case and legacy camelCase columns.
-- It creates the same index names against whichever column variant exists.

-- 1) Fast user session timeline (recent-first), excluding soft-deleted rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workout_sessions' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_started_desc ON workout_sessions (user_id, started_at DESC) WHERE deleted_at IS NULL';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workout_sessions' AND column_name = 'userId'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_started_desc ON workout_sessions ("userId", "startedAt" DESC) WHERE "deletedAt" IS NULL';
  END IF;
END $$;

-- 2) Pending sync queue by user.
-- Adaptive to naming variants across environments:
--   status: event_status OR sync_status
--   time:   created_at OR occurred_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sync_events' AND column_name = 'event_status'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sync_events' AND column_name = 'created_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sync_events_pending_by_user ON sync_events (user_id, created_at) WHERE event_status = ''PENDING''';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sync_events' AND column_name = 'occurred_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sync_events_pending_by_user ON sync_events (user_id, occurred_at) WHERE event_status = ''PENDING''';
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sync_events' AND column_name = 'sync_status'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sync_events' AND column_name = 'created_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sync_events_pending_by_user ON sync_events (user_id, created_at) WHERE sync_status = ''PENDING''';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sync_events' AND column_name = 'occurred_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sync_events_pending_by_user ON sync_events (user_id, occurred_at) WHERE sync_status = ''PENDING''';
    END IF;
  END IF;
END $$;

-- 3) Fuzzy alias search for exercise lookup.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exercise_aliases' AND column_name = 'normalized_alias'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_exercise_aliases_normalias_trgm ON exercise_aliases USING gin (normalized_alias gin_trgm_ops)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exercise_aliases' AND column_name = 'normalizedAlias'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_exercise_aliases_normalias_trgm ON exercise_aliases USING gin ("normalizedAlias" gin_trgm_ops)';
  END IF;
END $$;

-- 4) Feed index for visible and active posts.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_workout_posts' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_social_posts_feed ON social_workout_posts (created_at DESC) WHERE is_deleted = false AND visibility IN (''PUBLIC'', ''FRIENDS'')';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_workout_posts' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_social_posts_feed ON social_workout_posts ("createdAt" DESC) WHERE "isDeleted" = false AND visibility IN (''PUBLIC'', ''FRIENDS'')';
  END IF;
END $$;

-- 5) Latest personal records lookup by metric.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exercise_personal_records' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pr_user_exercise_metric_latest ON exercise_personal_records (user_id, exercise_id, metric, achieved_at DESC)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exercise_personal_records' AND column_name = 'userId'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pr_user_exercise_metric_latest ON exercise_personal_records ("userId", "exerciseId", metric, "achievedAt" DESC)';
  END IF;
END $$;

-- 6) Open recommendation queue.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'adaptive_recommendations' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_adaptive_reco_open ON adaptive_recommendations (user_id, created_at DESC) WHERE status IN (''PENDING'')';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'adaptive_recommendations' AND column_name = 'userId'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_adaptive_reco_open ON adaptive_recommendations ("userId", "createdAt" DESC) WHERE status IN (''PENDING'')';
  END IF;
END $$;

-- 7) Prevent duplicate unordered friendship pairs.
DO $$
BEGIN
  -- Disallow self-friendship.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'friendships'
      AND c.conname = 'chk_friendships_not_self'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'friendships' AND column_name = 'requester_id'
    ) THEN
      EXECUTE 'ALTER TABLE friendships ADD CONSTRAINT chk_friendships_not_self CHECK (requester_id <> addressee_id)';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'friendships' AND column_name = 'requesterId'
    ) THEN
      EXECUTE 'ALTER TABLE friendships ADD CONSTRAINT chk_friendships_not_self CHECK ("requesterId" <> "addresseeId")';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'friendships' AND column_name = 'requester_id'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_friendships_unordered_pair ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'friendships' AND column_name = 'requesterId'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_friendships_unordered_pair ON friendships (LEAST("requesterId", "addresseeId"), GREATEST("requesterId", "addresseeId"))';
  END IF;
END $$;

-- 8) Optional JSONB GIN indexes (NOT enabled by default for MVP).
-- Rationale: GIN on JSONB can increase RAM usage and write amplification.
-- Enable only when query patterns actually filter by JSON keys/paths.
--
-- To enable, set custom GUC before running this script:
--   SET app.enable_jsonb_gin_indexes = 'on';
DO $$
DECLARE
  enable_jsonb_gin boolean := COALESCE(current_setting('app.enable_jsonb_gin_indexes', true), 'off') = 'on';
BEGIN
  IF NOT enable_jsonb_gin THEN
    RAISE NOTICE 'Skipping optional JSONB GIN indexes (app.enable_jsonb_gin_indexes != on)';
    RETURN;
  END IF;

  -- sync_events.payload
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sync_events' AND column_name = 'payload'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sync_events_payload_gin ON sync_events USING gin (payload)';
  END IF;

  -- adaptive_recommendations.input_snapshot / inputSnapshot
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'adaptive_recommendations' AND column_name = 'input_snapshot'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_adaptive_reco_input_snapshot_gin ON adaptive_recommendations USING gin (input_snapshot)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'adaptive_recommendations' AND column_name = 'inputSnapshot'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_adaptive_reco_input_snapshot_gin ON adaptive_recommendations USING gin ("inputSnapshot")';
  END IF;
END $$;
