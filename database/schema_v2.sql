-- FitTracker Pro Database Schema v2
-- PostgreSQL 14+ with JSONB support

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),

-- Profile data stored as JSONB
profile JSONB NOT NULL DEFAULT '{
        "equipment": [],
        "limitations": [],
        "goals": []
    }'::jsonb,

-- Settings stored as JSONB
settings JSONB NOT NULL DEFAULT '{
        "theme": "telegram",
        "notifications": true,
        "units": "metric"
    }'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Users indexes
CREATE INDEX idx_users_telegram_id ON users (telegram_id);

CREATE INDEX idx_users_created_at ON users (created_at);

CREATE INDEX idx_users_profile ON users USING GIN (profile);

CREATE INDEX idx_users_settings ON users USING GIN (settings);

-- ============================================
-- EXERCISES TABLE
-- ============================================
CREATE TABLE exercises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- strength, cardio, flexibility, balance, sport

-- Equipment needed stored as JSONB array
equipment JSONB NOT NULL DEFAULT '[]'::jsonb,

-- Muscle groups targeted stored as JSONB array
muscle_groups JSONB NOT NULL DEFAULT '[]'::jsonb,

-- Risk flags for users with limitations
risk_flags JSONB NOT NULL DEFAULT '{
        "high_blood_pressure": false,
        "diabetes": false,
        "joint_problems": false,
        "back_problems": false,
        "heart_conditions": false
    }'::jsonb,
    
    media_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, pending, archived
    author_user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Exercises indexes
CREATE INDEX idx_exercises_name ON exercises (name);

CREATE INDEX idx_exercises_category ON exercises (category);

CREATE INDEX idx_exercises_status ON exercises (status);

CREATE INDEX idx_exercises_author_user_id ON exercises (author_user_id);

CREATE INDEX idx_exercises_created_at ON exercises (created_at);

CREATE INDEX idx_exercises_equipment ON exercises USING GIN (equipment);

CREATE INDEX idx_exercises_muscle_groups ON exercises USING GIN (muscle_groups);

CREATE INDEX idx_exercises_risk_flags ON exercises USING GIN (risk_flags);

-- ============================================
-- WORKOUT TEMPLATES TABLE
-- ============================================
CREATE TABLE workout_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- cardio, strength, flexibility, mixed

-- Exercises stored as JSONB array
exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Workout templates indexes
CREATE INDEX idx_workout_templates_user_id ON workout_templates (user_id);

CREATE INDEX idx_workout_templates_type ON workout_templates (type);

CREATE INDEX idx_workout_templates_is_public ON workout_templates (is_public);

CREATE INDEX idx_workout_templates_created_at ON workout_templates (created_at);

CREATE INDEX idx_workout_templates_exercises ON workout_templates USING GIN (exercises);

-- ============================================
-- WORKOUT LOGS TABLE
-- ============================================
CREATE TABLE workout_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES workout_templates (id) ON DELETE SET NULL,
    date DATE NOT NULL,
    duration INTEGER, -- Duration in minutes

-- Completed exercises stored as JSONB
exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
comments TEXT,
tags JSONB NOT NULL DEFAULT '[]'::jsonb,

-- Glucose tracking for diabetic users
glucose_before NUMERIC(5, 2), -- mmol/L
    glucose_after NUMERIC(5, 2), -- mmol/L
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Workout logs indexes
CREATE INDEX idx_workout_logs_user_id ON workout_logs (user_id);

CREATE INDEX idx_workout_logs_template_id ON workout_logs (template_id);

CREATE INDEX idx_workout_logs_date ON workout_logs (date);

CREATE INDEX idx_workout_logs_user_date ON workout_logs (user_id, date);

CREATE INDEX idx_workout_logs_exercises ON workout_logs USING GIN (exercises);

CREATE INDEX idx_workout_logs_tags ON workout_logs USING GIN (tags);

-- ============================================
-- GLUCOSE LOGS TABLE
-- ============================================
CREATE TABLE glucose_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workout_id INTEGER REFERENCES workout_logs (id) ON DELETE CASCADE,
    value NUMERIC(5, 2) NOT NULL, -- mmol/L
    measurement_type VARCHAR(50) NOT NULL, -- fasting, pre_workout, post_workout, random, bedtime
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Glucose logs indexes
CREATE INDEX idx_glucose_logs_user_id ON glucose_logs (user_id);

CREATE INDEX idx_glucose_logs_workout_id ON glucose_logs (workout_id);

CREATE INDEX idx_glucose_logs_timestamp ON glucose_logs (timestamp);

CREATE INDEX idx_glucose_logs_user_timestamp ON glucose_logs (user_id, timestamp);

CREATE INDEX idx_glucose_logs_measurement_type ON glucose_logs (measurement_type);

