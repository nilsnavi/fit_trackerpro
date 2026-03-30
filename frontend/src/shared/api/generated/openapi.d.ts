export type paths = {
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Root */
        get: operations["root__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/achievements/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Achievements
         * @deprecated
         */
        get: operations["get_achievements_api_v1_achievements__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/achievements/leaderboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Achievements Leaderboard
         * @deprecated
         */
        get: operations["get_achievements_leaderboard_api_v1_achievements_leaderboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/achievements/user": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get User Achievements
         * @deprecated
         */
        get: operations["get_user_achievements_api_v1_achievements_user_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/achievements/user/{achievement_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get User Achievement Detail
         * @deprecated
         */
        get: operations["get_user_achievement_detail_api_v1_achievements_user__achievement_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/achievements/{achievement_id}/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Claim Achievement
         * @deprecated
         */
        post: operations["claim_achievement_api_v1_achievements__achievement_id__claim_post"];
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
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Logout
         * @deprecated
         */
        post: operations["logout_api_v1_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Current User Info
         * @deprecated
         */
        get: operations["get_current_user_info_api_v1_auth_me_get"];
        /**
         * Update User Profile
         * @deprecated
         */
        put: operations["update_user_profile_api_v1_auth_me_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Refresh Token
         * @deprecated
         */
        post: operations["refresh_token_api_v1_auth_refresh_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/telegram": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Authenticate Telegram
         * @deprecated
         */
        post: operations["authenticate_telegram_api_v1_auth_telegram_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/challenges/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Challenges
         * @deprecated
         */
        get: operations["get_challenges_api_v1_challenges__get"];
        put?: never;
        /**
         * Create Challenge
         * @deprecated
         */
        post: operations["create_challenge_api_v1_challenges__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/challenges/my/active": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get My Active Challenges
         * @deprecated
         */
        get: operations["get_my_active_challenges_api_v1_challenges_my_active_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/challenges/{challenge_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Challenge
         * @deprecated
         */
        get: operations["get_challenge_api_v1_challenges__challenge_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/challenges/{challenge_id}/join": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Join Challenge
         * @deprecated
         */
        post: operations["join_challenge_api_v1_challenges__challenge_id__join_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/challenges/{challenge_id}/leaderboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Challenge Leaderboard
         * @deprecated
         */
        get: operations["get_challenge_leaderboard_api_v1_challenges__challenge_id__leaderboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/challenges/{challenge_id}/leave": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Leave Challenge
         * @deprecated
         */
        post: operations["leave_challenge_api_v1_challenges__challenge_id__leave_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/emergency/contact": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Emergency Contacts
         * @deprecated
         */
        get: operations["get_emergency_contacts_api_v1_emergency_contact_get"];
        put?: never;
        /**
         * Create Emergency Contact
         * @deprecated
         */
        post: operations["create_emergency_contact_api_v1_emergency_contact_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/emergency/contact/{contact_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Emergency Contact
         * @deprecated
         */
        get: operations["get_emergency_contact_api_v1_emergency_contact__contact_id__get"];
        /**
         * Update Emergency Contact
         * @deprecated
         */
        put: operations["update_emergency_contact_api_v1_emergency_contact__contact_id__put"];
        post?: never;
        /**
         * Delete Emergency Contact
         * @deprecated
         */
        delete: operations["delete_emergency_contact_api_v1_emergency_contact__contact_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/emergency/log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Log Emergency Event
         * @deprecated
         */
        post: operations["log_emergency_event_api_v1_emergency_log_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/emergency/notify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send Emergency Notification
         * @deprecated
         */
        post: operations["send_emergency_notification_api_v1_emergency_notify_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/emergency/notify/workout-end": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Notify Workout End
         * @deprecated
         */
        post: operations["notify_workout_end_api_v1_emergency_notify_workout_end_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/emergency/notify/workout-start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Notify Workout Start
         * @deprecated
         */
        post: operations["notify_workout_start_api_v1_emergency_notify_workout_start_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/emergency/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Emergency Settings
         * @deprecated
         */
        get: operations["get_emergency_settings_api_v1_emergency_settings_get"];
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
        /** System health check */
        get: operations["system_health_check"];
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
            /** Message */
            message: string;
            /** Success */
            success: boolean;
            /**
             * Token Type
             * @default bearer
             */
            token_type: string;
            user?: components["schemas"]["TelegramUserData"] | null;
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
             * Completed
             * @default true
             */
            completed: boolean;
            /**
             * Duration
             * @description Duration in seconds
             */
            duration?: number | null;
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
            /** Weight */
            weight?: number | null;
        };
        /**
         * CompletedSet
         * @description Completed set data
         */
        "CompletedSet-Output": {
            /**
             * Completed
             * @default true
             */
            completed: boolean;
            /**
             * Duration
             * @description Duration in seconds
             */
            duration?: number | null;
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
            category?: components["schemas"]["ExerciseCategory"] | null;
            /** Description */
            description?: string | null;
            /** Equipment */
            equipment?: string[] | null;
            /** Media Url */
            media_url?: string | null;
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
        /**
         * TelegramAuthRequest
         * @description Request model for Telegram authentication
         */
        TelegramAuthRequest: {
            /**
             * Init Data
             * @description Raw initData string from Telegram WebApp
             * @example query_id=...&user={...}&auth_date=...&hash=...
             */
            init_data: string;
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
            /** Equipment */
            equipment?: string[];
            /** Goals */
            goals?: string[];
            /** Limitations */
            limitations?: string[];
        } & {
            [key: string]: unknown;
        };
        /**
         * UserProfilePatch
         * @description Validated subset of profile JSON for updates (merged server-side).
         */
        UserProfilePatch: {
            /**
             * Equipment
             * @description At most 50 equipment tags.
             */
            equipment?: string[] | null;
            /**
             * Goals
             * @description At most 50 goal tags.
             */
            goals?: string[] | null;
            /**
             * Limitations
             * @description At most 50 limitation tags.
             */
            limitations?: string[] | null;
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
            /** Tags */
            tags: string[];
            /** Template Id */
            template_id: number | null;
            /** User Id */
            user_id: number;
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
            /** Tags */
            tags: string[];
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
         * WorkoutSessionType
         * @enum {string}
         */
        WorkoutSessionType: "cardio" | "strength" | "flexibility" | "mixed" | "custom";
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
    get_achievements_api_v1_achievements__get: {
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
    get_achievements_leaderboard_api_v1_achievements_leaderboard_get: {
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
    get_user_achievements_api_v1_achievements_user_get: {
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
    get_user_achievement_detail_api_v1_achievements_user__achievement_id__get: {
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
    claim_achievement_api_v1_achievements__achievement_id__claim_post: {
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
    get_exercise_progress_api_v1_analytics_progress_get: {
        parameters: {
            query?: {
                exercise_id?: number | null;
                period?: string;
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
    logout_api_v1_auth_logout_post: {
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
    get_current_user_info_api_v1_auth_me_get: {
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
    update_user_profile_api_v1_auth_me_put: {
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
    refresh_token_api_v1_auth_refresh_post: {
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
    authenticate_telegram_api_v1_auth_telegram_post: {
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
    get_challenges_api_v1_challenges__get: {
        parameters: {
            query?: {
                status?: string | null;
                challenge_type?: string | null;
                is_public?: boolean | null;
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
    create_challenge_api_v1_challenges__post: {
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
    get_my_active_challenges_api_v1_challenges_my_active_get: {
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
    get_challenge_api_v1_challenges__challenge_id__get: {
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
    join_challenge_api_v1_challenges__challenge_id__join_post: {
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
    get_challenge_leaderboard_api_v1_challenges__challenge_id__leaderboard_get: {
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
    leave_challenge_api_v1_challenges__challenge_id__leave_post: {
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
    get_emergency_contacts_api_v1_emergency_contact_get: {
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
    create_emergency_contact_api_v1_emergency_contact_post: {
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
    get_emergency_contact_api_v1_emergency_contact__contact_id__get: {
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
    update_emergency_contact_api_v1_emergency_contact__contact_id__put: {
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
    delete_emergency_contact_api_v1_emergency_contact__contact_id__delete: {
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
    log_emergency_event_api_v1_emergency_log_post: {
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
    send_emergency_notification_api_v1_emergency_notify_post: {
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
    notify_workout_end_api_v1_emergency_notify_workout_end_post: {
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
    notify_workout_start_api_v1_emergency_notify_workout_start_post: {
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
    get_emergency_settings_api_v1_emergency_settings_get: {
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
    get_workout_templates_api_v1_workouts_templates_get: {
        parameters: {
            query?: {
                page?: number;
                page_size?: number;
                template_type?: string | null;
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
