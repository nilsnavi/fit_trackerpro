export type paths = {
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Root
         * @description JSON for API clients. Telegram Mini App / browser document loads are redirected to
         *     ``TELEGRAM_WEBAPP_URL`` so a misconfigured WebApp URL on the API host still opens the UI.
         */
        get: operations["root__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Analytics Dashboard */
        get: operations["get_analytics_dashboard_api_v1_analytics__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/achievements/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Achievements */
        get: operations["get_achievements_api_v1_analytics_achievements__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/achievements/leaderboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Achievements Leaderboard */
        get: operations["get_achievements_leaderboard_api_v1_analytics_achievements_leaderboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/achievements/user": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get User Achievements */
        get: operations["get_user_achievements_api_v1_analytics_achievements_user_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/achievements/user/{achievement_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get User Achievement Detail */
        get: operations["get_user_achievement_detail_api_v1_analytics_achievements_user__achievement_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/achievements/{achievement_id}/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Claim Achievement */
        post: operations["claim_achievement_api_v1_analytics_achievements__achievement_id__claim_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/calendar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Workout Calendar */
        get: operations["get_workout_calendar_api_v1_analytics_calendar_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/challenges/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Challenges */
        get: operations["get_challenges_api_v1_analytics_challenges__get"];
        put?: never;
        /** Create Challenge */
        post: operations["create_challenge_api_v1_analytics_challenges__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/challenges/my/active": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get My Active Challenges */
        get: operations["get_my_active_challenges_api_v1_analytics_challenges_my_active_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/challenges/{challenge_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Challenge */
        get: operations["get_challenge_api_v1_analytics_challenges__challenge_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/challenges/{challenge_id}/join": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Join Challenge */
        post: operations["join_challenge_api_v1_analytics_challenges__challenge_id__join_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/challenges/{challenge_id}/leaderboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Challenge Leaderboard */
        get: operations["get_challenge_leaderboard_api_v1_analytics_challenges__challenge_id__leaderboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/challenges/{challenge_id}/leave": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Leave Challenge */
        post: operations["leave_challenge_api_v1_analytics_challenges__challenge_id__leave_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Export Data */
        post: operations["export_data_api_v1_analytics_export_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/export/{export_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Export Status */
        get: operations["get_export_status_api_v1_analytics_export__export_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/muscle-load": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Muscle Load */
        get: operations["get_muscle_load_api_v1_analytics_muscle_load_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/muscle-load/table": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Muscle Load Table */
        get: operations["get_muscle_load_table_api_v1_analytics_muscle_load_table_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/muscle-signals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Muscle Imbalance Signals */
        get: operations["get_muscle_imbalance_signals_api_v1_analytics_muscle_signals_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/performance-overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Analytics Performance Overview */
        get: operations["get_analytics_performance_overview_api_v1_analytics_performance_overview_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Exercise Progress */
        get: operations["get_exercise_progress_api_v1_analytics_progress_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/progress-insights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Progress Insights */
        get: operations["get_progress_insights_api_v1_analytics_progress_insights_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/recovery-state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Recovery State */
        get: operations["get_recovery_state_api_v1_analytics_recovery_state_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/recovery-state/recalculate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Recalculate Recovery State */
        post: operations["recalculate_recovery_state_api_v1_analytics_recovery_state_recalculate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Analytics Summary */
        get: operations["get_analytics_summary_api_v1_analytics_summary_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/training-load/daily": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Daily Training Load */
        get: operations["get_daily_training_load_api_v1_analytics_training_load_daily_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/training-load/daily/table": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Daily Training Load Table */
        get: operations["get_daily_training_load_table_api_v1_analytics_training_load_daily_table_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/workout-summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Workout Post Summary */
        get: operations["get_workout_post_summary_api_v1_analytics_workout_summary_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/workouts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Analytics Workouts
         * @description Сводка тренировок для аналитики (тот же payload, что и GET /analytics/).
         */
        get: operations["get_analytics_workouts_api_v1_analytics_workouts_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exercises/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Exercises */
        get: operations["get_exercises_api_v1_exercises__get"];
        put?: never;
        /** Create Exercise */
        post: operations["create_exercise_api_v1_exercises__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exercises/by-slugs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Exercises By Slugs
         * @description Resolve exercise slugs to IDs. Used by goal-based program presets.
         */
        get: operations["get_exercises_by_slugs_api_v1_exercises_by_slugs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exercises/categories/list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Exercise Categories */
        get: operations["get_exercise_categories_api_v1_exercises_categories_list_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exercises/custom": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Custom Exercise Multipart
         * @description Compatibility endpoint for the frontend `AddExercise` form.
         *
         *     The UI submits a multipart/form-data payload with JSON-encoded arrays in some fields.
         *     For MVP we accept the payload and create a pending exercise. Media storage is not
         *     implemented yet; file is accepted but ignored.
         */
        post: operations["create_custom_exercise_multipart_api_v1_exercises_custom_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exercises/equipment/list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Equipment List */
        get: operations["get_equipment_list_api_v1_exercises_equipment_list_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exercises/muscle-groups/list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Muscle Groups */
        get: operations["get_muscle_groups_api_v1_exercises_muscle_groups_list_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exercises/{exercise_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Exercise */
        get: operations["get_exercise_api_v1_exercises__exercise_id__get"];
        /** Update Exercise */
        put: operations["update_exercise_api_v1_exercises__exercise_id__put"];
        post?: never;
        /** Delete Exercise */
        delete: operations["delete_exercise_api_v1_exercises__exercise_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exercises/{exercise_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve Exercise */
        post: operations["approve_exercise_api_v1_exercises__exercise_id__approve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health-metrics/glucose": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Glucose History */
        get: operations["get_glucose_history_api_v1_health_metrics_glucose_get"];
        put?: never;
        /** Create Glucose Log */
        post: operations["create_glucose_log_api_v1_health_metrics_glucose_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health-metrics/glucose/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Glucose Stats */
        get: operations["get_glucose_stats_api_v1_health_metrics_glucose_stats_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health-metrics/glucose/{log_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Glucose Log */
        get: operations["get_glucose_log_api_v1_health_metrics_glucose__log_id__get"];
        put?: never;
        post?: never;
        /** Delete Glucose Log */
        delete: operations["delete_glucose_log_api_v1_health_metrics_glucose__log_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health-metrics/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Health Stats */
        get: operations["get_health_stats_api_v1_health_metrics_stats_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health-metrics/wellness": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Wellness History */
        get: operations["get_wellness_history_api_v1_health_metrics_wellness_get"];
        put?: never;
        /** Create Wellness Entry */
        post: operations["create_wellness_entry_api_v1_health_metrics_wellness_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health-metrics/wellness/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Wellness Stats */
        get: operations["get_wellness_stats_api_v1_health_metrics_wellness_stats_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health-metrics/wellness/{entry_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Wellness Entry */
        get: operations["get_wellness_entry_api_v1_health_metrics_wellness__entry_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/emergency/contact": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Emergency Contacts */
        get: operations["get_emergency_contacts_api_v1_system_emergency_contact_get"];
        put?: never;
        /** Create Emergency Contact */
        post: operations["create_emergency_contact_api_v1_system_emergency_contact_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/emergency/contact/{contact_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Emergency Contact */
        get: operations["get_emergency_contact_api_v1_system_emergency_contact__contact_id__get"];
        /** Update Emergency Contact */
        put: operations["update_emergency_contact_api_v1_system_emergency_contact__contact_id__put"];
        post?: never;
        /** Delete Emergency Contact */
        delete: operations["delete_emergency_contact_api_v1_system_emergency_contact__contact_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/emergency/log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Log Emergency Event */
        post: operations["log_emergency_event_api_v1_system_emergency_log_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/emergency/notify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send Emergency Notification */
        post: operations["send_emergency_notification_api_v1_system_emergency_notify_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/emergency/notify/workout-end": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Notify Workout End */
        post: operations["notify_workout_end_api_v1_system_emergency_notify_workout_end_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/emergency/notify/workout-start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Notify Workout Start */
        post: operations["notify_workout_start_api_v1_system_emergency_notify_workout_start_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/emergency/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Emergency Settings */
        get: operations["get_emergency_settings_api_v1_system_emergency_settings_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** System health check (legacy) */
        get: operations["system_health_check"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness probe (container is running)
         * @description Liveness probe for container orchestration.
         *     Returns 200 if the application process is running.
         *     Used by Docker/Kubernetes to determine if container should be restarted.
         */
        get: operations["liveness_probe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Readiness probe (PostgreSQL, Redis)
         * @description Readiness probe for load balancers and orchestrators.
         *     Проверяет PostgreSQL (``SELECT 1`` через async-сессию) и Redis (``PING`` через общий async-клиент).
         *
         *     HTTP 200 только при ``status == "ready"``; иначе 503 с ``status == "degraded"`` и телом проверок.
         */
        get: operations["readiness_probe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/version": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Service version and build metadata */
        get: operations["system_version"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create User
         * @description Create or update user from Telegram data
         */
        post: operations["create_user_api_v1_users__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Logout */
        post: operations["logout_api_v1_users_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/auth/lookup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Lookup Telegram Registration */
        post: operations["lookup_telegram_registration_api_v1_users_auth_lookup_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Current User Info */
        get: operations["get_current_user_info_api_v1_users_auth_me_get"];
        /** Update User Profile */
        put: operations["update_user_profile_api_v1_users_auth_me_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/auth/onboarding": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Save Onboarding */
        post: operations["save_onboarding_api_v1_users_auth_onboarding_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Refresh Token */
        post: operations["refresh_token_api_v1_users_auth_refresh_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register Via Telegram
         * @description First-time registration: validates initData and returns JWT (same as POST /telegram).
         */
        post: operations["register_via_telegram_api_v1_users_auth_register_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/auth/telegram": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Authenticate Telegram */
        post: operations["authenticate_telegram_api_v1_users_auth_telegram_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/coach-access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Coach Access
         * @description Coach access sharing is not implemented yet.
         *     Keep the endpoint to avoid breaking the profile UI.
         */
        get: operations["list_coach_access_api_v1_users_coach_access_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/coach-access/generate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Generate Coach Access
         * @description Generate a short-lived share code (stub for MVP UI wiring).
         */
        post: operations["generate_coach_access_api_v1_users_coach_access_generate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/coach-access/{access_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke Coach Access */
        delete: operations["revoke_coach_access_api_v1_users_coach_access__access_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export User Data
         * @description Simple JSON export for the current UI contract (`usersApi.exportData()` expects a Blob).
         */
        get: operations["export_user_data_api_v1_users_export_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Current User Profile
         * @description Current user profile (same contract as ``/users/auth/me``).
         */
        get: operations["get_current_user_profile_api_v1_users_me_get"];
        put?: never;
        post?: never;
        /**
         * Delete Current User
         * @description Delete the authenticated user account.
         */
        delete: operations["delete_current_user_api_v1_users_me_delete"];
        options?: never;
        head?: never;
        /**
         * Patch Current User Profile
         * @description Partial profile update.
         */
        patch: operations["patch_current_user_profile_api_v1_users_me_patch"];
        trace?: never;
    };
    "/api/v1/users/me/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get User Stats
         * @description Lightweight user stats for `ProfilePage`.
         *
         *     The frontend expects:
         *       { active_days, total_workouts, current_streak, longest_streak, total_duration, total_calories }
         *
         *     For MVP we map from analytics summary; calories are not tracked yet.
         */
        get: operations["get_user_stats_api_v1_users_me_stats_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get User Stats
         * @description Lightweight user stats for `ProfilePage`.
         *
         *     The frontend expects:
         *       { active_days, total_workouts, current_streak, longest_streak, total_duration, total_calories }
         *
         *     For MVP we map from analytics summary; calories are not tracked yet.
         */
        get: operations["get_user_stats_api_v1_users_stats_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get User
         * @description Get user by ID
         */
        get: operations["get_user_api_v1_users__user_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/calendar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Workouts Calendar Month
         * @description Compatibility endpoint for the current frontend calendar page.
         *
         *     Returns a flat list of workouts in the selected month (frontend groups by day).
         */
        get: operations["get_workouts_calendar_month_api_v1_workouts_calendar_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Complete Workout */
        post: operations["complete_workout_api_v1_workouts_complete_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Workout History */
        get: operations["get_workout_history_api_v1_workouts_history_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/history/{workout_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Workout Detail */
        get: operations["get_workout_detail_api_v1_workouts_history__workout_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update Active Workout */
        patch: operations["update_active_workout_api_v1_workouts_history__workout_id__patch"];
        trace?: never;
    };
    "/api/v1/workouts/sessions/{session_id}/exercises/{exercise_id}/weight-recommendation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Weight Recommendation
         * @description Возвращает рекомендацию по весу для следующего подхода на основе RPE последнего подхода.
         */
        get: operations["get_weight_recommendation_api_v1_workouts_sessions__session_id__exercises__exercise_id__weight_recommendation_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start Workout */
        post: operations["start_workout_api_v1_workouts_start_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/start/from-template/{template_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start Workout From Template With Overrides */
        post: operations["start_workout_from_template_with_overrides_api_v1_workouts_start_from_template__template_id__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Workout Templates */
        get: operations["get_workout_templates_api_v1_workouts_templates_get"];
        put?: never;
        /** Create Workout Template */
        post: operations["create_workout_template_api_v1_workouts_templates_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/templates/from-workout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Workout Template From Workout */
        post: operations["create_workout_template_from_workout_api_v1_workouts_templates_from_workout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/templates/{template_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Workout Template */
        get: operations["get_workout_template_api_v1_workouts_templates__template_id__get"];
        /** Update Workout Template */
        put: operations["update_workout_template_api_v1_workouts_templates__template_id__put"];
        post?: never;
        /** Delete Workout Template */
        delete: operations["delete_workout_template_api_v1_workouts_templates__template_id__delete"];
        options?: never;
        head?: never;
        /** Patch Workout Template */
        patch: operations["patch_workout_template_api_v1_workouts_templates__template_id__patch"];
        trace?: never;
    };
    "/api/v1/workouts/templates/{template_id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Archive Workout Template */
        post: operations["archive_workout_template_api_v1_workouts_templates__template_id__archive_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/templates/{template_id}/clone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Clone Workout Template */
        post: operations["clone_workout_template_api_v1_workouts_templates__template_id__clone_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workouts/templates/{template_id}/unarchive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Unarchive Workout Template */
        post: operations["unarchive_workout_template_api_v1_workouts_templates__template_id__unarchive_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness probe (container is running)
         * @description Liveness probe for container orchestration.
         *     Returns 200 if the application process is running.
         *     Used by Docker/Kubernetes to determine if container should be restarted.
         */
        get: operations["app_liveness_health_live_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Readiness probe (PostgreSQL, Redis)
         * @description Readiness probe (алиас ``/health/ready``): PostgreSQL и Redis.
         *     HTTP 200 только при ``status == "ready"``; иначе 503 с ``status == "degraded"`` и телом проверок.
         */
        get: operations["app_readiness_health_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/telegram/webhook": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Telegram Webhook
         * @description Handle incoming Telegram webhook updates
         *
         *     This endpoint receives updates from Telegram when using webhook mode.
         *     Only used in production environment.
         */
        post: operations["telegram_webhook_telegram_webhook_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        /**
         * AchievementCondition
         * @description Achievement unlock condition (JSONB in DB).
         */
        AchievementCondition: {
            /** Count */
            count?: number | null;
            /** Description */
            description?: string | null;
            /** Target */
            target: number;
            /** Type */
            type: string;
        } & {
            [key: string]: unknown;
        };
        /** AchievementLeaderboardEntry */
        AchievementLeaderboardEntry: {
            /** Achievements Count */
            achievements_count: number;
            /** First Name */
            first_name: string | null;
            /** Rank */
            rank: number;
            /** Total Points */
            total_points: number;
            /** User Id */
            user_id: number;
            /** Username */
            username: string | null;
        };
        /** AchievementLeaderboardResponse */
        AchievementLeaderboardResponse: {
            /** Leaderboard */
            leaderboard: components["schemas"]["AchievementLeaderboardEntry"][];
            /** Total Users */
            total_users: number;
            /** User Points */
            user_points: number;
            /** User Rank */
            user_rank: number;
        };
        /**
         * AchievementListResponse
         * @description List of achievements response
         */
        AchievementListResponse: {
            /** Categories */
            categories: string[];
            /** Items */
            items: components["schemas"]["AchievementResponse"][];
            /** Total */
            total: number;
        };
        /**
         * AchievementProgressData
         * @description Progress payload for a user achievement (JSONB).
         */
        AchievementProgressData: {
            /** Current */
            current?: number | null;
            /** Target */
            target?: number | null;
        } & {
            [key: string]: unknown;
        };
        /**
         * AchievementResponse
         * @description Achievement response
         */
        AchievementResponse: {
            /** Category */
            category: string;
            /** Code */
            code: string;
            condition: components["schemas"]["AchievementCondition"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Description */
            description: string;
            /** Display Order */
            display_order: number;
            /** Icon Url */
            icon_url: string | null;
            /** Id */
            id: number;
            /** Is Hidden */
            is_hidden: boolean;
            /** Name */
            name: string;
            /** Points */
            points: number;
        };
        /**
         * AchievementUnlockResponse
         * @description Achievement unlock response
         */
        AchievementUnlockResponse: {
            achievement: components["schemas"]["AchievementResponse"] | null;
            /** Message */
            message: string;
            /** New Total Points */
            new_total_points: number;
            /** Points Earned */
            points_earned: number;
            /** Unlocked */
            unlocked: boolean;
        };
        /**
         * AnalyticsDashboardResponse
         * @description Aggregated analytics for the main dashboard (period filter).
         */
        AnalyticsDashboardResponse: {
            /**
             * Avg Duration
             * @description Mean workout duration in minutes within the selected period.
             */
            avg_duration: number;
            /**
             * Avg Rest Time Seconds
             * @description Mean actual_rest_seconds across sets where rest was tracked.
             */
            avg_rest_time_seconds?: number | null;
            /**
             * Avg Rpe Per Workout
             * @description Mean of per-workout average RPE (only sets with RPE logged).
             */
            avg_rpe_per_workout?: number | null;
            /**
             * Avg Rpe Previous Period
             * @description Same metric for the immediately preceding period of equal length.
             */
            avg_rpe_previous_period?: number | null;
            /**
             * Avg Rpe Trend
             * @description up | down | flat when both current and previous period have RPE data.
             */
            avg_rpe_trend?: string | null;
            /**
             * Favorite Exercise
             * @description Most frequent exercise name in the selected period.
             */
            favorite_exercise?: string | null;
            /**
             * Intensity Score
             * @description avg_rpe × (sets_count / avg_rest_minutes); None if rest or RPE insufficient.
             */
            intensity_score?: number | null;
            /**
             * Intensity Weekly Chart
             * @description Intensity score by ISO week (for longer windows).
             */
            intensity_weekly_chart?: components["schemas"]["AnalyticsIntensityWeekPoint"][];
            /**
             * Period
             * @description Echo of requested window: week | month | all.
             */
            period: string;
            /**
             * Streak Days
             * @description Current consecutive-day workout streak (today or yesterday counts as active).
             */
            streak_days: number;
            /** Total Duration Minutes */
            total_duration_minutes: number;
            /**
             * Total Time Under Tension Seconds
             * @description Sum of (completed_at - started_at) in seconds where both timestamps exist.
             */
            total_time_under_tension_seconds?: number | null;
            /** Total Workouts */
            total_workouts: number;
            /**
             * Weekly Chart
             * @description Workout counts by day or by ISO week start within the chart window.
             */
            weekly_chart?: components["schemas"]["AnalyticsWeeklyChartPoint"][];
            /**
             * Workouts This Month
             * @description Workouts logged in the current calendar month.
             */
            workouts_this_month: number;
            /**
             * Workouts This Week
             * @description Workouts logged in the current calendar week (Mon–Sun).
             */
            workouts_this_week: number;
            /**
             * Workouts With Rpe Count
             * @description Number of completed workouts in the window that logged at least one RPE value.
             * @default 0
             */
            workouts_with_rpe_count: number;
        };
        /**
         * AnalyticsIntensityWeekPoint
         * @description Weekly aggregate for custom intensity score chart.
         */
        AnalyticsIntensityWeekPoint: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /**
             * Intensity Score
             * @description avg_rpe × (completed_sets / avg_rest_minutes) for sets in the ISO week starting at date.
             */
            intensity_score?: number | null;
        };
        /**
         * AnalyticsPerformanceOverviewResponse
         * @description Overview metrics for volume, frequency, progress over time and estimated 1RM.
         */
        AnalyticsPerformanceOverviewResponse: {
            /** Active Days */
            active_days: number;
            /** Average Volume Per Workout */
            average_volume_per_workout: number;
            /** Average Workouts Per Week */
            average_workouts_per_week: number;
            /** Baseline Estimated 1Rm */
            baseline_estimated_1rm?: number | null;
            /** Current Estimated 1Rm */
            current_estimated_1rm?: number | null;
            /**
             * Date From
             * Format: date
             */
            date_from: string;
            /**
             * Date To
             * Format: date
             */
            date_to: string;
            /** Estimated 1Rm Progress Pct */
            estimated_1rm_progress_pct?: number | null;
            /** Period */
            period: string;
            /** Total Volume */
            total_volume: number;
            /** Total Workouts */
            total_workouts: number;
            /** Trend */
            trend?: components["schemas"]["AnalyticsPerformanceTrendPoint"][];
        };
        /**
         * AnalyticsPerformanceTrendPoint
         * @description Daily trend point for high-level performance analytics.
         */
        AnalyticsPerformanceTrendPoint: {
            /** Best Estimated 1Rm */
            best_estimated_1rm?: number | null;
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Total Volume */
            total_volume: number;
            /** Workout Count */
            workout_count: number;
        };
        /**
         * AnalyticsSummaryResponse
         * @description Analytics summary response
         */
        AnalyticsSummaryResponse: {
            /** Current Streak */
            current_streak: number;
            /** Favorite Exercises */
            favorite_exercises: components["schemas"]["FavoriteExercise"][];
            /** Longest Streak */
            longest_streak: number;
            /** Monthly Average */
            monthly_average: number;
            muscle_imbalance_signals?: components["schemas"]["MuscleImbalanceSignalsDetail"] | null;
            /** Personal Records */
            personal_records: components["schemas"]["PersonalRecord"][];
            /** Total Duration */
            total_duration: number;
            /** Total Exercises */
            total_exercises: number;
            /** Total Workouts */
            total_workouts: number;
            /** Weekly Average */
            weekly_average: number;
        };
        /**
         * AnalyticsWeeklyChartPoint
         * @description Single point for workout frequency chart (day or week bucket).
         */
        AnalyticsWeeklyChartPoint: {
            /** Count */
            count: number;
            /**
             * Date
             * Format: date
             */
            date: string;
        };
        /**
         * AuthResponse
         * @description Authentication response
         */
        AuthResponse: {
            /** Access Token */
            access_token?: string | null;
            /**
             * Expires In
             * @description Token expiration in seconds
             */
            expires_in?: number | null;
            /**
             * Is New User
             * @description True when user has been created during this auth request.
             * @default false
             */
            is_new_user: boolean;
            /** Message */
            message: string;
            /**
             * Onboarding Required
             * @description True when onboarding form should be shown to the user.
             * @default false
             */
            onboarding_required: boolean;
            /**
             * Refresh Token
             * @description Refresh token; optional for backward compatibility.
             */
            refresh_token?: string | null;
            /** Success */
            success: boolean;
            /**
             * Token
             * @description JWT access token (Mini App / camelCase alias of access_token).
             */
            token?: string | null;
            /**
             * Token Type
             * @default bearer
             */
            token_type: string;
            user?: components["schemas"]["TelegramUserData"] | null;
        };
        /** Body_create_custom_exercise_multipart_api_v1_exercises_custom_post */
        Body_create_custom_exercise_multipart_api_v1_exercises_custom_post: {
            /** Category */
            category: string;
            /**
             * Description
             * @default
             */
            description: string;
            /**
             * Difficulty
             * @default beginner
             */
            difficulty: string;
            /**
             * Equipment
             * @default []
             */
            equipment: string;
            /** Media */
            media?: string | null;
            /** Name */
            name: string;
            /**
             * Risks
             * @default []
             */
            risks: string;
            /**
             * Target Muscles
             * @default []
             */
            target_muscles: string;
        };
        /**
         * CalendarDayEntry
         * @description Single day entry for workout calendar
         */
        CalendarDayEntry: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /**
             * Glucose Logged
             * @default false
             */
            glucose_logged: boolean;
            /** Has Workout */
            has_workout: boolean;
            /**
             * Total Duration
             * @default 0
             */
            total_duration: number;
            /**
             * Wellness Logged
             * @default false
             */
            wellness_logged: boolean;
            /**
             * Workout Count
             * @default 0
             */
            workout_count: number;
            /** Workout Types */
            workout_types?: string[];
        };
        /**
         * ChallengeCreate
         * @description Request model for creating challenge
         */
        ChallengeCreate: {
            /**
             * Banner Url
             * @description URL to banner image.
             */
            banner_url?: string | null;
            /** Description */
            description?: string | null;
            /**
             * End Date
             * Format: date
             */
            end_date: string;
            goal: components["schemas"]["ChallengeGoal"];
            /**
             * Is Public
             * @default false
             */
            is_public: boolean;
            /**
             * Max Participants
             * @description 0 = unlimited participants.
             * @default 0
             */
            max_participants: number;
            /**
             * Name
             * @description Challenge title.
             */
            name: string;
            rules?: components["schemas"]["ChallengeRules"];
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /** @description Challenge scoring mode. */
            type: components["schemas"]["ChallengeType"];
        };
        /**
         * ChallengeDetailResponse
         * @description Challenge detail response with participants
         */
        ChallengeDetailResponse: {
            /** Banner Url */
            banner_url: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Creator Id */
            creator_id: number;
            /** Creator Name */
            creator_name: string | null;
            /** Current Participants */
            current_participants: number;
            /** Description */
            description: string | null;
            /**
             * End Date
             * Format: date
             */
            end_date: string;
            goal: components["schemas"]["ChallengeGoal"];
            /** Id */
            id: number;
            /** Is Public */
            is_public: boolean;
            /** Join Code */
            join_code: string | null;
            /** Max Participants */
            max_participants: number;
            /** Name */
            name: string;
            /** Participants */
            participants: components["schemas"]["ChallengeParticipant"][];
            rules: components["schemas"]["ChallengeRules"];
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /** Status */
            status: string;
            /** Type */
            type: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** User Progress */
            user_progress?: number | null;
            /** User Rank */
            user_rank?: number | null;
        };
        /**
         * ChallengeGoal
         * @description Challenge goal criteria
         */
        ChallengeGoal: {
            /**
             * Description
             * @description Optional human-readable goal text.
             */
            description?: string | null;
            /**
             * Target
             * @description Target value to achieve (must be positive).
             */
            target: number;
            /**
             * Type
             * @description Goal discriminator, e.g. count, duration, distance.
             */
            type: string;
            /**
             * Unit
             * @description Unit of measurement (e.g. kg, km, kcal).
             */
            unit: string;
        };
        /**
         * ChallengeJoinResponse
         * @description Challenge join response
         */
        ChallengeJoinResponse: {
            /** Challenge Id */
            challenge_id: number;
            /**
             * Joined At
             * Format: date-time
             */
            joined_at: string;
            /** Message */
            message: string;
            /** Participant Count */
            participant_count: number;
            /** Success */
            success: boolean;
        };
        /**
         * ChallengeLeaderboardEntry
         * @description Leaderboard entry
         */
        ChallengeLeaderboardEntry: {
            /** Completion Percentage */
            completion_percentage: number;
            /** First Name */
            first_name: string | null;
            /** Last Activity */
            last_activity: string | null;
            /** Progress */
            progress: number;
            /** Rank */
            rank: number;
            /** User Id */
            user_id: number;
            /** Username */
            username: string | null;
        };
        /**
         * ChallengeLeaderboardResponse
         * @description Challenge leaderboard response
         */
        ChallengeLeaderboardResponse: {
            /** Challenge Id */
            challenge_id: number;
            /** Entries */
            entries: components["schemas"]["ChallengeLeaderboardEntry"][];
            /** Total Participants */
            total_participants: number;
            /** User Rank */
            user_rank: number | null;
        };
        /**
         * ChallengeLeaveResponse
         * @description Challenge leave response
         */
        ChallengeLeaveResponse: {
            /** Challenge Id */
            challenge_id: number;
            /** Message */
            message: string;
            /** Success */
            success: boolean;
        };
        /**
         * ChallengeListFilters
         * @description Echo of list query parameters (for clients and OpenAPI).
         */
        ChallengeListFilters: {
            /** Is Public */
            is_public?: boolean | null;
            /**
             * Mine
             * @description When true, only challenges created by the current user are listed.
             */
            mine?: boolean | null;
            /** Status */
            status?: string | null;
            /** Type */
            type?: string | null;
        };
        /**
         * ChallengeListResponse
         * @description List of challenges response
         */
        ChallengeListResponse: {
            filters?: components["schemas"]["ChallengeListFilters"];
            /** Items */
            items: components["schemas"]["ChallengeResponse"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Total */
            total: number;
        };
        /**
         * ChallengeMyActiveResponse
         * @description Current user's active challenges
         */
        ChallengeMyActiveResponse: {
            /** Items */
            items: components["schemas"]["ChallengeResponse"][];
            /** Total */
            total: number;
        };
        /**
         * ChallengeParticipant
         * @description Challenge participant info
         */
        ChallengeParticipant: {
            /** First Name */
            first_name: string | null;
            /**
             * Joined At
             * Format: date-time
             */
            joined_at: string;
            /** Progress */
            progress: number;
            /** Rank */
            rank: number | null;
            /** User Id */
            user_id: number;
            /** Username */
            username: string | null;
        };
        /**
         * ChallengeResponse
         * @description Challenge response
         */
        ChallengeResponse: {
            /** Banner Url */
            banner_url: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Creator Id */
            creator_id: number;
            /** Creator Name */
            creator_name: string | null;
            /** Current Participants */
            current_participants: number;
            /** Description */
            description: string | null;
            /**
             * End Date
             * Format: date
             */
            end_date: string;
            goal: components["schemas"]["ChallengeGoal"];
            /** Id */
            id: number;
            /** Is Public */
            is_public: boolean;
            /** Join Code */
            join_code: string | null;
            /** Max Participants */
            max_participants: number;
            /** Name */
            name: string;
            rules: components["schemas"]["ChallengeRules"];
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /** Status */
            status: string;
            /** Type */
            type: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * ChallengeRules
         * @description Challenge rules
         */
        ChallengeRules: {
            /**
             * Allowed Workout Types
             * @description Allowed workout types; each entry up to 32 chars.
             */
            allowed_workout_types?: string[] | null;
            /**
             * Excluded Exercises
             * @description Exercise IDs to exclude from the challenge.
             */
            excluded_exercises?: number[] | null;
            /**
             * Max Workouts Per Day
             * @description Cap on workouts per day.
             */
            max_workouts_per_day?: number | null;
            /**
             * Min Workouts Per Week
             * @description Minimum weekly workouts (0–21).
             */
            min_workouts_per_week?: number | null;
        };
        /**
         * ChallengeType
         * @enum {string}
         */
        ChallengeType: "workout_count" | "duration" | "calories" | "distance" | "custom";
        /**
         * CompletedExercise
         * @description Completed exercise data
         */
        "CompletedExercise-Input": {
            /** Exercise Id */
            exercise_id: number;
            /** Name */
            name: string;
            /** Notes */
            notes?: string | null;
            /**
             * Sets Completed
             * @description Recorded sets (max 100 per exercise).
             */
            sets_completed: components["schemas"]["CompletedSet-Input"][];
        };
        /**
         * CompletedExercise
         * @description Completed exercise data
         */
        "CompletedExercise-Output": {
            /** Exercise Id */
            exercise_id: number;
            /** Name */
            name: string;
            /** Notes */
            notes?: string | null;
            /**
             * Sets Completed
             * @description Recorded sets (max 100 per exercise).
             */
            sets_completed: components["schemas"]["CompletedSet-Output"][];
        };
        /**
         * CompletedSet
         * @description Completed set data
         */
        "CompletedSet-Input": {
            /**
             * Actual Rest Seconds
             * @description Tracked actual rest before the set, in seconds.
             */
            actual_rest_seconds?: number | null;
            /**
             * Completed
             * @default true
             */
            completed: boolean;
            /**
             * Completed At
             * @description Set completion timestamp (client).
             */
            completed_at?: string | null;
            /**
             * Duration
             * @description Duration in seconds
             */
            duration?: number | null;
            /**
             * Planned Rest Seconds
             * @description Planned rest for the set, in seconds.
             */
            planned_rest_seconds?: number | null;
            /** Reps */
            reps?: number | null;
            /**
             * Rir
             * @description Reps in Reserve
             */
            rir?: number | string | null;
            /**
             * Rpe
             * @description Rate of Perceived Exertion (0-10).
             */
            rpe?: number | string | null;
            /**
             * Set Number
             * @description 1-based set index within the exercise.
             */
            set_number: number;
            /**
             * @description Set type: warmup, working, dropset, failure.
             * @default working
             */
            set_type: components["schemas"]["WorkoutSetType"];
            /**
             * Started At
             * @description Set start timestamp (client, for time-under-tension).
             */
            started_at?: string | null;
            /** Weight */
            weight?: number | null;
        };
        /**
         * CompletedSet
         * @description Completed set data
         */
        "CompletedSet-Output": {
            /**
             * Actual Rest Seconds
             * @description Tracked actual rest before the set, in seconds.
             */
            actual_rest_seconds?: number | null;
            /**
             * Completed
             * @default true
             */
            completed: boolean;
            /**
             * Completed At
             * @description Set completion timestamp (client).
             */
            completed_at?: string | null;
            /**
             * Duration
             * @description Duration in seconds
             */
            duration?: number | null;
            /**
             * Planned Rest Seconds
             * @description Planned rest for the set, in seconds.
             */
            planned_rest_seconds?: number | null;
            /** Reps */
            reps?: number | null;
            /**
             * Rir
             * @description Reps in Reserve
             */
            rir?: string | null;
            /**
             * Rpe
             * @description Rate of Perceived Exertion (0-10).
             */
            rpe?: string | null;
            /**
             * Set Number
             * @description 1-based set index within the exercise.
             */
            set_number: number;
            /**
             * @description Set type: warmup, working, dropset, failure.
             * @default working
             */
            set_type: components["schemas"]["WorkoutSetType"];
            /**
             * Started At
             * @description Set start timestamp (client, for time-under-tension).
             */
            started_at?: string | null;
            /** Weight */
            weight?: number | null;
        };
        /**
         * DailyWellnessCreate
         * @description Request model for creating daily wellness entry
         */
        DailyWellnessCreate: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /**
             * Energy Score
             * @description Energy level 0-100
             */
            energy_score: number;
            /**
             * Mood Score
             * @description Mood 0-100.
             */
            mood_score?: number | null;
            /**
             * Notes
             * @description Optional journal text.
             */
            notes?: string | null;
            pain_zones?: components["schemas"]["PainZones"];
            /**
             * Sleep Hours
             * @description Hours slept (0-24).
             */
            sleep_hours?: number | null;
            /**
             * Sleep Score
             * @description Sleep quality 0-100
             */
            sleep_score: number;
            /**
             * Stress Level
             * @description Stress 0-10.
             */
            stress_level?: number | null;
        };
        /**
         * DailyWellnessResponse
         * @description Daily wellness response
         */
        DailyWellnessResponse: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Energy Score */
            energy_score: number;
            /** Id */
            id: number;
            /** Mood Score */
            mood_score: number | null;
            /** Notes */
            notes: string | null;
            pain_zones: components["schemas"]["PainZones"];
            /** Sleep Hours */
            sleep_hours: number | null;
            /** Sleep Score */
            sleep_score: number;
            /** Stress Level */
            stress_level: number | null;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** User Id */
            user_id: number;
        };
        /**
         * DataExportRequest
         * @description Request model for data export
         */
        DataExportRequest: {
            /**
             * Date From
             * @description Inclusive start date for exported rows.
             */
            date_from?: string | null;
            /**
             * Date To
             * @description Inclusive end date for exported rows.
             */
            date_to?: string | null;
            /**
             * @description Export file format.
             * @default json
             */
            format: components["schemas"]["ExportFormat"];
            /**
             * Include Achievements
             * @default true
             */
            include_achievements: boolean;
            /**
             * Include Glucose
             * @default true
             */
            include_glucose: boolean;
            /**
             * Include Wellness
             * @default true
             */
            include_wellness: boolean;
            /**
             * Include Workouts
             * @default true
             */
            include_workouts: boolean;
        };
        /**
         * DataExportResponse
         * @description Data export response
         */
        DataExportResponse: {
            /** Download Url */
            download_url?: string | null;
            /** Expires At */
            expires_at?: string | null;
            /** Export Id */
            export_id: string;
            /** File Size */
            file_size?: number | null;
            /** Format */
            format: string;
            /**
             * Requested At
             * Format: date-time
             */
            requested_at: string;
            status: components["schemas"]["DataExportStatus"];
        };
        /**
         * DataExportStatus
         * @enum {string}
         */
        DataExportStatus: "pending" | "processing" | "completed" | "failed";
        /**
         * EmergencyContactCreate
         * @description Request model for creating emergency contact
         */
        EmergencyContactCreate: {
            /**
             * Contact Name
             * @description Display name for this contact.
             */
            contact_name: string;
            /**
             * Contact Username
             * @description Telegram username without @.
             */
            contact_username?: string | null;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /**
             * Notify On Emergency
             * @default true
             */
            notify_on_emergency: boolean;
            /**
             * Notify On Workout End
             * @default false
             */
            notify_on_workout_end: boolean;
            /**
             * Notify On Workout Start
             * @default false
             */
            notify_on_workout_start: boolean;
            /**
             * Phone
             * @description E.164 or local phone digits.
             */
            phone?: string | null;
            /**
             * Priority
             * @description Lower number = higher priority when notifying.
             * @default 1
             */
            priority: number;
            /** @description How this person relates to the user. */
            relationship_type?: components["schemas"]["EmergencyRelationship"] | null;
        };
        /**
         * EmergencyContactListResponse
         * @description List of emergency contacts response
         */
        EmergencyContactListResponse: {
            /** Active Count */
            active_count: number;
            /** Items */
            items: components["schemas"]["EmergencyContactResponse"][];
            /** Total */
            total: number;
        };
        /**
         * EmergencyContactResponse
         * @description Emergency contact response
         */
        EmergencyContactResponse: {
            /** Contact Name */
            contact_name: string;
            /** Contact Username */
            contact_username: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Id */
            id: number;
            /** Is Active */
            is_active: boolean;
            /** Notify On Emergency */
            notify_on_emergency: boolean;
            /** Notify On Workout End */
            notify_on_workout_end: boolean;
            /** Notify On Workout Start */
            notify_on_workout_start: boolean;
            /** Phone */
            phone: string | null;
            /** Priority */
            priority: number;
            /** Relationship Type */
            relationship_type: string | null;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** User Id */
            user_id: number;
        };
        /**
         * EmergencyContactUpdate
         * @description Request model for updating emergency contact
         */
        EmergencyContactUpdate: {
            /** Contact Name */
            contact_name?: string | null;
            /** Contact Username */
            contact_username?: string | null;
            /** Is Active */
            is_active?: boolean | null;
            /** Notify On Emergency */
            notify_on_emergency?: boolean | null;
            /** Notify On Workout End */
            notify_on_workout_end?: boolean | null;
            /** Notify On Workout Start */
            notify_on_workout_start?: boolean | null;
            /** Phone */
            phone?: string | null;
            /** Priority */
            priority?: number | null;
            relationship_type?: components["schemas"]["EmergencyRelationship"] | null;
        };
        /**
         * EmergencyLogEventRequest
         * @description Client-reported emergency-related event (audit / support).
         */
        EmergencyLogEventRequest: {
            /** Contactnotified */
            contactNotified?: boolean | null;
            /** Protocolstarted */
            protocolStarted?: boolean | null;
            /** Symptom */
            symptom?: string | null;
        };
        /**
         * EmergencyLogEventResponse
         * @description Acknowledgement after logging an emergency-related client event
         */
        EmergencyLogEventResponse: {
            /** Event Id */
            event_id: string;
            /** Logged */
            logged: boolean;
        };
        /**
         * EmergencyNotifyRequest
         * @description Request model for emergency notification
         */
        EmergencyNotifyRequest: {
            /**
             * Location
             * @description Optional location hint.
             */
            location?: string | null;
            /**
             * Message
             * @description Custom emergency message
             */
            message?: string | null;
            /**
             * @description Severity drives routing and copy.
             * @default high
             */
            severity: components["schemas"]["EmergencySeverity"];
            /**
             * Workout Id
             * @description Related workout, if any.
             */
            workout_id?: number | null;
        };
        /**
         * EmergencyNotifyResponse
         * @description Emergency notification response
         */
        EmergencyNotifyResponse: {
            /** Failed Count */
            failed_count: number;
            /** Message Sent */
            message_sent: string;
            /**
             * Notified At
             * Format: date-time
             */
            notified_at: string;
            /** Results */
            results: components["schemas"]["NotificationResult"][];
            /** Severity */
            severity: string;
            /** Successful Count */
            successful_count: number;
        };
        /**
         * EmergencyRelationship
         * @enum {string}
         */
        EmergencyRelationship: "family" | "friend" | "doctor" | "trainer" | "other";
        /**
         * EmergencySettingsResponse
         * @description User emergency feature settings snapshot
         */
        EmergencySettingsResponse: {
            /** Active Contacts Count */
            active_contacts_count: number;
            /** Auto Notify On Workout */
            auto_notify_on_workout: boolean;
            /** Contacts Count */
            contacts_count: number;
            /** Emergency Timeout Minutes */
            emergency_timeout_minutes: number;
            /** Location Sharing */
            location_sharing: boolean;
        };
        /**
         * EmergencySeverity
         * @enum {string}
         */
        EmergencySeverity: "low" | "medium" | "high" | "critical";
        /**
         * EmergencyWorkoutNotifyResponse
         * @description Result of workout start/end notify-to-contacts action
         */
        EmergencyWorkoutNotifyResponse: {
            /** Contacts Notified */
            contacts_notified?: number | null;
            /** Message */
            message: string;
            /** Preview */
            preview?: string | null;
        };
        /**
         * ExerciseBestPerformance
         * @description Best single-session performance in the selected window.
         */
        ExerciseBestPerformance: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Reps */
            reps?: number | null;
            /** Weight */
            weight?: number | null;
        };
        /** ExerciseCategoriesResponse */
        ExerciseCategoriesResponse: {
            /** Categories */
            categories: components["schemas"]["ExerciseCategoryItem"][];
        };
        /**
         * ExerciseCategory
         * @enum {string}
         */
        ExerciseCategory: "strength" | "cardio" | "flexibility" | "balance" | "sport";
        /** ExerciseCategoryItem */
        ExerciseCategoryItem: {
            /** Icon */
            icon: string;
            /** Label */
            label: string;
            /** Value */
            value: string;
        };
        /**
         * ExerciseCreate
         * @description Request model for creating exercise
         */
        ExerciseCreate: {
            /**
             * Aliases
             * @description Alternative names used in exercise search.
             */
            aliases?: string[];
            /** @description Exercise category. */
            category: components["schemas"]["ExerciseCategory"];
            /**
             * Description
             * @description Optional long description.
             */
            description?: string | null;
            /**
             * Equipment
             * @description Equipment tags; at most 50 entries.
             */
            equipment?: string[];
            /**
             * Media Url
             * @description URL to image or video.
             */
            media_url?: string | null;
            /**
             * Muscle Group
             * @description Primary muscle group used for fast filtering.
             */
            muscle_group?: string | null;
            /**
             * Muscle Groups
             * @description Muscle groups; at most 30 entries.
             */
            muscle_groups?: string[];
            /**
             * Name
             * @description Exercise display name.
             */
            name: string;
            risk_flags?: components["schemas"]["RiskFlags"];
        };
        /** ExerciseEquipmentItem */
        ExerciseEquipmentItem: {
            /** Label */
            label: string;
            /** Value */
            value: string;
        };
        /** ExerciseEquipmentListResponse */
        ExerciseEquipmentListResponse: {
            /** Equipment */
            equipment: components["schemas"]["ExerciseEquipmentItem"][];
        };
        /**
         * ExerciseInTemplate
         * @description Exercise within a workout template
         */
        ExerciseInTemplate: {
            /**
             * Duration
             * @description Duration in seconds (max 24h)
             */
            duration?: number | null;
            /**
             * Exercise Id
             * @description Exercise ID
             */
            exercise_id: number;
            /**
             * Name
             * @description Exercise name
             */
            name: string;
            /** Notes */
            notes?: string | null;
            /**
             * Reps
             * @description Reps per set
             */
            reps?: number | null;
            /**
             * Rest Seconds
             * @description Rest between sets
             * @default 60
             */
            rest_seconds: number;
            /**
             * Sets
             * @description Number of sets
             * @default 3
             */
            sets: number;
            /**
             * Weight
             * @description Weight in kg
             */
            weight?: number | null;
        };
        /**
         * ExerciseListFilters
         * @description Echo of list query parameters (for clients and OpenAPI).
         */
        ExerciseListFilters: {
            /** Category */
            category?: string | null;
            /** Equipment */
            equipment?: string | null;
            /** Muscle Group */
            muscle_group?: string | null;
            /** Search */
            search?: string | null;
            /**
             * Status
             * @default active
             */
            status: string;
        };
        /**
         * ExerciseListResponse
         * @description List of exercises response
         */
        ExerciseListResponse: {
            filters?: components["schemas"]["ExerciseListFilters"];
            /** Items */
            items: components["schemas"]["ExerciseResponse"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Total */
            total: number;
        };
        /** ExerciseMuscleGroupItem */
        ExerciseMuscleGroupItem: {
            /** Label */
            label: string;
            /** Value */
            value: string;
        };
        /** ExerciseMuscleGroupsResponse */
        ExerciseMuscleGroupsResponse: {
            /** Muscle Groups */
            muscle_groups: components["schemas"]["ExerciseMuscleGroupItem"][];
        };
        /**
         * ExerciseProgressData
         * @description Progress data for a single exercise
         */
        ExerciseProgressData: {
            /** Avg Weight */
            avg_weight: number | null;
            /** Exercise Id */
            exercise_id: number;
            /** Exercise Name */
            exercise_name: string;
            /**
             * First Date
             * Format: date
             */
            first_date: string;
            /**
             * Last Date
             * Format: date
             */
            last_date: string;
            /** Max Weight */
            max_weight: number | null;
            /** Progress Percentage */
            progress_percentage: number | null;
            /** Total Reps */
            total_reps: number;
            /** Total Sets */
            total_sets: number;
        };
        /**
         * ExerciseProgressDataPoint
         * @description Single time-series point for exercise progress charts.
         */
        ExerciseProgressDataPoint: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Max Weight */
            max_weight?: number | null;
            /** Reps */
            reps?: number | null;
        };
        /**
         * ExerciseProgressResponse
         * @description Exercise progress response
         */
        ExerciseProgressResponse: {
            best_performance?: components["schemas"]["ExerciseBestPerformance"] | null;
            /**
             * Data Points
             * @description Time series data for charting
             */
            data_points?: components["schemas"]["ExerciseProgressDataPoint"][];
            /** Exercise Id */
            exercise_id: number;
            /** Exercise Name */
            exercise_name: string;
            /** Period */
            period: string;
            summary: components["schemas"]["ExerciseProgressData"];
        };
        /**
         * ExerciseResponse
         * @description Exercise response
         */
        ExerciseResponse: {
            /** Aliases */
            aliases?: string[];
            /** Author User Id */
            author_user_id: number | null;
            /** Category */
            category: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Description */
            description: string | null;
            /** Equipment */
            equipment: string[];
            /** Id */
            id: number;
            /** Media Url */
            media_url: string | null;
            /** Muscle Group */
            muscle_group?: string | null;
            /** Muscle Groups */
            muscle_groups: string[];
            /** Name */
            name: string;
            risk_flags: components["schemas"]["RiskFlags"];
            /** Status */
            status: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * ExerciseStatus
         * @enum {string}
         */
        ExerciseStatus: "active" | "pending" | "archived";
        /**
         * ExerciseUpdate
         * @description Request model for updating exercise
         */
        ExerciseUpdate: {
            /** Aliases */
            aliases?: string[] | null;
            category?: components["schemas"]["ExerciseCategory"] | null;
            /** Description */
            description?: string | null;
            /** Equipment */
            equipment?: string[] | null;
            /** Media Url */
            media_url?: string | null;
            /** Muscle Group */
            muscle_group?: string | null;
            /** Muscle Groups */
            muscle_groups?: string[] | null;
            /**
             * Name
             * @description Exercise display name.
             */
            name?: string | null;
            risk_flags?: components["schemas"]["RiskFlags"] | null;
            status?: components["schemas"]["ExerciseStatus"] | null;
        };
        /**
         * ExperienceLevel
         * @enum {string}
         */
        ExperienceLevel: "beginner" | "intermediate" | "advanced";
        /**
         * ExportFormat
         * @enum {string}
         */
        ExportFormat: "json" | "csv" | "xlsx";
        /**
         * FavoriteExercise
         * @description Aggregated favorite exercise row for analytics summary.
         */
        FavoriteExercise: {
            /** Count */
            count: number;
            /** Exercise Id */
            exercise_id: number;
            /** Name */
            name: string;
        };
        /**
         * FitnessGoal
         * @enum {string}
         */
        FitnessGoal: "strength" | "weight_loss" | "endurance";
        /**
         * GlucoseHistoryResponse
         * @description Glucose history response
         */
        GlucoseHistoryResponse: {
            /** Average */
            average: number | null;
            /** Date From */
            date_from: string | null;
            /** Date To */
            date_to: string | null;
            /** Items */
            items: components["schemas"]["GlucoseLogResponse"][];
            /** Max Value */
            max_value: number | null;
            /** Min Value */
            min_value: number | null;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Total */
            total: number;
        };
        /**
         * GlucoseLogCreate
         * @description Request model for creating glucose log
         */
        GlucoseLogCreate: {
            /** @description When or how the reading was taken. */
            measurement_type: components["schemas"]["GlucoseMeasurementType"];
            /**
             * Notes
             * @description Optional note (max 500 characters).
             */
            notes?: string | null;
            /**
             * Timestamp
             * @description Measurement time (default: now)
             */
            timestamp?: string | null;
            /**
             * Value
             * @description Blood glucose in mmol/L (clinical range enforced).
             */
            value: number;
            /**
             * Workout Id
             * @description Associated workout ID
             */
            workout_id?: number | null;
        };
        /**
         * GlucoseLogResponse
         * @description Glucose log response
         */
        GlucoseLogResponse: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Id */
            id: number;
            /** Measurement Type */
            measurement_type: string;
            /** Notes */
            notes: string | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp: string;
            /** User Id */
            user_id: number;
            /** Value */
            value: number;
            /** Workout Id */
            workout_id: number | null;
        };
        /**
         * GlucoseMeasurementType
         * @enum {string}
         */
        GlucoseMeasurementType: "fasting" | "pre_workout" | "post_workout" | "random" | "bedtime";
        /**
         * GlucoseStats
         * @description Glucose statistics
         */
        GlucoseStats: {
            /** Average 30D */
            average_30d: number | null;
            /** Average 7D */
            average_7d: number | null;
            /** In Range Percentage */
            in_range_percentage: number | null;
            /** Readings Count 30D */
            readings_count_30d: number;
            /** Readings Count 7D */
            readings_count_7d: number;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** HealthCheckResponse */
        HealthCheckResponse: {
            /** @description Overall process health indicator. */
            status: components["schemas"]["HealthStatus"];
        };
        /**
         * HealthDashboardPeriod
         * @enum {string}
         */
        HealthDashboardPeriod: "7d" | "30d" | "90d" | "1y";
        /**
         * HealthStatsResponse
         * @description Health statistics response
         */
        HealthStatsResponse: {
            /**
             * Generated At
             * Format: date-time
             */
            generated_at: string;
            glucose: components["schemas"]["GlucoseStats"] | null;
            /**
             * @description Aggregation window for dashboard stats.
             * @default 30d
             */
            period: components["schemas"]["HealthDashboardPeriod"];
            wellness: components["schemas"]["WellnessStats"];
            workouts: components["schemas"]["WorkoutStats"];
        };
        /**
         * HealthStatus
         * @description Values returned by ``SystemService.health_check`` and probes.
         * @enum {string}
         */
        HealthStatus: "healthy" | "ok" | "degraded";
        /**
         * LivenessResponse
         * @description Liveness probe response: container is running.
         */
        LivenessResponse: {
            /**
             * Status
             * @description Always 'alive' if endpoint responds
             * @default alive
             */
            status: string;
            /**
             * Timestamp
             * @description UTC ISO8601 timestamp
             */
            timestamp: string;
        };
        /**
         * LogoutResponse
         * @description Logout response
         */
        LogoutResponse: {
            /**
             * Message
             * @default Successfully logged out
             */
            message: string;
        };
        /**
         * MuscleImbalanceSignalsDetail
         * @description Row from ``muscle_imbalance_signals_by_user`` (see DB migration).
         */
        MuscleImbalanceSignalsDetail: {
            /** Avg Rir 7D */
            avg_rir_7d?: number | null;
            /** Avg Rpe 7D */
            avg_rpe_7d?: number | null;
            /** Back Volume 28D */
            back_volume_28d?: number | null;
            /** Back Volume 7D */
            back_volume_7d?: number | null;
            /** Back Vs Chest Ratio 28D */
            back_vs_chest_ratio_28d?: number | null;
            /** Biceps Volume 28D */
            biceps_volume_28d?: number | null;
            /** Chest Volume 28D */
            chest_volume_28d?: number | null;
            /** Chest Volume 7D */
            chest_volume_7d?: number | null;
            /** Core Share Ratio 28D */
            core_share_ratio_28d?: number | null;
            /** Core Volume 28D */
            core_volume_28d?: number | null;
            /** Days Since Back Session */
            days_since_back_session?: number | null;
            /** Days Since Chest Session */
            days_since_chest_session?: number | null;
            /** Forearms Volume 28D */
            forearms_volume_28d?: number | null;
            /** Glutes Volume 28D */
            glutes_volume_28d?: number | null;
            /** Hamstrings Volume 28D */
            hamstrings_volume_28d?: number | null;
            /** Hamstrings Vs Quads Ratio 28D */
            hamstrings_vs_quads_ratio_28d?: number | null;
            /** Posterior Leg Underload Signal */
            posterior_leg_underload_signal?: boolean | null;
            /** Posterior Vs Anterior Ratio 28D */
            posterior_vs_anterior_ratio_28d?: number | null;
            /** Pull Underload Signal */
            pull_underload_signal?: boolean | null;
            /** Pull Vs Push Ratio 28D */
            pull_vs_push_ratio_28d?: number | null;
            /** Quads Volume 28D */
            quads_volume_28d?: number | null;
            /** Shoulders Volume 28D */
            shoulders_volume_28d?: number | null;
            /** Total Volume 28D */
            total_volume_28d?: number | null;
            /** Triceps Volume 28D */
            triceps_volume_28d?: number | null;
            /** User Id */
            user_id: number;
            /** Weak Back Signal */
            weak_back_signal?: boolean | null;
        } & {
            [key: string]: unknown;
        };
        /**
         * MuscleImbalanceSignalsResponse
         * @description Muscle imbalance signals payload (stable API envelope).
         */
        MuscleImbalanceSignalsResponse: {
            /** Available */
            available: boolean;
            /** @description Feature-specific signal data from analytics repository */
            signals?: components["schemas"]["MuscleImbalanceSignalsDetail"] | null;
        };
        /**
         * MuscleLoadEntry
         * @description Daily muscle load aggregate entry
         */
        MuscleLoadEntry: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Id */
            id: number;
            /** Loadscore */
            loadScore: number;
            /** Musclegroup */
            muscleGroup: string;
            /** Userid */
            userId: number;
        };
        /**
         * MuscleLoadTableResponse
         * @description Paginated muscle load response for table views
         */
        MuscleLoadTableResponse: {
            /**
             * Datefrom
             * Format: date
             */
            dateFrom: string;
            /**
             * Dateto
             * Format: date
             */
            dateTo: string;
            /** Items */
            items: components["schemas"]["MuscleLoadEntry"][];
            /** Page */
            page: number;
            /** Pagesize */
            pageSize: number;
            /** Total */
            total: number;
        };
        /**
         * NotificationResult
         * @description Individual notification result
         */
        NotificationResult: {
            /** Contact Id */
            contact_id: number;
            /** Contact Name */
            contact_name: string;
            /** Error */
            error?: string | null;
            /**
             * Method
             * @description Notification channel used
             */
            method: string;
            /** Success */
            success: boolean;
        };
        /**
         * OnboardingRequest
         * @description Request model for first-login onboarding.
         */
        OnboardingRequest: {
            /** @description Current training level. */
            experience_level: components["schemas"]["ExperienceLevel"];
            /** @description Primary fitness objective. */
            fitness_goal: components["schemas"]["FitnessGoal"];
        };
        /**
         * OnboardingResponse
         * @description Response for onboarding save operation.
         */
        OnboardingResponse: {
            /**
             * Message
             * @default Onboarding saved
             */
            message: string;
            profile: components["schemas"]["UserProfileData"];
            /**
             * Success
             * @default true
             */
            success: boolean;
        };
        /**
         * PainZones
         * @description Pain levels by body zone
         */
        PainZones: {
            /**
             * Ankles
             * @default 0
             */
            ankles: number;
            /**
             * Arms
             * @default 0
             */
            arms: number;
            /**
             * Back
             * @default 0
             */
            back: number;
            /**
             * Chest
             * @default 0
             */
            chest: number;
            /**
             * Head
             * @default 0
             */
            head: number;
            /**
             * Hips
             * @default 0
             */
            hips: number;
            /**
             * Knees
             * @default 0
             */
            knees: number;
            /**
             * Neck
             * @default 0
             */
            neck: number;
            /**
             * Shoulders
             * @default 0
             */
            shoulders: number;
            /**
             * Wrists
             * @default 0
             */
            wrists: number;
        };
        /**
         * PersonalRecord
         * @description Personal record entry
         */
        PersonalRecord: {
            /**
             * Date Achieved
             * Format: date
             */
            date_achieved: string;
            /** Exercise Id */
            exercise_id: number;
            /** Exercise Name */
            exercise_name: string;
            /** Improvement */
            improvement: number | null;
            /** Previous Record */
            previous_record: number | null;
            /** Record Type */
            record_type: string;
            /** Unit */
            unit: string;
            /** Value */
            value: number;
        };
        /**
         * ProgressInsightsBestSetItem
         * @description Top set by volume/weight in selected period.
         */
        ProgressInsightsBestSetItem: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Exercise Id */
            exercise_id: number;
            /** Exercise Name */
            exercise_name: string;
            /** Reps */
            reps?: number | null;
            /** Set Number */
            set_number?: number | null;
            /** Volume */
            volume: number;
            /** Weight */
            weight?: number | null;
        };
        /**
         * ProgressInsightsFrequencyPoint
         * @description Weekly frequency aggregate point.
         */
        ProgressInsightsFrequencyPoint: {
            /** Active Days */
            active_days: number;
            /**
             * Week End
             * Format: date
             */
            week_end: string;
            /**
             * Week Start
             * Format: date
             */
            week_start: string;
            /** Workout Count */
            workout_count: number;
        };
        /**
         * ProgressInsightsPRItem
         * @description Detected personal record event for an exercise.
         */
        ProgressInsightsPRItem: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Exercise Id */
            exercise_id: number;
            /** Exercise Name */
            exercise_name: string;
            /** Improvement */
            improvement?: number | null;
            /** Improvement Pct */
            improvement_pct?: number | null;
            /**
             * Is First Entry
             * @default false
             */
            is_first_entry: boolean;
            /** Previous Best Weight */
            previous_best_weight?: number | null;
            /** Reps */
            reps?: number | null;
            /** Weight */
            weight?: number | null;
        };
        /**
         * ProgressInsightsResponse
         * @description Combined progress analytics payload for overview screens.
         */
        ProgressInsightsResponse: {
            /** Best Sets */
            best_sets?: components["schemas"]["ProgressInsightsBestSetItem"][];
            /**
             * Date From
             * Format: date
             */
            date_from: string;
            /**
             * Date To
             * Format: date
             */
            date_to: string;
            /** Frequency Trend */
            frequency_trend?: components["schemas"]["ProgressInsightsFrequencyPoint"][];
            /** Period */
            period: string;
            /** Pr Events */
            pr_events?: components["schemas"]["ProgressInsightsPRItem"][];
            summary: components["schemas"]["ProgressInsightsSummary"];
            /** Volume Trend */
            volume_trend?: components["schemas"]["ProgressInsightsVolumePoint"][];
        };
        /**
         * ProgressInsightsSummary
         * @description Compact overview of progress in selected period.
         */
        ProgressInsightsSummary: {
            /** Active Days */
            active_days: number;
            /** Average Workouts Per Week */
            average_workouts_per_week: number;
            /** Total Reps */
            total_reps: number;
            /** Total Sets */
            total_sets: number;
            /** Total Volume */
            total_volume: number;
            /** Total Workouts */
            total_workouts: number;
        };
        /**
         * ProgressInsightsVolumePoint
         * @description Daily volume aggregate point for trend charts.
         */
        ProgressInsightsVolumePoint: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Total Reps */
            total_reps: number;
            /** Total Sets */
            total_sets: number;
            /** Total Volume */
            total_volume: number;
            /** Workout Count */
            workout_count: number;
        };
        /**
         * ReadinessChecks
         * @description Per-dependency result: ``"ok"`` or ``"error: …"`` (human-readable failure).
         */
        ReadinessChecks: {
            /**
             * Postgres
             * @description ``"ok"`` or ``"error: …"`` from PostgreSQL ``SELECT 1``.
             */
            postgres: string;
            /**
             * Redis
             * @description ``"ok"`` or ``"error: …"`` from Redis ``PING``.
             */
            redis: string;
        };
        /**
         * ReadinessResponse
         * @description Readiness probe: PostgreSQL (async session) and Redis (shared async client).
         */
        ReadinessResponse: {
            checks: components["schemas"]["ReadinessChecks"];
            /**
             * Status
             * @description 'ready' only if both checks are ok; otherwise 'degraded'.
             * @enum {string}
             */
            status: "ready" | "degraded";
        };
        /**
         * RecoveryStateRecalculateResponse
         * @description Recovery state after manual recalculation
         */
        RecoveryStateRecalculateResponse: {
            /**
             * Datefrom
             * Format: date
             */
            dateFrom: string;
            /**
             * Dateto
             * Format: date
             */
            dateTo: string;
            /** Fatiguelevel */
            fatigueLevel: number;
            /** Id */
            id: number;
            /** Readinessscore */
            readinessScore: number;
            /**
             * Recalculatedfordate
             * Format: date
             */
            recalculatedForDate: string;
            /** Userid */
            userId: number;
        };
        /**
         * RecoveryStateResponse
         * @description Current user recovery state
         */
        RecoveryStateResponse: {
            /** Fatiguelevel */
            fatigueLevel: number;
            /** Id */
            id: number;
            /** Readinessscore */
            readinessScore: number;
            /** Userid */
            userId: number;
        };
        /**
         * RefreshTokenRequest
         * @description Request model for token refresh
         */
        RefreshTokenRequest: {
            /**
             * Refresh Token
             * @description Opaque refresh token issued by this API.
             */
            refresh_token: string;
        };
        /**
         * RefreshTokenResponse
         * @description Token refresh response
         */
        RefreshTokenResponse: {
            /** Access Token */
            access_token: string;
            /**
             * Expires In
             * @description Access token lifetime in seconds
             */
            expires_in: number;
            /** Refresh Token */
            refresh_token: string;
            /**
             * Token Type
             * @default bearer
             */
            token_type: string;
        };
        /**
         * RiskFlags
         * @description Risk flags for health conditions
         */
        RiskFlags: {
            /**
             * Back Problems
             * @default false
             */
            back_problems: boolean;
            /**
             * Diabetes
             * @default false
             */
            diabetes: boolean;
            /**
             * Heart Conditions
             * @default false
             */
            heart_conditions: boolean;
            /**
             * High Blood Pressure
             * @default false
             */
            high_blood_pressure: boolean;
            /**
             * Joint Problems
             * @default false
             */
            joint_problems: boolean;
        };
        /** ServiceVersionResponse */
        ServiceVersionResponse: {
            /** Build Timestamp */
            build_timestamp?: string | null;
            /** Commit Sha */
            commit_sha?: string | null;
            /** Name */
            name: string;
            /** Version */
            version: string;
        };
        /** SessionEffortDistribution */
        SessionEffortDistribution: {
            /**
             * Easy
             * @default 0
             */
            easy: number;
            /**
             * Hard
             * @default 0
             */
            hard: number;
            /**
             * Maximal
             * @default 0
             */
            maximal: number;
            /**
             * Moderate
             * @default 0
             */
            moderate: number;
        };
        /** SessionFatigueTrend */
        SessionFatigueTrend: {
            /** Closing Avg Rpe */
            closing_avg_rpe: number;
            /** Delta */
            delta: number;
            /** Opening Avg Rpe */
            opening_avg_rpe: number;
        };
        /**
         * StartWorkoutTemplateOverrides
         * @description Optional template overrides for start workflow without mutating source template.
         */
        StartWorkoutTemplateOverrides: {
            /** Comments */
            comments?: string | null;
            /**
             * Exercises
             * @description Override exercise plan for this session only.
             */
            exercises?: components["schemas"]["ExerciseInTemplate"][];
            /** Tags */
            tags?: string[];
        };
        /**
         * TelegramAuthRequest
         * @description Request model for Telegram authentication
         */
        TelegramAuthRequest: {
            /**
             * Initdata
             * @description Raw initData string from Telegram WebApp
             * @example query_id=...&user={...}&auth_date=...&hash=...
             */
            initData: string;
        };
        /**
         * TelegramLookupResponse
         * @description Whether a database user already exists for validated initData (no user creation).
         */
        TelegramLookupResponse: {
            /**
             * Registered
             * @description True when a user row exists for this Telegram account.
             */
            registered: boolean;
        };
        /**
         * TelegramUserData
         * @description Telegram user data model
         */
        TelegramUserData: {
            /**
             * Allows Write To Pm
             * @description Allows writing to PM
             */
            allows_write_to_pm?: boolean | null;
            /**
             * First Name
             * @description First name
             */
            first_name: string;
            /**
             * Id
             * @description Telegram user ID
             */
            id: number;
            /**
             * Is Premium
             * @description Is Telegram Premium user
             */
            is_premium?: boolean | null;
            /**
             * Language Code
             * @description BCP 47 language tag (e.g. en, ru).
             */
            language_code?: string | null;
            /**
             * Last Name
             * @description Last name
             */
            last_name?: string | null;
            /**
             * Photo Url
             * @description Profile photo URL
             */
            photo_url?: string | null;
            /**
             * Username
             * @description Username
             */
            username?: string | null;
        };
        /**
         * TrainingLoadDailyEntry
         * @description Daily training load aggregate entry
         */
        TrainingLoadDailyEntry: {
            /** Avgrpe */
            avgRpe?: number | null;
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Fatiguescore */
            fatigueScore: number;
            /** Id */
            id: number;
            /** Userid */
            userId: number;
            /** Volume */
            volume: number;
        };
        /**
         * TrainingLoadDailyTableResponse
         * @description Paginated daily training load response for table views
         */
        TrainingLoadDailyTableResponse: {
            /**
             * Datefrom
             * Format: date
             */
            dateFrom: string;
            /**
             * Dateto
             * Format: date
             */
            dateTo: string;
            /** Items */
            items: components["schemas"]["TrainingLoadDailyEntry"][];
            /** Page */
            page: number;
            /** Pagesize */
            pageSize: number;
            /** Total */
            total: number;
        };
        /**
         * UserAchievementListResponse
         * @description List of user achievements response
         */
        UserAchievementListResponse: {
            /** Completed Count */
            completed_count: number;
            /** In Progress Count */
            in_progress_count: number;
            /** Items */
            items: components["schemas"]["UserAchievementResponse"][];
            /** Recent Achievements */
            recent_achievements: components["schemas"]["UserAchievementResponse"][];
            /** Total */
            total: number;
            /** Total Points */
            total_points: number;
        };
        /**
         * UserAchievementResponse
         * @description User achievement response
         */
        UserAchievementResponse: {
            achievement: components["schemas"]["AchievementResponse"];
            /** Achievement Id */
            achievement_id: number;
            /**
             * Earned At
             * Format: date-time
             */
            earned_at: string;
            /** Id */
            id: number;
            /**
             * Is Completed
             * @description Whether achievement is fully completed
             * @default true
             */
            is_completed: boolean;
            /** Progress */
            progress: number;
            progress_data: components["schemas"]["AchievementProgressData"];
            /** User Id */
            user_id: number;
        };
        /** UserCreate */
        UserCreate: {
            /**
             * First Name
             * @description Given name.
             */
            first_name?: string | null;
            /**
             * Last Name
             * @description Family name.
             */
            last_name?: string | null;
            /**
             * Telegram Id
             * @description Telegram user ID (positive integer).
             */
            telegram_id: number;
            /**
             * Username
             * @description Telegram @username without the leading @.
             */
            username?: string | null;
        };
        /**
         * UserProfileData
         * @description User profile JSON (equipment, limitations, goals).
         */
        UserProfileData: {
            /**
             * Birth Date
             * @description Date of birth (string; format depends on client).
             */
            birth_date?: string | null;
            /**
             * Current Weight
             * @description Current body weight in kilograms.
             */
            current_weight?: number | null;
            /** Equipment */
            equipment?: string[];
            /** @description Training experience level selected during onboarding. */
            experience_level?: components["schemas"]["ExperienceLevel"] | null;
            /** @description Primary fitness objective selected during onboarding. */
            fitness_goal?: components["schemas"]["FitnessGoal"] | null;
            /** Goals */
            goals?: string[];
            /**
             * Height
             * @description Height in centimeters.
             */
            height?: number | null;
            /** Limitations */
            limitations?: string[];
            /**
             * Onboarding Completed
             * @description Whether onboarding has been completed.
             */
            onboarding_completed?: boolean | null;
            /**
             * Onboarding Completed At
             * @description ISO timestamp when onboarding was completed.
             */
            onboarding_completed_at?: string | null;
            /**
             * Target Weight
             * @description Target body weight in kilograms.
             */
            target_weight?: number | null;
            /**
             * Telegram Photo Url
             * @description Telegram profile photo URL from initData.
             */
            telegram_photo_url?: string | null;
        } & {
            [key: string]: unknown;
        };
        /**
         * UserProfilePatch
         * @description Validated subset of profile JSON for updates (merged server-side).
         */
        UserProfilePatch: {
            /**
             * Birth Date
             * @description Date of birth (string; format depends on client).
             */
            birth_date?: string | null;
            /**
             * Current Weight
             * @description Current body weight in kilograms.
             */
            current_weight?: number | null;
            /**
             * Equipment
             * @description At most 50 equipment tags.
             */
            equipment?: string[] | null;
            /** @description Training experience level. */
            experience_level?: components["schemas"]["ExperienceLevel"] | null;
            /** @description Primary fitness objective. */
            fitness_goal?: components["schemas"]["FitnessGoal"] | null;
            /**
             * Goals
             * @description At most 50 goal tags.
             */
            goals?: string[] | null;
            /**
             * Height
             * @description Height in centimeters.
             */
            height?: number | null;
            /**
             * Limitations
             * @description At most 50 limitation tags.
             */
            limitations?: string[] | null;
            /**
             * Onboarding Completed
             * @description Onboarding completion marker.
             */
            onboarding_completed?: boolean | null;
            /**
             * Onboarding Completed At
             * @description ISO datetime for onboarding completion.
             */
            onboarding_completed_at?: string | null;
            /**
             * Target Weight
             * @description Target body weight in kilograms.
             */
            target_weight?: number | null;
        } & {
            [key: string]: unknown;
        };
        /**
         * UserProfileResponse
         * @description User profile response (API contract; not an ORM model).
         */
        UserProfileResponse: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** First Name */
            first_name: string | null;
            /** Id */
            id: number;
            profile?: components["schemas"]["UserProfileData"];
            settings?: components["schemas"]["UserSettingsData"];
            /** Telegram Id */
            telegram_id: number;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Username */
            username: string | null;
        };
        /**
         * UserProfileUpdate
         * @description Request model for updating user profile
         */
        UserProfileUpdate: {
            /**
             * First Name
             * @description Given name; omit to leave unchanged.
             */
            first_name?: string | null;
            /**
             * Last Name
             * @description Family name; omit to leave unchanged.
             */
            last_name?: string | null;
            /** @description User profile data: equipment, limitations, goals */
            profile?: components["schemas"]["UserProfilePatch"] | null;
            /** @description User settings: theme, notifications, units */
            settings?: components["schemas"]["UserSettingsPatch"] | null;
        };
        /** UserResponse */
        UserResponse: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** First Name */
            first_name: string | null;
            /** Id */
            id: number;
            /** Last Name */
            last_name: string | null;
            /** Telegram Id */
            telegram_id: number;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Username */
            username: string | null;
        };
        /**
         * UserSettingsData
         * @description User settings JSON (theme, notifications, units).
         */
        UserSettingsData: {
            /**
             * Notifications
             * @default true
             */
            notifications: boolean;
            /**
             * Theme
             * @default telegram
             */
            theme: string;
            /**
             * Units
             * @default metric
             */
            units: string;
        } & {
            [key: string]: unknown;
        };
        /**
         * UserSettingsPatch
         * @description Validated settings for partial updates.
         */
        UserSettingsPatch: {
            /**
             * Notifications
             * @description Enable push / in-app notifications.
             */
            notifications?: boolean | null;
            /** @description UI theme preset. */
            theme?: components["schemas"]["UserTheme"] | null;
            /** @description Measurement system for weights and distances. */
            units?: components["schemas"]["UserUnits"] | null;
        };
        /**
         * UserTheme
         * @enum {string}
         */
        UserTheme: "telegram" | "light" | "dark" | "system";
        /**
         * UserUnits
         * @enum {string}
         */
        UserUnits: "metric" | "imperial";
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
        /**
         * WellnessStats
         * @description Wellness statistics
         */
        WellnessStats: {
            /** Avg Energy Score 30D */
            avg_energy_score_30d: number | null;
            /** Avg Energy Score 7D */
            avg_energy_score_7d: number | null;
            /** Avg Sleep Hours 30D */
            avg_sleep_hours_30d: number | null;
            /** Avg Sleep Hours 7D */
            avg_sleep_hours_7d: number | null;
            /** Avg Sleep Score 30D */
            avg_sleep_score_30d: number | null;
            /** Avg Sleep Score 7D */
            avg_sleep_score_7d: number | null;
        };
        /**
         * WorkoutCalendarResponse
         * @description Workout calendar response
         */
        WorkoutCalendarResponse: {
            /** Days */
            days: components["schemas"]["CalendarDayEntry"][];
            /** Month */
            month: number;
            summary: components["schemas"]["WorkoutCalendarSummary"];
            /** Year */
            year: number;
        };
        /**
         * WorkoutCalendarSummary
         * @description Monthly aggregate stats for the calendar view.
         */
        WorkoutCalendarSummary: {
            /** Active Days */
            active_days: number;
            /** Rest Days */
            rest_days: number;
            /** Total Duration */
            total_duration: number;
            /** Total Workouts */
            total_workouts: number;
        };
        /**
         * WorkoutCompleteRequest
         * @description Request model for completing a workout
         */
        WorkoutCompleteRequest: {
            /** Comments */
            comments?: string | null;
            /**
             * Duration
             * @description Duration in minutes (max 24 hours).
             */
            duration: number;
            /**
             * Exercises
             * @description Completed exercises (max 200 per workout).
             */
            exercises: components["schemas"]["CompletedExercise-Input"][];
            /**
             * Expected Version
             * @description Expected workout version for optimistic locking.
             */
            expected_version?: number | null;
            /**
             * Glucose After
             * @description Glucose after workout (mmol/L).
             */
            glucose_after?: number | null;
            /**
             * Glucose Before
             * @description Glucose before workout (mmol/L).
             */
            glucose_before?: number | null;
            /**
             * Idempotency Key
             * @description Optional idempotency key for replay-safe completion.
             */
            idempotency_key?: string | null;
            /**
             * Tags
             * @description Workout tags (max 50, each up to 64 chars).
             */
            tags?: string[];
        };
        /**
         * WorkoutCompleteResponse
         * @description Response for completed workout
         */
        WorkoutCompleteResponse: {
            /** Comments */
            comments: string | null;
            /**
             * Completed At
             * Format: date-time
             */
            completed_at: string;
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Duration */
            duration: number;
            /** Exercises */
            exercises: components["schemas"]["CompletedExercise-Output"][];
            /** Glucose After */
            glucose_after: number | null;
            /** Glucose Before */
            glucose_before: number | null;
            /** Id */
            id: number;
            /**
             * Message
             * @default Workout completed successfully
             */
            message: string;
            session_metrics?: components["schemas"]["WorkoutSessionMetrics"] | null;
            /** Tags */
            tags: string[];
            /** Template Id */
            template_id: number | null;
            /** User Id */
            user_id: number;
            /** Version */
            version: number;
        };
        /**
         * WorkoutHistoryItem
         * @description Single workout history entry
         */
        WorkoutHistoryItem: {
            /** Comments */
            comments: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Duration */
            duration: number | null;
            /** Exercises */
            exercises: components["schemas"]["CompletedExercise-Output"][];
            /** Glucose After */
            glucose_after: number | null;
            /** Glucose Before */
            glucose_before: number | null;
            /** Id */
            id: number;
            session_metrics?: components["schemas"]["WorkoutSessionMetrics"] | null;
            /** Tags */
            tags: string[];
            /** Version */
            version: number;
        };
        /**
         * WorkoutHistoryResponse
         * @description Workout history response
         */
        WorkoutHistoryResponse: {
            /** Date From */
            date_from: string | null;
            /** Date To */
            date_to: string | null;
            /** Items */
            items: components["schemas"]["WorkoutHistoryItem"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Total */
            total: number;
        };
        /**
         * WorkoutPostSummaryResponse
         * @description Post-workout snapshot focused on immediate user feedback.
         */
        WorkoutPostSummaryResponse: {
            /** Best Sets */
            best_sets?: components["schemas"]["ProgressInsightsBestSetItem"][];
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Duration */
            duration: number;
            /** Insights */
            insights?: components["schemas"]["WorkoutSessionInsightItem"][];
            /** Pr Events */
            pr_events?: components["schemas"]["ProgressInsightsPRItem"][];
            /** Session Metrics */
            session_metrics?: {
                [key: string]: unknown;
            } | null;
            /** Total Reps */
            total_reps: number;
            /** Total Sets */
            total_sets: number;
            /** Total Volume */
            total_volume: number;
            /** Workout Id */
            workout_id: number;
        };
        /** WorkoutSessionInsightItem */
        WorkoutSessionInsightItem: {
            /** Code */
            code: string;
            /** Level */
            level: string;
            /** Message */
            message: string;
            /** Title */
            title: string;
        };
        /** WorkoutSessionMetrics */
        WorkoutSessionMetrics: {
            /** Avg Rest Seconds */
            avg_rest_seconds?: number | null;
            /** Avg Rir */
            avg_rir?: number | null;
            /** Avg Rpe */
            avg_rpe?: number | null;
            /**
             * Completed Sets
             * @default 0
             */
            completed_sets: number;
            effort_distribution?: components["schemas"]["SessionEffortDistribution"];
            fatigue_trend?: components["schemas"]["SessionFatigueTrend"] | null;
            /** Rest Consistency Score */
            rest_consistency_score?: number | null;
            /**
             * Rest Tracked Sets
             * @default 0
             */
            rest_tracked_sets: number;
            /**
             * Rest Tracking Ratio
             * @default 0
             */
            rest_tracking_ratio: number;
            /**
             * Total Rest Seconds
             * @default 0
             */
            total_rest_seconds: number;
            /** Volume Per Minute */
            volume_per_minute?: number | null;
        };
        /**
         * WorkoutSessionType
         * @enum {string}
         */
        WorkoutSessionType: "cardio" | "strength" | "flexibility" | "mixed" | "custom";
        /**
         * WorkoutSessionUpdateRequest
         * @description Request model for updating an in-progress workout session.
         */
        WorkoutSessionUpdateRequest: {
            /** Comments */
            comments?: string | null;
            /**
             * Exercises
             * @description Current session exercises persisted before workout completion.
             */
            exercises?: components["schemas"]["CompletedExercise-Input"][];
            /**
             * Expected Version
             * @description Expected workout version for optimistic locking.
             */
            expected_version?: number | null;
            /** Glucose After */
            glucose_after?: number | null;
            /** Glucose Before */
            glucose_before?: number | null;
            /**
             * Idempotency Key
             * @description Optional idempotency key for replay-safe updates.
             */
            idempotency_key?: string | null;
            /**
             * Tags
             * @description Session tags kept while workout is in progress.
             */
            tags?: string[];
        };
        /**
         * WorkoutSetType
         * @enum {string}
         */
        WorkoutSetType: "warmup" | "working" | "dropset" | "failure";
        /**
         * WorkoutStartFromTemplateRequest
         * @description Start workout from template with optional per-session overrides.
         */
        WorkoutStartFromTemplateRequest: {
            /** Name */
            name?: string | null;
            overrides?: components["schemas"]["StartWorkoutTemplateOverrides"] | null;
            /** @default custom */
            type: components["schemas"]["WorkoutSessionType"];
        };
        /**
         * WorkoutStartRequest
         * @description Request model for starting a workout
         */
        WorkoutStartRequest: {
            /**
             * Name
             * @description Custom workout name
             */
            name?: string | null;
            /**
             * Template Id
             * @description Template ID if using template
             */
            template_id?: number | null;
            /**
             * @description Workout category for ad-hoc sessions.
             * @default custom
             */
            type: components["schemas"]["WorkoutSessionType"];
        };
        /**
         * WorkoutStartResponse
         * @description Response for started workout
         */
        WorkoutStartResponse: {
            /**
             * Date
             * Format: date
             */
            date: string;
            /** Id */
            id: number;
            /**
             * Message
             * @default Workout started successfully
             */
            message: string;
            /**
             * Start Time
             * Format: date-time
             */
            start_time: string;
            /**
             * Status
             * @default in_progress
             */
            status: string;
            /** Template Id */
            template_id: number | null;
            /** User Id */
            user_id: number;
        };
        /**
         * WorkoutStats
         * @description Workout statistics
         */
        WorkoutStats: {
            /** Avg Duration */
            avg_duration: number | null;
            /** Favorite Type */
            favorite_type: string | null;
            /** Total Duration 30D */
            total_duration_30d: number;
            /** Total Duration 7D */
            total_duration_7d: number;
            /** Total Workouts 30D */
            total_workouts_30d: number;
            /** Total Workouts 7D */
            total_workouts_7d: number;
        };
        /**
         * WorkoutTemplateCloneRequest
         * @description Clone existing template.
         */
        WorkoutTemplateCloneRequest: {
            /** Is Public */
            is_public?: boolean | null;
            /** Name */
            name?: string | null;
        };
        /**
         * WorkoutTemplateCreate
         * @description Request model for creating workout template
         */
        WorkoutTemplateCreate: {
            /**
             * Exercises
             * @description At least one exercise; at most 100.
             */
            exercises: components["schemas"]["ExerciseInTemplate"][];
            /**
             * Is Public
             * @default false
             */
            is_public: boolean;
            /** Name */
            name: string;
            /** @description Template category. */
            type: components["schemas"]["WorkoutTemplateType"];
        };
        /**
         * WorkoutTemplateFromWorkoutCreate
         * @description Create template from completed workout session.
         */
        WorkoutTemplateFromWorkoutCreate: {
            /**
             * Is Public
             * @default false
             */
            is_public: boolean;
            /** Name */
            name?: string | null;
            /** Workout Id */
            workout_id: number;
        };
        /**
         * WorkoutTemplateList
         * @description List of workout templates
         */
        WorkoutTemplateList: {
            /** Items */
            items: components["schemas"]["WorkoutTemplateResponse"][];
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Total */
            total: number;
        };
        /**
         * WorkoutTemplatePatchRequest
         * @description Partial template update payload with optimistic concurrency.
         */
        WorkoutTemplatePatchRequest: {
            /**
             * Exercise Order
             * @description 0-based order of existing exercise indexes for lightweight reorder operations.
             */
            exercise_order?: number[] | null;
            /** Exercises */
            exercises?: components["schemas"]["ExerciseInTemplate"][] | null;
            /** Expected Version */
            expected_version: number;
            /** Is Public */
            is_public?: boolean | null;
            /** Name */
            name?: string | null;
            type?: components["schemas"]["WorkoutTemplateType"] | null;
        };
        /**
         * WorkoutTemplateResponse
         * @description Workout template response
         */
        WorkoutTemplateResponse: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Exercises */
            exercises: components["schemas"]["ExerciseInTemplate"][];
            /** Id */
            id: number;
            /** Is Archived */
            is_archived: boolean;
            /** Is Public */
            is_public: boolean;
            /** Name */
            name: string;
            /** Type */
            type: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** User Id */
            user_id: number;
            /** Version */
            version: number;
        };
        /**
         * WorkoutTemplateType
         * @enum {string}
         */
        WorkoutTemplateType: "cardio" | "strength" | "flexibility" | "mixed";
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
    root__get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_analytics_dashboard_api_v1_analytics__get: {
        parameters: {
            query?: {
                period?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalyticsDashboardResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_achievements_api_v1_analytics_achievements__get: {
        parameters: {
            query?: {
                category?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AchievementListResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_achievements_leaderboard_api_v1_analytics_achievements_leaderboard_get: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AchievementLeaderboardResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_user_achievements_api_v1_analytics_achievements_user_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAchievementListResponse"];
                };
            };
        };
    };
    get_user_achievement_detail_api_v1_analytics_achievements_user__achievement_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                achievement_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAchievementResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    claim_achievement_api_v1_analytics_achievements__achievement_id__claim_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-generated key; duplicate requests replay the first successful response. */
                "Idempotency-Key"?: string | null;
            };
            path: {
                achievement_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AchievementUnlockResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_workout_calendar_api_v1_analytics_calendar_get: {
        parameters: {
            query?: {
                year?: number;
                month?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutCalendarResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_challenges_api_v1_analytics_challenges__get: {
        parameters: {
            query?: {
                status?: string | null;
                challenge_type?: string | null;
                is_public?: boolean | null;
                /** @description If true, return only challenges created by the authenticated user. */
                mine?: boolean;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChallengeListResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_challenge_api_v1_analytics_challenges__post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChallengeCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChallengeResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_my_active_challenges_api_v1_analytics_challenges_my_active_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChallengeMyActiveResponse"];
                };
            };
        };
    };
    get_challenge_api_v1_analytics_challenges__challenge_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                challenge_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChallengeDetailResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    join_challenge_api_v1_analytics_challenges__challenge_id__join_post: {
        parameters: {
            query?: {
                join_code?: string | null;
            };
            header?: never;
            path: {
                challenge_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChallengeJoinResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_challenge_leaderboard_api_v1_analytics_challenges__challenge_id__leaderboard_get: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path: {
                challenge_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChallengeLeaderboardResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    leave_challenge_api_v1_analytics_challenges__challenge_id__leave_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                challenge_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChallengeLeaveResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_data_api_v1_analytics_export_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-generated key; duplicate requests replay the first successful response. */
                "Idempotency-Key"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DataExportRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DataExportResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_export_status_api_v1_analytics_export__export_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                export_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DataExportResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_muscle_load_api_v1_analytics_muscle_load_get: {
        parameters: {
            query?: {
                date_from?: string | null;
                date_to?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MuscleLoadEntry"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_muscle_load_table_api_v1_analytics_muscle_load_table_get: {
        parameters: {
            query?: {
                page?: number;
                page_size?: number;
                date_from?: string | null;
                date_to?: string | null;
                muscle_group?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MuscleLoadTableResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_muscle_imbalance_signals_api_v1_analytics_muscle_signals_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MuscleImbalanceSignalsResponse"];
                };
            };
        };
    };
    get_analytics_performance_overview_api_v1_analytics_performance_overview_get: {
        parameters: {
            query?: {
                period?: string;
                date_from?: string | null;
                date_to?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalyticsPerformanceOverviewResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_exercise_progress_api_v1_analytics_progress_get: {
        parameters: {
            query?: {
                exercise_id?: number | null;
                period?: string;
                date_from?: string | null;
                date_to?: string | null;
                max_exercises?: number;
                max_data_points?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseProgressResponse"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_progress_insights_api_v1_analytics_progress_insights_get: {
        parameters: {
            query?: {
                period?: string;
                date_from?: string | null;
                date_to?: string | null;
                limit_best_sets?: number;
                limit_pr_events?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProgressInsightsResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_recovery_state_api_v1_analytics_recovery_state_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecoveryStateResponse"];
                };
            };
        };
    };
    recalculate_recovery_state_api_v1_analytics_recovery_state_recalculate_post: {
        parameters: {
            query?: {
                target_date?: string | null;
                date_from?: string | null;
                date_to?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecoveryStateRecalculateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_analytics_summary_api_v1_analytics_summary_get: {
        parameters: {
            query?: {
                period?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalyticsSummaryResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_daily_training_load_api_v1_analytics_training_load_daily_get: {
        parameters: {
            query?: {
                date_from?: string | null;
                date_to?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrainingLoadDailyEntry"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_daily_training_load_table_api_v1_analytics_training_load_daily_table_get: {
        parameters: {
            query?: {
                page?: number;
                page_size?: number;
                date_from?: string | null;
                date_to?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrainingLoadDailyTableResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_workout_post_summary_api_v1_analytics_workout_summary_get: {
        parameters: {
            query: {
                workout_id: number;
                limit_best_sets?: number;
                limit_pr_events?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutPostSummaryResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_analytics_workouts_api_v1_analytics_workouts_get: {
        parameters: {
            query?: {
                period?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalyticsDashboardResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_exercises_api_v1_exercises__get: {
        parameters: {
            query?: {
                category?: string | null;
                muscle_group?: string | null;
                equipment?: string | null;
                search?: string | null;
                status?: string;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseListResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_exercise_api_v1_exercises__post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExerciseCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_exercises_by_slugs_api_v1_exercises_by_slugs_get: {
        parameters: {
            query: {
                slugs: string[];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: number;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_exercise_categories_api_v1_exercises_categories_list_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseCategoriesResponse"];
                };
            };
        };
    };
    create_custom_exercise_multipart_api_v1_exercises_custom_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_create_custom_exercise_multipart_api_v1_exercises_custom_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_equipment_list_api_v1_exercises_equipment_list_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseEquipmentListResponse"];
                };
            };
        };
    };
    get_muscle_groups_api_v1_exercises_muscle_groups_list_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseMuscleGroupsResponse"];
                };
            };
        };
    };
    get_exercise_api_v1_exercises__exercise_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                exercise_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_exercise_api_v1_exercises__exercise_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                exercise_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExerciseUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_exercise_api_v1_exercises__exercise_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                exercise_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    approve_exercise_api_v1_exercises__exercise_id__approve_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                exercise_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExerciseResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_glucose_history_api_v1_health_metrics_glucose_get: {
        parameters: {
            query?: {
                page?: number;
                page_size?: number;
                date_from?: string | null;
                date_to?: string | null;
                measurement_type?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GlucoseHistoryResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_glucose_log_api_v1_health_metrics_glucose_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GlucoseLogCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GlucoseLogResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_glucose_stats_api_v1_health_metrics_glucose_stats_get: {
        parameters: {
            query?: {
                period?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthStatsResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_glucose_log_api_v1_health_metrics_glucose__log_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                log_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GlucoseLogResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_glucose_log_api_v1_health_metrics_glucose__log_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                log_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_health_stats_api_v1_health_metrics_stats_get: {
        parameters: {
            query?: {
                period?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthStatsResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_wellness_history_api_v1_health_metrics_wellness_get: {
        parameters: {
            query?: {
                date_from?: string | null;
                date_to?: string | null;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DailyWellnessResponse"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_wellness_entry_api_v1_health_metrics_wellness_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DailyWellnessCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DailyWellnessResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_wellness_stats_api_v1_health_metrics_wellness_stats_get: {
        parameters: {
            query?: {
                period?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthStatsResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_wellness_entry_api_v1_health_metrics_wellness__entry_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                entry_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DailyWellnessResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_emergency_contacts_api_v1_system_emergency_contact_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmergencyContactListResponse"];
                };
            };
        };
    };
    create_emergency_contact_api_v1_system_emergency_contact_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmergencyContactCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmergencyContactResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_emergency_contact_api_v1_system_emergency_contact__contact_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contact_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmergencyContactResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_emergency_contact_api_v1_system_emergency_contact__contact_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contact_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmergencyContactUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmergencyContactResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_emergency_contact_api_v1_system_emergency_contact__contact_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contact_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    log_emergency_event_api_v1_system_emergency_log_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmergencyLogEventRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmergencyLogEventResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    send_emergency_notification_api_v1_system_emergency_notify_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-generated key; duplicate requests replay the first successful response. */
                "Idempotency-Key"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmergencyNotifyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmergencyNotifyResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    notify_workout_end_api_v1_system_emergency_notify_workout_end_post: {
        parameters: {
            query: {
                workout_id: number;
                duration: number;
                completed_successfully?: boolean;
            };
            header?: {
                /** @description Client-generated key; duplicate requests replay the first successful response. */
                "Idempotency-Key"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmergencyWorkoutNotifyResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    notify_workout_start_api_v1_system_emergency_notify_workout_start_post: {
        parameters: {
            query: {
                workout_id: number;
                estimated_duration?: number | null;
            };
            header?: {
                /** @description Client-generated key; duplicate requests replay the first successful response. */
                "Idempotency-Key"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmergencyWorkoutNotifyResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_emergency_settings_api_v1_system_emergency_settings_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmergencySettingsResponse"];
                };
            };
        };
    };
    system_health_check: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthCheckResponse"];
                };
            };
        };
    };
    liveness_probe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LivenessResponse"];
                };
            };
        };
    };
    readiness_probe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessResponse"];
                };
            };
        };
    };
    system_version: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceVersionResponse"];
                };
            };
        };
    };
    create_user_api_v1_users__post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    logout_api_v1_users_auth_logout_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LogoutResponse"];
                };
            };
        };
    };
    lookup_telegram_registration_api_v1_users_auth_lookup_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelegramAuthRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TelegramLookupResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_current_user_info_api_v1_users_auth_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserProfileResponse"];
                };
            };
        };
    };
    update_user_profile_api_v1_users_auth_me_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserProfileUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserProfileResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    save_onboarding_api_v1_users_auth_onboarding_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OnboardingRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OnboardingResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    refresh_token_api_v1_users_auth_refresh_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshTokenRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RefreshTokenResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    register_via_telegram_api_v1_users_auth_register_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelegramAuthRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    authenticate_telegram_api_v1_users_auth_telegram_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TelegramAuthRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_coach_access_api_v1_users_coach_access_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    generate_coach_access_api_v1_users_coach_access_generate_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    revoke_coach_access_api_v1_users_coach_access__access_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                access_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_user_data_api_v1_users_export_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_current_user_profile_api_v1_users_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserProfileResponse"];
                };
            };
        };
    };
    delete_current_user_api_v1_users_me_delete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    patch_current_user_profile_api_v1_users_me_patch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserProfileUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserProfileResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_user_stats_api_v1_users_me_stats_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_user_stats_api_v1_users_stats_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_user_api_v1_users__user_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_workouts_calendar_month_api_v1_workouts_calendar_get: {
        parameters: {
            query?: {
                year?: number;
                month?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    complete_workout_api_v1_workouts_complete_post: {
        parameters: {
            query: {
                workout_id: number;
            };
            header?: {
                /** @description Client-generated key; duplicate requests replay the first successful response. */
                "Idempotency-Key"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkoutCompleteRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutCompleteResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_workout_history_api_v1_workouts_history_get: {
        parameters: {
            query?: {
                page?: number;
                page_size?: number;
                date_from?: string | null;
                date_to?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutHistoryResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_workout_detail_api_v1_workouts_history__workout_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workout_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutHistoryItem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_active_workout_api_v1_workouts_history__workout_id__patch: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-generated key; duplicate requests replay the first successful response. */
                "Idempotency-Key"?: string | null;
            };
            path: {
                workout_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkoutSessionUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutHistoryItem"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_weight_recommendation_api_v1_workouts_sessions__session_id__exercises__exercise_id__weight_recommendation_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: number;
                exercise_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    start_workout_api_v1_workouts_start_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkoutStartRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutStartResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    start_workout_from_template_with_overrides_api_v1_workouts_start_from_template__template_id__post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkoutStartFromTemplateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutStartResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_workout_templates_api_v1_workouts_templates_get: {
        parameters: {
            query?: {
                page?: number;
                page_size?: number;
                template_type?: string | null;
                include_archived?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutTemplateList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_workout_template_api_v1_workouts_templates_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkoutTemplateCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutTemplateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_workout_template_from_workout_api_v1_workouts_templates_from_workout_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkoutTemplateFromWorkoutCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutTemplateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_workout_template_api_v1_workouts_templates__template_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutTemplateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_workout_template_api_v1_workouts_templates__template_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkoutTemplateCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutTemplateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_workout_template_api_v1_workouts_templates__template_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    patch_workout_template_api_v1_workouts_templates__template_id__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkoutTemplatePatchRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutTemplateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    archive_workout_template_api_v1_workouts_templates__template_id__archive_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutTemplateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    clone_workout_template_api_v1_workouts_templates__template_id__clone_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkoutTemplateCloneRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutTemplateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    unarchive_workout_template_api_v1_workouts_templates__template_id__unarchive_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkoutTemplateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    app_liveness_health_live_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LivenessResponse"];
                };
            };
        };
    };
    app_readiness_health_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessResponse"];
                };
            };
        };
    };
    telegram_webhook_telegram_webhook_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
}
