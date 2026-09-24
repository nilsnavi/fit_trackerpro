"""SPEC-006: progression engine (policies + recommendations)

Purely additive: two new tables, no existing column or row touched, so the
migration is backward-safe for running clients (workout history, Active Workout,
PR detection and analytics keep working unchanged).

Revision ID: n7o8p9q0r1s2
Revises: m5n6o7p8q9r0
Create Date: 2026-09-16 00:00:00.000000
"""

from alembic import op

revision = "n7o8p9q0r1s2"
down_revision = "m5n6o7p8q9r0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── SPEC-006 §6/§7: progression policies, scoped to program exercise slots ──
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS progression_policies (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
            template_id INTEGER NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
            template_exercise_id INTEGER NULL
                REFERENCES template_exercises(id) ON DELETE SET NULL,
            scope_key VARCHAR(64) NOT NULL,
            policy_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
            policy_version VARCHAR(32) NOT NULL DEFAULT 'MANUAL_V1',
            increment NUMERIC(6, 2) NULL,
            min_value NUMERIC(8, 2) NULL,
            max_value NUMERIC(8, 2) NULL,
            reps_min INTEGER NULL,
            reps_max INTEGER NULL,
            sets_target INTEGER NULL,
            target_rpe NUMERIC(3, 1) NULL,
            target_rir NUMERIC(3, 1) NULL,
            percent_1rm NUMERIC(5, 2) NULL,
            time_increment_seconds INTEGER NULL,
            time_target_seconds INTEGER NULL,
            time_priority VARCHAR(16) NULL,
            failure_threshold INTEGER NULL,
            deload_percent NUMERIC(5, 2) NULL,
            equipment_increment NUMERIC(6, 2) NULL,
            enabled BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_progression_policies_user_scope
                UNIQUE (user_id, scope_key),
            CONSTRAINT ck_progression_policies_type_allowed CHECK (
                policy_type IN (
                    'MANUAL', 'LINEAR', 'DOUBLE_PROGRESSION', 'RPE_BASED',
                    'RIR_BASED', 'PERCENT_1RM', 'TIME_PROGRESSION'
                )
            ),
            CONSTRAINT ck_progression_policies_time_priority_allowed CHECK (
                time_priority IS NULL
                OR time_priority IN ('TIME_FIRST', 'WEIGHT_FIRST')
            ),
            CONSTRAINT ck_progression_policies_reps_min
                CHECK (reps_min IS NULL OR reps_min >= 0),
            CONSTRAINT ck_progression_policies_reps_max
                CHECK (reps_max IS NULL OR reps_max >= 0),
            CONSTRAINT ck_progression_policies_sets_target_range
                CHECK (sets_target IS NULL OR (sets_target >= 1 AND sets_target <= 50)),
            CONSTRAINT ck_progression_policies_target_rpe_range
                CHECK (target_rpe IS NULL OR (target_rpe >= 1 AND target_rpe <= 10)),
            CONSTRAINT ck_progression_policies_target_rir_range
                CHECK (target_rir IS NULL OR (target_rir >= 0 AND target_rir <= 10)),
            CONSTRAINT ck_progression_policies_percent_1rm_range
                CHECK (percent_1rm IS NULL OR (percent_1rm > 0 AND percent_1rm <= 200)),
            CONSTRAINT ck_progression_policies_failure_threshold_range
                CHECK (
                    failure_threshold IS NULL
                    OR (failure_threshold >= 1 AND failure_threshold <= 20)
                ),
            CONSTRAINT ck_progression_policies_deload_percent_range
                CHECK (deload_percent IS NULL OR (deload_percent > 0 AND deload_percent <= 90)),
            CONSTRAINT ck_progression_policies_min_value
                CHECK (min_value IS NULL OR min_value >= 0),
            CONSTRAINT ck_progression_policies_max_value
                CHECK (max_value IS NULL OR max_value >= 0)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_policies_user_id "
        "ON progression_policies (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_policies_exercise_id "
        "ON progression_policies (exercise_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_policies_template_id "
        "ON progression_policies (template_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_policies_template_exercise_id "
        "ON progression_policies (template_exercise_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_policies_scope_key "
        "ON progression_policies (scope_key)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_policies_user_exercise "
        "ON progression_policies (user_id, exercise_id)"
    )

    # ── SPEC-006 §8–§10: persisted, explainable recommendations ─────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS progression_recommendations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
            template_id INTEGER NULL REFERENCES workout_templates(id) ON DELETE SET NULL,
            template_exercise_id INTEGER NULL
                REFERENCES template_exercises(id) ON DELETE SET NULL,
            scope_key VARCHAR(64) NOT NULL,
            policy_id INTEGER NULL
                REFERENCES progression_policies(id) ON DELETE SET NULL,
            policy_type VARCHAR(32) NOT NULL,
            policy_version VARCHAR(32) NOT NULL,
            status VARCHAR(24) NOT NULL,
            lifecycle_status VARCHAR(16) NOT NULL DEFAULT 'generated',
            previous_value NUMERIC(8, 2) NULL,
            recommended_value NUMERIC(8, 2) NULL,
            actual_selected_value NUMERIC(8, 2) NULL,
            difference NUMERIC(8, 2) NULL,
            previous_reps INTEGER NULL,
            recommended_reps INTEGER NULL,
            previous_duration INTEGER NULL,
            recommended_duration INTEGER NULL,
            reason_code VARCHAR(48) NOT NULL,
            reason_text VARCHAR(500) NOT NULL,
            confidence VARCHAR(8) NOT NULL DEFAULT 'low',
            failure_streak INTEGER NOT NULL DEFAULT 0,
            source_session_id INTEGER NULL REFERENCES workout_logs(id) ON DELETE SET NULL,
            decided_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_progression_recommendations_session_scope_version
                UNIQUE (source_session_id, scope_key, policy_version),
            CONSTRAINT ck_progression_recommendations_status CHECK (
                status IN (
                    'INCREASE', 'KEEP', 'DECREASE', 'DELOAD', 'MANUAL', 'INSUFFICIENT_DATA'
                )
            ),
            CONSTRAINT ck_progression_recommendations_lifecycle CHECK (
                lifecycle_status IN ('generated', 'accepted', 'modified', 'rejected', 'expired')
            ),
            CONSTRAINT ck_progression_recommendations_policy_type CHECK (
                policy_type IN (
                    'MANUAL', 'LINEAR', 'DOUBLE_PROGRESSION', 'RPE_BASED',
                    'RIR_BASED', 'PERCENT_1RM', 'TIME_PROGRESSION'
                )
            ),
            CONSTRAINT ck_progression_recommendations_confidence
                CHECK (confidence IN ('low', 'medium', 'high')),
            CONSTRAINT ck_progression_recommendations_previous_value
                CHECK (previous_value IS NULL OR previous_value >= 0),
            CONSTRAINT ck_progression_recommendations_recommended_value
                CHECK (recommended_value IS NULL OR recommended_value >= 0),
            CONSTRAINT ck_progression_recommendations_actual_value
                CHECK (actual_selected_value IS NULL OR actual_selected_value >= 0),
            CONSTRAINT ck_progression_recommendations_previous_reps
                CHECK (previous_reps IS NULL OR previous_reps >= 0),
            CONSTRAINT ck_progression_recommendations_previous_duration
                CHECK (previous_duration IS NULL OR previous_duration >= 0)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_recommendations_user_id "
        "ON progression_recommendations (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_recommendations_exercise_id "
        "ON progression_recommendations (exercise_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_recommendations_scope_created "
        "ON progression_recommendations (scope_key, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_recommendations_user_lifecycle "
        "ON progression_recommendations (user_id, lifecycle_status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_recommendations_source_session_id "
        "ON progression_recommendations (source_session_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progression_recommendations_status "
        "ON progression_recommendations (status)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS progression_recommendations")
    op.execute("DROP TABLE IF EXISTS progression_policies")