-- ============================================
-- DAILY WELLNESS TABLE
-- ============================================
CREATE TABLE daily_wellness (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    date DATE NOT NULL,

-- Sleep tracking (0-100 scale)
sleep_score INTEGER NOT NULL CHECK (
    sleep_score >= 0
    AND sleep_score <= 100
),
sleep_hours NUMERIC(4, 1),

-- Energy level (0-100 scale)
energy_score INTEGER NOT NULL CHECK (
    energy_score >= 0
    AND energy_score <= 100
),

-- Pain tracking stored as JSONB
pain_zones JSONB NOT NULL DEFAULT '{
        "head": 0,
        "neck": 0,
        "shoulders": 0,
        "chest": 0,
        "back": 0,
        "arms": 0,
        "wrists": 0,
        "hips": 0,
        "knees": 0,
        "ankles": 0
    }'::jsonb,

-- Additional wellness metrics
stress_level INTEGER CHECK (stress_level >= 0 AND stress_level <= 10),
    mood_score INTEGER CHECK (mood_score >= 0 AND mood_score <= 100),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    UNIQUE (user_id, date)
);

-- Daily wellness indexes
CREATE INDEX idx_daily_wellness_user_id ON daily_wellness (user_id);

CREATE INDEX idx_daily_wellness_date ON daily_wellness (date);

CREATE INDEX idx_daily_wellness_user_date ON daily_wellness (user_id, date);

CREATE INDEX idx_daily_wellness_sleep_score ON daily_wellness (sleep_score);

CREATE INDEX idx_daily_wellness_energy_score ON daily_wellness (energy_score);

CREATE INDEX idx_daily_wellness_pain_zones ON daily_wellness USING GIN (pain_zones);

-- ============================================
-- ACHIEVEMENTS TABLE
-- ============================================
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    icon_url VARCHAR(500),

-- Condition stored as JSONB for flexible achievement criteria
condition JSONB NOT NULL,

-- Points awarded for unlocking
points INTEGER NOT NULL DEFAULT 0,

-- Achievement category
category VARCHAR(50) NOT NULL DEFAULT 'general', -- workouts, health, streaks, social
    
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Achievements indexes
CREATE INDEX idx_achievements_code ON achievements (code);

CREATE INDEX idx_achievements_category ON achievements (category);

CREATE INDEX idx_achievements_condition ON achievements USING GIN (condition);

CREATE INDEX idx_achievements_display_order ON achievements (display_order);

-- ============================================
-- USER ACHIEVEMENTS TABLE (Association)
-- ============================================
CREATE TABLE user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

-- Progress tracking (for multi-step achievements)
progress INTEGER NOT NULL DEFAULT 0,
    progress_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    UNIQUE (user_id, achievement_id)
);

-- User achievements indexes
CREATE INDEX idx_user_achievements_user_id ON user_achievements (user_id);

CREATE INDEX idx_user_achievements_achievement_id ON user_achievements (achievement_id);

CREATE INDEX idx_user_achievements_earned_at ON user_achievements (earned_at);

CREATE INDEX idx_user_achievements_progress_data ON user_achievements USING GIN (progress_data);

