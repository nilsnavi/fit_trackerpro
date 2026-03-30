-- Partial indexes for soft-deleted tables.
-- Goal: keep "active" rows fast to query when many deleted rows accumulate.

-- users: common lookups filter by deleted_at IS NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'deleted_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_active_telegram_user_id ON public.users (telegram_user_id) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_active_status_created_at ON public.users (status, created_at) WHERE deleted_at IS NULL';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'deletedAt'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_active_telegram_user_id ON public.users ("telegramUserId") WHERE "deletedAt" IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_active_status_created_at ON public.users (status, "createdAt") WHERE "deletedAt" IS NULL';
  END IF;
END $$;

-- workout_sessions: timeline queries excluding soft-deleted sessions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workout_sessions' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_started_desc ON public.workout_sessions (user_id, started_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_workout_sessions_active_status_started_desc ON public.workout_sessions (status, started_at DESC) WHERE deleted_at IS NULL';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workout_sessions' AND column_name = 'userId'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_started_desc ON public.workout_sessions ("userId", "startedAt" DESC) WHERE "deletedAt" IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_workout_sessions_active_status_started_desc ON public.workout_sessions (status, "startedAt" DESC) WHERE "deletedAt" IS NULL';
  END IF;
END $$;

-- social_workout_posts: feed + per-user listing excluding soft-deleted posts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_workout_posts' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_social_posts_feed ON public.social_workout_posts (created_at DESC) WHERE is_deleted = false AND visibility IN (''PUBLIC'', ''FRIENDS'')';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_social_posts_user_created_desc ON public.social_workout_posts (user_id, created_at DESC) WHERE is_deleted = false';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_workout_posts' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_social_posts_feed ON public.social_workout_posts ("createdAt" DESC) WHERE "isDeleted" = false AND visibility IN (''PUBLIC'', ''FRIENDS'')';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_social_posts_user_created_desc ON public.social_workout_posts ("userId", "createdAt" DESC) WHERE "isDeleted" = false';
  END IF;
END $$;

