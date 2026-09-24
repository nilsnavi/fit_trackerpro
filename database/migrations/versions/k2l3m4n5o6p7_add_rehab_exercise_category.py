"""Add rehab exercise category

Revision ID: k2l3m4n5o6p7
Revises: j1k2l3m4n5o6
Create Date: 2026-05-04 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "k2l3m4n5o6p7"
down_revision = "j1k2l3m4n5o6"
branch_labels = None
depends_on = None


REHAB_EXERCISES_SQL = """
INSERT INTO exercises (
    slug, source, name, description, category,
    equipment, muscle_groups, risk_flags, media_url, status, author_user_id
)
VALUES
    (
        'rehab-diaphragmatic-breathing', 'system', 'Диафрагмальное дыхание лежа',
        'Мягкое дыхательное упражнение для расслабления корпуса и восстановления контроля дыхания. Выполняйте спокойно, без задержки дыхания и дискомфорта.',
        'rehab', '["none"]'::jsonb, '["abs","full_body"]'::jsonb,
        jsonb_build_object('high_blood_pressure', false, 'diabetes', false, 'joint_problems', false, 'back_problems', false, 'heart_conditions', false),
        NULL, 'active', NULL
    ),
    (
        'rehab-pelvic-tilt', 'system', 'Наклоны таза лежа',
        'ЛФК-упражнение для мягкой активации мышц кора и поясницы. Двигайтесь в безболезненном диапазоне, сохраняя ровное дыхание.',
        'rehab', '["yoga_mat"]'::jsonb, '["abs","lower_back","glutes"]'::jsonb,
        jsonb_build_object('high_blood_pressure', false, 'diabetes', false, 'joint_problems', false, 'back_problems', true, 'heart_conditions', false),
        NULL, 'active', NULL
    ),
    (
        'rehab-scapular-retraction', 'system', 'Сведение лопаток сидя',
        'Низкоинтенсивное упражнение для контроля положения лопаток и осанки. Сводите лопатки плавно, не поднимая плечи к ушам.',
        'rehab', '["none"]'::jsonb, '["back","traps","shoulders"]'::jsonb,
        jsonb_build_object('high_blood_pressure', false, 'diabetes', false, 'joint_problems', false, 'back_problems', false, 'heart_conditions', false),
        NULL, 'active', NULL
    ),
    (
        'rehab-heel-slides', 'system', 'Скольжение пяткой лежа',
        'Мягкое упражнение ЛФК для восстановления подвижности колена и тазобедренного сустава. Скользите пяткой по поверхности без резкой боли.',
        'rehab', '["none"]'::jsonb, '["quadriceps","hamstrings","hip_flexors"]'::jsonb,
        jsonb_build_object('high_blood_pressure', false, 'diabetes', false, 'joint_problems', true, 'back_problems', false, 'heart_conditions', false),
        NULL, 'active', NULL
    ),
    (
        'rehab-ankle-pumps', 'system', 'Движения стопой вверх-вниз',
        'Простое упражнение для голеностопа и икроножных мышц. Выполняйте плавные движения стопой вверх и вниз без задержки дыхания.',
        'rehab', '["none"]'::jsonb, '["calves"]'::jsonb,
        jsonb_build_object('high_blood_pressure', false, 'diabetes', false, 'joint_problems', false, 'back_problems', false, 'heart_conditions', false),
        NULL, 'active', NULL
    )
ON CONFLICT (slug) WHERE source = 'system' AND slug IS NOT NULL
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    equipment = EXCLUDED.equipment,
    muscle_groups = EXCLUDED.muscle_groups,
    risk_flags = EXCLUDED.risk_flags,
    media_url = EXCLUDED.media_url,
    status = EXCLUDED.status,
    source = 'system',
    author_user_id = NULL
"""


def upgrade() -> None:
    op.execute("ALTER TABLE exercises DROP CONSTRAINT IF EXISTS ck_exercises_category_allowed")
    op.execute(
        """
        ALTER TABLE exercises
        ADD CONSTRAINT ck_exercises_category_allowed
        CHECK (category IN ('strength','cardio','flexibility','balance','sport','rehab'))
        """
    )
    op.execute(
        """
        INSERT INTO ref_exercise_category (code, label, icon, sort_order, is_active, metadata)
        VALUES ('rehab', 'ЛФК', 'accessibility', 60, true, '{}'::jsonb)
        ON CONFLICT (code) DO UPDATE SET
            label = EXCLUDED.label,
            icon = EXCLUDED.icon,
            sort_order = EXCLUDED.sort_order,
            is_active = EXCLUDED.is_active
        """
    )
    op.execute(REHAB_EXERCISES_SQL)


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM exercises
        WHERE source = 'system'
          AND slug IN (
              'rehab-diaphragmatic-breathing',
              'rehab-pelvic-tilt',
              'rehab-scapular-retraction',
              'rehab-heel-slides',
              'rehab-ankle-pumps'
          )
        """
    )
    op.execute("UPDATE exercises SET category = 'flexibility' WHERE category = 'rehab'")
    op.execute("DELETE FROM ref_exercise_category WHERE code = 'rehab'")
    op.execute("ALTER TABLE exercises DROP CONSTRAINT IF EXISTS ck_exercises_category_allowed")
    op.execute(
        """
        ALTER TABLE exercises
        ADD CONSTRAINT ck_exercises_category_allowed
        CHECK (category IN ('strength','cardio','flexibility','balance','sport'))
        """
    )