-- ============================================
-- CHALLENGES TABLE
-- ============================================
CREATE TABLE challenges (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- workout_count, duration, calories, distance, custom

-- Challenge goal stored as JSONB
goal JSONB NOT NULL,
start_date DATE NOT NULL,
end_date DATE NOT NULL,
is_public BOOLEAN NOT NULL DEFAULT FALSE,
join_code VARCHAR(20) UNIQUE,
max_participants INTEGER NOT NULL DEFAULT 0, -- 0 = unlimited

-- Challenge rules stored as JSONB
rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    banner_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming', -- upcoming, active, completed, cancelled
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Challenges indexes
CREATE INDEX idx_challenges_creator_id ON challenges (creator_id);

CREATE INDEX idx_challenges_type ON challenges (type);

CREATE INDEX idx_challenges_start_date ON challenges (start_date);

CREATE INDEX idx_challenges_end_date ON challenges (end_date);

CREATE INDEX idx_challenges_is_public ON challenges (is_public);

CREATE INDEX idx_challenges_status ON challenges (status);

CREATE INDEX idx_challenges_join_code ON challenges (join_code);

CREATE INDEX idx_challenges_goal ON challenges USING GIN (goal);

CREATE INDEX idx_challenges_rules ON challenges USING GIN (rules);

-- ============================================
-- EMERGENCY CONTACTS TABLE
-- ============================================
CREATE TABLE emergency_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    contact_name VARCHAR(255) NOT NULL,
    contact_username VARCHAR(255),
    phone VARCHAR(50),
    relationship_type VARCHAR(50), -- family, friend, doctor, trainer, other
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

-- Notification preferences
notify_on_workout_start BOOLEAN NOT NULL DEFAULT FALSE,
    notify_on_workout_end BOOLEAN NOT NULL DEFAULT FALSE,
    notify_on_emergency BOOLEAN NOT NULL DEFAULT TRUE,
    
    priority INTEGER NOT NULL DEFAULT 1, -- 1 = highest
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Emergency contacts indexes
CREATE INDEX idx_emergency_contacts_user_id ON emergency_contacts (user_id);

CREATE INDEX idx_emergency_contacts_is_active ON emergency_contacts (is_active);

CREATE INDEX idx_emergency_contacts_priority ON emergency_contacts (priority);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_templates_updated_at BEFORE UPDATE ON workout_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_logs_updated_at BEFORE UPDATE ON workout_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_wellness_updated_at BEFORE UPDATE ON daily_wellness
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT ACHIEVEMENTS
-- ============================================
INSERT INTO
    achievements (
        code,
        name,
        description,
        condition,
        points,
        category,
        display_order
    )
VALUES
    -- Workout achievements
    (
        'first_workout',
        'Первые шаги',
        'Выполните первую тренировку',
        '{"type": "workout_count", "target": 1}'::jsonb,
        10,
        'workouts',
        1
    ),
    (
        'workout_warrior_10',
        'На старте',
        'Выполните 10 тренировок',
        '{"type": "workout_count", "target": 10}'::jsonb,
        50,
        'workouts',
        2
    ),
    (
        'workout_warrior_50',
        'Воин тренировок',
        'Выполните 50 тренировок',
        '{"type": "workout_count", "target": 50}'::jsonb,
        100,
        'workouts',
        3
    ),
    (
        'workout_warrior_100',
        'Центурион',
        'Выполните 100 тренировок',
        '{"type": "workout_count", "target": 100}'::jsonb,
        250,
        'workouts',
        4
    ),
    (
        'workout_warrior_500',
        'Легенда',
        'Выполните 500 тренировок',
        '{"type": "workout_count", "target": 500}'::jsonb,
        1000,
        'workouts',
        5
    ),

-- Streak achievements
(
    'streak_7',
    'Недельный воин',
    'Поддерживайте 7-дневную серию тренировок',
    '{"type": "streak_days", "target": 7}'::jsonb,
    50,
    'streaks',
    10
),
(
    'streak_30',
    'Месячный мастер',
    'Поддерживайте 30-дневную серию тренировок',
    '{"type": "streak_days", "target": 30}'::jsonb,
    200,
    'streaks',
    11
),
(
    'streak_100',
    'Непреклонный',
    'Поддерживайте 100-дневную серию тренировок',
    '{"type": "streak_days", "target": 100}'::jsonb,
    500,
    'streaks',
    12
),

-- Calorie achievements
(
    'calories_1000',
    'Сжигатель калорий',
    'Сожгите 1000 калорий всего',
    '{"type": "calories_burned", "target": 1000}'::jsonb,
    25,
    'workouts',
    20
),
(
    'calories_10000',
    'Король калорий',
    'Сожгите 10000 калорий всего',
    '{"type": "calories_burned", "target": 10000}'::jsonb,
    100,
    'workouts',
    21
),
(
    'calories_50000',
    'Калорийный монстр',
    'Сожгите 50000 калорий всего',
    '{"type": "calories_burned", "target": 50000}'::jsonb,
    250,
    'workouts',
    22
),

-- Health tracking achievements
(
    'glucose_tracker',
    'Контроль глюкозы',
    'Запишите уровень глюкозы 10 раз',
    '{"type": "glucose_logs", "target": 10}'::jsonb,
    25,
    'health',
    30
),
(
    'wellness_logger',
    'Забота о себе',
    'Заполните дневник самочувствия 7 дней подряд',
    '{"type": "wellness_streak", "target": 7}'::jsonb,
    50,
    'health',
    31
),
(
    'sleep_master',
    'Мастер сна',
    'Достигните оценки сна 90+ 5 раз',
    '{"type": "sleep_score", "target": 90, "count": 5}'::jsonb,
    50,
    'health',
    32
),

-- Social achievements
(
    'challenge_creator',
    'Организатор',
    'Создайте свой первый челлендж',
    '{"type": "challenge_created", "target": 1}'::jsonb,
    25,
    'social',
    40
),
(
    'template_sharer',
    'Делитесь знаниями',
    'Сделайте шаблон публичным',
    '{"type": "template_shared", "target": 1}'::jsonb,
    25,
    'social',
    41
);

-- ============================================
-- COMMENTS ON TABLES
-- ============================================
COMMENT ON TABLE users IS 'Telegram users with profile and settings';

COMMENT ON TABLE exercises IS 'Exercise library with risk flags';

COMMENT ON TABLE workout_templates IS 'Reusable workout templates';

COMMENT ON TABLE workout_logs IS 'Completed workout records';

COMMENT ON TABLE glucose_logs IS 'Blood glucose tracking for diabetic users';

COMMENT ON TABLE daily_wellness IS 'Daily wellness and pain tracking';

COMMENT ON TABLE achievements IS 'System achievement definitions';

COMMENT ON TABLE user_achievements IS 'User unlocked achievements';

COMMENT ON TABLE challenges IS 'Fitness challenges';

COMMENT ON TABLE emergency_contacts IS 'Emergency contacts for safety features';