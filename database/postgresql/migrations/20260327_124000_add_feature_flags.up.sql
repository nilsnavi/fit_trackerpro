CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(120) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS feature_flags_enabled_idx
  ON public.feature_flags (enabled);
