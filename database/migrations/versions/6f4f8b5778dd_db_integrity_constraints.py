"""db_integrity_constraints

Revision ID: 6f4f8b5778dd
Revises: f1a2b3c4d5e6
Create Date: 2026-03-30 10:26:06.699478

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6f4f8b5778dd'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- users ---
    op.create_check_constraint(
        "ck_users_telegram_id_positive",
        "users",
        "telegram_id > 0",
    )

    # --- emergency_contacts ---
    op.create_unique_constraint(
        "uq_emergency_contacts_user_contact_username",
        "emergency_contacts",
        ["user_id", "contact_username"],
    )
    op.create_unique_constraint(
        "uq_emergency_contacts_user_phone",
        "emergency_contacts",
        ["user_id", "phone"],
    )
    op.create_check_constraint(
        "ck_emergency_contacts_priority_range",
        "emergency_contacts",
        "priority >= 1 AND priority <= 10",
    )
    op.create_check_constraint(
        "ck_emergency_contacts_contact_name_not_blank",
        "emergency_contacts",
        "trim(contact_name) <> ''",
    )
    op.create_check_constraint(
        "ck_emergency_contacts_has_contact_channel",
        "emergency_contacts",
        "(trim(COALESCE(contact_username, '')) <> '' OR trim(COALESCE(phone, '')) <> '')",
    )

    # --- glucose_logs ---
    op.create_check_constraint(
        "ck_glucose_logs_value_range",
        "glucose_logs",
        "value >= 2 AND value <= 30",
    )
    op.create_check_constraint(
        "ck_glucose_logs_measurement_type_allowed",
        "glucose_logs",
        "measurement_type IN ('fasting','pre_workout','post_workout','random','bedtime')",
    )

    # --- workout_logs ---
    op.create_check_constraint(
        "ck_workout_logs_duration_range",
        "workout_logs",
        "duration IS NULL OR (duration >= 1 AND duration <= 1440)",
    )
    op.create_check_constraint(
        "ck_workout_logs_glucose_before_range",
        "workout_logs",
        "glucose_before IS NULL OR (glucose_before >= 2 AND glucose_before <= 30)",
    )
    op.create_check_constraint(
        "ck_workout_logs_glucose_after_range",
        "workout_logs",
        "glucose_after IS NULL OR (glucose_after >= 2 AND glucose_after <= 30)",
    )

    # --- workout_templates ---
    op.create_check_constraint(
        "ck_workout_templates_type_allowed",
        "workout_templates",
        "type IN ('cardio','strength','flexibility','mixed')",
    )

    # --- exercises ---
    op.create_check_constraint(
        "ck_exercises_category_allowed",
        "exercises",
        "category IN ('strength','cardio','flexibility','balance','sport')",
    )
    op.create_check_constraint(
        "ck_exercises_status_allowed",
        "exercises",
        "status IN ('active','pending','archived')",
    )

    # --- challenges ---
    op.create_check_constraint(
        "ck_challenges_type_allowed",
        "challenges",
        "type IN ('workout_count','duration','calories','distance','custom')",
    )
    op.create_check_constraint(
        "ck_challenges_status_allowed",
        "challenges",
        "status IN ('upcoming','active','completed','cancelled')",
    )
    op.create_check_constraint(
        "ck_challenges_max_participants_upper",
        "challenges",
        "max_participants <= 1000000",
    )

    # --- achievements ---
    op.create_check_constraint(
        "ck_achievements_points_non_negative",
        "achievements",
        "points >= 0",
    )

    # --- user_achievements ---
    op.create_check_constraint(
        "ck_user_achievements_progress_non_negative",
        "user_achievements",
        "progress >= 0",
    )


def downgrade() -> None:
    # Note: drop order matters for dependencies, but these are independent constraints.
    op.drop_constraint(
        "ck_user_achievements_progress_non_negative",
        "user_achievements",
        type_="check",
    )
    op.drop_constraint(
        "ck_achievements_points_non_negative",
        "achievements",
        type_="check",
    )

    op.drop_constraint(
        "ck_challenges_max_participants_upper",
        "challenges",
        type_="check",
    )
    op.drop_constraint(
        "ck_challenges_status_allowed",
        "challenges",
        type_="check",
    )
    op.drop_constraint(
        "ck_challenges_type_allowed",
        "challenges",
        type_="check",
    )

    op.drop_constraint(
        "ck_exercises_status_allowed",
        "exercises",
        type_="check",
    )
    op.drop_constraint(
        "ck_exercises_category_allowed",
        "exercises",
        type_="check",
    )

    op.drop_constraint(
        "ck_workout_templates_type_allowed",
        "workout_templates",
        type_="check",
    )

    op.drop_constraint(
        "ck_workout_logs_glucose_after_range",
        "workout_logs",
        type_="check",
    )
    op.drop_constraint(
        "ck_workout_logs_glucose_before_range",
        "workout_logs",
        type_="check",
    )
    op.drop_constraint(
        "ck_workout_logs_duration_range",
        "workout_logs",
        type_="check",
    )

    op.drop_constraint(
        "ck_glucose_logs_measurement_type_allowed",
        "glucose_logs",
        type_="check",
    )
    op.drop_constraint(
        "ck_glucose_logs_value_range",
        "glucose_logs",
        type_="check",
    )

    op.drop_constraint(
        "ck_emergency_contacts_has_contact_channel",
        "emergency_contacts",
        type_="check",
    )
    op.drop_constraint(
        "ck_emergency_contacts_contact_name_not_blank",
        "emergency_contacts",
        type_="check",
    )
    op.drop_constraint(
        "ck_emergency_contacts_priority_range",
        "emergency_contacts",
        type_="check",
    )

    op.drop_constraint(
        "uq_emergency_contacts_user_phone",
        "emergency_contacts",
        type_="unique",
    )
    op.drop_constraint(
        "uq_emergency_contacts_user_contact_username",
        "emergency_contacts",
        type_="unique",
    )

    op.drop_constraint(
        "ck_users_telegram_id_positive",
        "users",
        type_="check",
    )
