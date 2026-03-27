CREATE OR REPLACE VIEW public.muscle_imbalance_signals_by_user AS
WITH user_muscle AS (
  SELECT
    m.user_id,
    m.session_date,
    m.muscle_group,
    m.weighted_volume_kg,
    m.weighted_set_count,
    m.avg_rpe,
    m.avg_rir
  FROM public.muscle_load_by_user m
),
aggregated AS (
  SELECT
    um.user_id,

    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 6 AND um.muscle_group = 'BACK'
    ), 0)::numeric(16, 3) AS back_volume_7d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 6 AND um.muscle_group = 'CHEST'
    ), 0)::numeric(16, 3) AS chest_volume_7d,

    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'BACK'
    ), 0)::numeric(16, 3) AS back_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'CHEST'
    ), 0)::numeric(16, 3) AS chest_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'SHOULDERS'
    ), 0)::numeric(16, 3) AS shoulders_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'TRICEPS'
    ), 0)::numeric(16, 3) AS triceps_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'BICEPS'
    ), 0)::numeric(16, 3) AS biceps_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'FOREARMS'
    ), 0)::numeric(16, 3) AS forearms_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'HAMSTRINGS'
    ), 0)::numeric(16, 3) AS hamstrings_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'QUADS'
    ), 0)::numeric(16, 3) AS quads_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'GLUTES'
    ), 0)::numeric(16, 3) AS glutes_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27 AND um.muscle_group = 'CORE'
    ), 0)::numeric(16, 3) AS core_volume_28d,
    COALESCE(SUM(um.weighted_volume_kg) FILTER (
      WHERE um.session_date >= current_date - 27
    ), 0)::numeric(16, 3) AS total_volume_28d,

    ROUND(
      SUM(COALESCE(um.avg_rpe, 0) * um.weighted_set_count) FILTER (
        WHERE um.session_date >= current_date - 6
      ) / NULLIF(SUM(um.weighted_set_count) FILTER (
        WHERE um.session_date >= current_date - 6
      ), 0),
      2
    )::numeric(4, 2) AS avg_rpe_7d,
    ROUND(
      SUM(COALESCE(um.avg_rir, 0) * um.weighted_set_count) FILTER (
        WHERE um.session_date >= current_date - 6
      ) / NULLIF(SUM(um.weighted_set_count) FILTER (
        WHERE um.session_date >= current_date - 6
      ), 0),
      2
    )::numeric(4, 2) AS avg_rir_7d,

    MAX(um.session_date) FILTER (WHERE um.muscle_group = 'BACK') AS last_back_session_date,
    MAX(um.session_date) FILTER (WHERE um.muscle_group = 'CHEST') AS last_chest_session_date
  FROM user_muscle um
  GROUP BY um.user_id
)
SELECT
  a.user_id,
  a.back_volume_7d,
  a.chest_volume_7d,
  a.back_volume_28d,
  a.chest_volume_28d,
  a.shoulders_volume_28d,
  a.triceps_volume_28d,
  a.biceps_volume_28d,
  a.forearms_volume_28d,
  a.hamstrings_volume_28d,
  a.quads_volume_28d,
  a.glutes_volume_28d,
  a.core_volume_28d,
  a.total_volume_28d,
  a.avg_rpe_7d,
  a.avg_rir_7d,

  ROUND(a.back_volume_28d / NULLIF(a.chest_volume_28d, 0), 3)::numeric(8, 3) AS back_vs_chest_ratio_28d,
  ROUND(
    (a.back_volume_28d + a.glutes_volume_28d + a.hamstrings_volume_28d) /
    NULLIF(a.chest_volume_28d + a.quads_volume_28d, 0),
    3
  )::numeric(8, 3) AS posterior_vs_anterior_ratio_28d,
  ROUND(
    (a.back_volume_28d + a.biceps_volume_28d + a.forearms_volume_28d) /
    NULLIF(a.chest_volume_28d + a.shoulders_volume_28d + a.triceps_volume_28d, 0),
    3
  )::numeric(8, 3) AS pull_vs_push_ratio_28d,
  ROUND(a.hamstrings_volume_28d / NULLIF(a.quads_volume_28d, 0), 3)::numeric(8, 3) AS hamstrings_vs_quads_ratio_28d,
  ROUND(a.core_volume_28d / NULLIF(a.total_volume_28d, 0), 3)::numeric(8, 3) AS core_share_ratio_28d,

  (current_date - a.last_back_session_date)::int AS days_since_back_session,
  (current_date - a.last_chest_session_date)::int AS days_since_chest_session,

  (
    a.back_volume_28d < (a.chest_volume_28d * 0.8)
    AND a.chest_volume_28d >= 200
  ) AS weak_back_signal,
  (
    (a.back_volume_28d + a.biceps_volume_28d + a.forearms_volume_28d) <
    ((a.chest_volume_28d + a.shoulders_volume_28d + a.triceps_volume_28d) * 0.85)
    AND (a.chest_volume_28d + a.shoulders_volume_28d + a.triceps_volume_28d) >= 300
  ) AS pull_underload_signal,
  (
    a.hamstrings_volume_28d < (a.quads_volume_28d * 0.7)
    AND a.quads_volume_28d >= 200
  ) AS posterior_leg_underload_signal
FROM aggregated a;
