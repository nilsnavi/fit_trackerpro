"""Initial schema for FitTracker Pro

Revision ID: cd723942379e
Revises:
Create Date: 2026-03-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'cd723942379e'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ============================================
    # USERS TABLE
    # ============================================
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('telegram_id', sa.BigInteger(), nullable=False),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('first_name', sa.String(length=255), nullable=True),
        sa.Column('profile', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('settings', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('telegram_id')
    )
    op.create_index('ix_users_telegram_id', 'users',
                    ['telegram_id'], unique=False)
    op.create_index('ix_users_created_at', 'users',
                    ['created_at'], unique=False)
    op.create_index('ix_users_profile', 'users', [
                    'profile'], unique=False, postgresql_using='gin')
    op.create_index('ix_users_settings', 'users', [
                    'settings'], unique=False, postgresql_using='gin')

    # ============================================
    # EXERCISES TABLE
    # ============================================
    op.create_table(
        'exercises',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('equipment', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('muscle_groups', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('risk_flags', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('media_url', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=20),
                  server_default='active', nullable=False),
        sa.Column('author_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['author_user_id'], [
                                'users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_exercises_name', 'exercises', ['name'], unique=False)
    op.create_index('ix_exercises_category', 'exercises',
                    ['category'], unique=False)
    op.create_index('ix_exercises_status', 'exercises',
                    ['status'], unique=False)
    op.create_index('ix_exercises_author_user_id', 'exercises',
                    ['author_user_id'], unique=False)
    op.create_index('ix_exercises_created_at', 'exercises',
                    ['created_at'], unique=False)
    op.create_index('ix_exercises_equipment', 'exercises', [
                    'equipment'], unique=False, postgresql_using='gin')
    op.create_index('ix_exercises_muscle_groups', 'exercises', [
                    'muscle_groups'], unique=False, postgresql_using='gin')
    op.create_index('ix_exercises_risk_flags', 'exercises', [
                    'risk_flags'], unique=False, postgresql_using='gin')

    # ============================================
    # WORKOUT TEMPLATES TABLE
    # ============================================
    op.create_table(
        'workout_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('exercises', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('is_public', sa.Boolean(),
                  server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_workout_templates_user_id',
                    'workout_templates', ['user_id'], unique=False)
    op.create_index('ix_workout_templates_type',
                    'workout_templates', ['type'], unique=False)
    op.create_index('ix_workout_templates_is_public',
                    'workout_templates', ['is_public'], unique=False)
    op.create_index('ix_workout_templates_created_at',
                    'workout_templates', ['created_at'], unique=False)
    op.create_index('ix_workout_templates_exercises', 'workout_templates', [
                    'exercises'], unique=False, postgresql_using='gin')

    # ============================================
    # WORKOUT LOGS TABLE
    # ============================================
    op.create_table(
        'workout_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('exercises', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('tags', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('glucose_before', sa.Numeric(
            precision=5, scale=2), nullable=True),
        sa.Column('glucose_after', sa.Numeric(
            precision=5, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(
            ['template_id'], ['workout_templates.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_workout_logs_user_id',
                    'workout_logs', ['user_id'], unique=False)
    op.create_index('ix_workout_logs_template_id',
                    'workout_logs', ['template_id'], unique=False)
    op.create_index('ix_workout_logs_date',
                    'workout_logs', ['date'], unique=False)
    op.create_index('ix_workout_logs_user_date', 'workout_logs', [
                    'user_id', 'date'], unique=False)
    op.create_index('ix_workout_logs_exercises', 'workout_logs', [
                    'exercises'], unique=False, postgresql_using='gin')
    op.create_index('ix_workout_logs_tags', 'workout_logs', [
                    'tags'], unique=False, postgresql_using='gin')

    # ============================================
    # GLUCOSE LOGS TABLE
    # ============================================
    op.create_table(
        'glucose_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('workout_id', sa.Integer(), nullable=True),
        sa.Column('value', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('measurement_type', sa.String(length=50), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(
            ['workout_id'], ['workout_logs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_glucose_logs_user_id',
                    'glucose_logs', ['user_id'], unique=False)
    op.create_index('ix_glucose_logs_workout_id',
                    'glucose_logs', ['workout_id'], unique=False)
    op.create_index('ix_glucose_logs_timestamp',
                    'glucose_logs', ['timestamp'], unique=False)
    op.create_index('ix_glucose_logs_user_timestamp', 'glucose_logs', [
                    'user_id', 'timestamp'], unique=False)
    op.create_index('ix_glucose_logs_measurement_type',
                    'glucose_logs', ['measurement_type'], unique=False)

    # ============================================
    # DAILY WELLNESS TABLE
    # ============================================
    op.create_table(
        'daily_wellness',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('sleep_score', sa.Integer(), nullable=False),
        sa.Column('sleep_hours', sa.Numeric(
            precision=4, scale=1), nullable=True),
        sa.Column('energy_score', sa.Integer(), nullable=False),
        sa.Column('pain_zones', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('stress_level', sa.Integer(), nullable=True),
        sa.Column('mood_score', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'date')
    )
    op.create_index('ix_daily_wellness_user_id',
                    'daily_wellness', ['user_id'], unique=False)
    op.create_index('ix_daily_wellness_date',
                    'daily_wellness', ['date'], unique=False)
    op.create_index('ix_daily_wellness_sleep_score',
                    'daily_wellness', ['sleep_score'], unique=False)
    op.create_index('ix_daily_wellness_energy_score',
                    'daily_wellness', ['energy_score'], unique=False)
    op.create_index('ix_daily_wellness_pain_zones', 'daily_wellness', [
                    'pain_zones'], unique=False, postgresql_using='gin')

    # ============================================
    # ACHIEVEMENTS TABLE
    # ============================================
    op.create_table(
        'achievements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('icon_url', sa.String(length=500), nullable=True),
        sa.Column('condition', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('points', sa.Integer(), server_default='0', nullable=False),
        sa.Column('category', sa.String(length=50),
                  server_default='general', nullable=False),
        sa.Column('is_hidden', sa.Boolean(),
                  server_default='false', nullable=False),
        sa.Column('display_order', sa.Integer(),
                  server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_achievements_code',
                    'achievements', ['code'], unique=False)
    op.create_index('ix_achievements_category',
                    'achievements', ['category'], unique=False)
    op.create_index('ix_achievements_condition', 'achievements', [
                    'condition'], unique=False, postgresql_using='gin')
    op.create_index('ix_achievements_display_order',
                    'achievements', ['display_order'], unique=False)

    # ============================================
    # USER ACHIEVEMENTS TABLE
    # ============================================
    op.create_table(
        'user_achievements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('achievement_id', sa.Integer(), nullable=False),
        sa.Column('earned_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('progress', sa.Integer(),
                  server_default='0', nullable=False),
        sa.Column('progress_data', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(['achievement_id'], [
                                'achievements.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'achievement_id')
    )
    op.create_index('ix_user_achievements_user_id',
                    'user_achievements', ['user_id'], unique=False)
    op.create_index('ix_user_achievements_achievement_id',
                    'user_achievements', ['achievement_id'], unique=False)
    op.create_index('ix_user_achievements_earned_at',
                    'user_achievements', ['earned_at'], unique=False)
    op.create_index('ix_user_achievements_progress_data', 'user_achievements', [
                    'progress_data'], unique=False, postgresql_using='gin')

    # ============================================
    # CHALLENGES TABLE
    # ============================================
    op.create_table(
        'challenges',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('goal', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('is_public', sa.Boolean(),
                  server_default='false', nullable=False),
        sa.Column('join_code', sa.String(length=20), nullable=True),
        sa.Column('max_participants', sa.Integer(),
                  server_default='0', nullable=False),
        sa.Column('rules', postgresql.JSONB(
            astext_type=sa.Text()), nullable=False),
        sa.Column('banner_url', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=20),
                  server_default='upcoming', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(
            ['creator_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('join_code')
    )
    op.create_index('ix_challenges_creator_id', 'challenges',
                    ['creator_id'], unique=False)
    op.create_index('ix_challenges_type', 'challenges', ['type'], unique=False)
    op.create_index('ix_challenges_start_date', 'challenges',
                    ['start_date'], unique=False)
    op.create_index('ix_challenges_end_date', 'challenges',
                    ['end_date'], unique=False)
    op.create_index('ix_challenges_is_public', 'challenges',
                    ['is_public'], unique=False)
    op.create_index('ix_challenges_status', 'challenges',
                    ['status'], unique=False)
    op.create_index('ix_challenges_join_code', 'challenges',
                    ['join_code'], unique=False)
    op.create_index('ix_challenges_goal', 'challenges', [
                    'goal'], unique=False, postgresql_using='gin')
    op.create_index('ix_challenges_rules', 'challenges', [
                    'rules'], unique=False, postgresql_using='gin')

    # ============================================
    # EMERGENCY CONTACTS TABLE
    # ============================================
    op.create_table(
        'emergency_contacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('contact_name', sa.String(length=255), nullable=False),
        sa.Column('contact_username', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('relationship_type', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(),
                  server_default='true', nullable=False),
        sa.Column('notify_on_workout_start', sa.Boolean(),
                  server_default='false', nullable=False),
        sa.Column('notify_on_workout_end', sa.Boolean(),
                  server_default='false', nullable=False),
        sa.Column('notify_on_emergency', sa.Boolean(),
                  server_default='true', nullable=False),
        sa.Column('priority', sa.Integer(),
                  server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_emergency_contacts_user_id',
                    'emergency_contacts', ['user_id'], unique=False)
    op.create_index('ix_emergency_contacts_is_active',
                    'emergency_contacts', ['is_active'], unique=False)
    op.create_index('ix_emergency_contacts_priority',
                    'emergency_contacts', ['priority'], unique=False)

    # ============================================
    # TRIGGERS FOR UPDATED_AT
    # ============================================
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Apply triggers
    op.execute("""
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)
    op.execute("""
        CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)
    op.execute("""
        CREATE TRIGGER update_workout_templates_updated_at BEFORE UPDATE ON workout_templates
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)
    op.execute("""
        CREATE TRIGGER update_workout_logs_updated_at BEFORE UPDATE ON workout_logs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)
    op.execute("""
        CREATE TRIGGER update_daily_wellness_updated_at BEFORE UPDATE ON daily_wellness
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)
    op.execute("""
        CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)
    op.execute("""
        CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

    # ============================================
    # DEFAULT ACHIEVEMENTS
    # ============================================
    op.execute("""
        INSERT INTO achievements (code, name, description, condition, points, category, display_order) VALUES
        ('first_workout', 'Первые шаги', 'Выполните первую тренировку', '{"type": "workout_count", "target": 1}'::jsonb, 10, 'workouts', 1),
        ('workout_warrior_10', 'На старте', 'Выполните 10 тренировок', '{"type": "workout_count", "target": 10}'::jsonb, 50, 'workouts', 2),
        ('workout_warrior_50', 'Воин тренировок', 'Выполните 50 тренировок', '{"type": "workout_count", "target": 50}'::jsonb, 100, 'workouts', 3),
        ('workout_warrior_100', 'Центурион', 'Выполните 100 тренировок', '{"type": "workout_count", "target": 100}'::jsonb, 250, 'workouts', 4),
        ('workout_warrior_500', 'Легенда', 'Выполните 500 тренировок', '{"type": "workout_count", "target": 500}'::jsonb, 1000, 'workouts', 5),
        ('streak_7', 'Недельный воин', 'Поддерживайте 7-дневную серию тренировок', '{"type": "streak_days", "target": 7}'::jsonb, 50, 'streaks', 10),
        ('streak_30', 'Месячный мастер', 'Поддерживайте 30-дневную серию тренировок', '{"type": "streak_days", "target": 30}'::jsonb, 200, 'streaks', 11),
        ('streak_100', 'Непреклонный', 'Поддерживайте 100-дневную серию тренировок', '{"type": "streak_days", "target": 100}'::jsonb, 500, 'streaks', 12),
        ('calories_1000', 'Сжигатель калорий', 'Сожгите 1000 калорий всего', '{"type": "calories_burned", "target": 1000}'::jsonb, 25, 'workouts', 20),
        ('calories_10000', 'Король калорий', 'Сожгите 10000 калорий всего', '{"type": "calories_burned", "target": 10000}'::jsonb, 100, 'workouts', 21),
        ('calories_50000', 'Калорийный монстр', 'Сожгите 50000 калорий всего', '{"type": "calories_burned", "target": 50000}'::jsonb, 250, 'workouts', 22),
        ('glucose_tracker', 'Контроль глюкозы', 'Запишите уровень глюкозы 10 раз', '{"type": "glucose_logs", "target": 10}'::jsonb, 25, 'health', 30),
        ('wellness_logger', 'Забота о себе', 'Заполните дневник самочувствия 7 дней подряд', '{"type": "wellness_streak", "target": 7}'::jsonb, 50, 'health', 31),
        ('sleep_master', 'Мастер сна', 'Достигните оценки сна 90+ 5 раз', '{"type": "sleep_score", "target": 90, "count": 5}'::jsonb, 50, 'health', 32),
        ('challenge_creator', 'Организатор', 'Создайте свой первый челлендж', '{"type": "challenge_created", "target": 1}'::jsonb, 25, 'social', 40),
        ('template_sharer', 'Делитесь знаниями', 'Сделайте шаблон публичным', '{"type": "template_shared", "target": 1}'::jsonb, 25, 'social', 41);
    """)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('emergency_contacts')
    op.drop_table('challenges')
    op.drop_table('user_achievements')
    op.drop_table('achievements')
    op.drop_table('daily_wellness')
    op.drop_table('glucose_logs')
    op.drop_table('workout_logs')
    op.drop_table('workout_templates')
    op.drop_table('exercises')
    op.drop_table('users')
