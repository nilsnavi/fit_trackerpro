INSERT INTO public.feature_flags (key, enabled)
VALUES
  ('ai_insights', FALSE),
  ('muscle_imbalance_signals', FALSE),
  ('set_history_event_log', TRUE)
ON CONFLICT (key) DO NOTHING;
