-- FitTracker Pro Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'en',
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User settings
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    daily_reminder_time TIME,
    weight_unit VARCHAR(10) DEFAULT 'kg',
    height_unit VARCHAR(10) DEFAULT 'cm',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workouts table
CREATE TABLE workouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (
        type IN (
            'cardio',
            'strength',
            'flexibility',
            'sports',
            'other'
        )
    ),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    calories_burned INTEGER,
    intensity VARCHAR(20) CHECK (
        intensity IN ('low', 'medium', 'high')
    ),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workout exercises (for strength training)
CREATE TABLE workout_exercises (
    id SERIAL PRIMARY KEY,
    workout_id INTEGER REFERENCES workouts (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sets INTEGER,
    reps INTEGER,
    weight DECIMAL(10, 2),
    weight_unit VARCHAR(10) DEFAULT 'kg',
    duration_seconds INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Health metrics table
CREATE TABLE health_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL CHECK (
        metric_type IN (
            'weight',
            'steps',
            'heart_rate',
            'sleep',
            'water',
            'calories',
            'blood_pressure',
            'body_fat'
        )
    ),
    value DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User goals
CREATE TABLE user_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL CHECK (
        goal_type IN (
            'weight_loss',
            'weight_gain',
            'maintain',
            'workout_count',
            'steps',
            'custom'
        )
    ),
    target_value DECIMAL(10, 2),
    current_value DECIMAL(10, 2),
    unit VARCHAR(20),
    start_date DATE NOT NULL,
    target_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Achievements table
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    requirement_type VARCHAR(50) NOT NULL,
    requirement_value INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User achievements
CREATE TABLE user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements (id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, achievement_id)
);

-- Indexes for better performance
CREATE INDEX idx_users_telegram_id ON users (telegram_id);

CREATE INDEX idx_workouts_user_id ON workouts (user_id);

CREATE INDEX idx_workouts_started_at ON workouts (started_at);

CREATE INDEX idx_health_metrics_user_id ON health_metrics (user_id);

CREATE INDEX idx_health_metrics_type ON health_metrics (metric_type);

CREATE INDEX idx_health_metrics_recorded_at ON health_metrics (recorded_at);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON workouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_goals_updated_at BEFORE UPDATE ON user_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default achievements
INSERT INTO
    achievements (
        code,
        name,
        description,
        requirement_type,
        requirement_value
    )
VALUES (
        'first_workout',
        'First Steps',
        'Complete your first workout',
        'workout_count',
        1
    ),
    (
        'workout_warrior_10',
        'Getting Started',
        'Complete 10 workouts',
        'workout_count',
        10
    ),
    (
        'workout_warrior_50',
        'Workout Warrior',
        'Complete 50 workouts',
        'workout_count',
        50
    ),
    (
        'workout_warrior_100',
        'Centurion',
        'Complete 100 workouts',
        'workout_count',
        100
    ),
    (
        'streak_7',
        'Week Warrior',
        'Maintain a 7-day workout streak',
        'streak_days',
        7
    ),
    (
        'streak_30',
        'Monthly Master',
        'Maintain a 30-day workout streak',
        'streak_days',
        30
    ),
    (
        'calories_1000',
        'Calorie Crusher',
        'Burn 1000 calories in total',
        'calories_burned',
        1000
    ),
    (
        'calories_10000',
        'Calorie King',
        'Burn 10000 calories in total',
        'calories_burned',
        10000
    );