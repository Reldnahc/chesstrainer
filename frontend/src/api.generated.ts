// Generated from the backend OpenAPI contract. Run npm run api:generate.
export interface paths {
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login */
        post: operations["login_api_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Logout */
        post: operations["logout_api_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Logout All */
        post: operations["logout_all_api_auth_logout_all_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Identity */
        get: operations["get_identity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/onboarding/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Complete Onboarding */
        post: operations["complete_onboarding_api_auth_onboarding_complete_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Profile */
        post: operations["profile_api_auth_profile_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/signup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Signup */
        post: operations["signup_api_auth_signup_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/classification-runs/{run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Classification Run */
        get: operations["classification_run_api_classification_runs__run_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/classification-runs/{run_id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reject Classification */
        post: operations["reject_classification_api_classification_runs__run_id__reject_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/classifications/enrich": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enrich Classifications */
        post: operations["enrich_classifications_api_classifications_enrich_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/classifications/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retry Classifications */
        post: operations["retry_classifications_api_classifications_retry_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/course/teaching": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Generate Lesson Teaching */
        post: operations["generate_lesson_teaching_api_course_teaching_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/evidence/{decision_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Evidence */
        get: operations["evidence_api_evidence__decision_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/exercises/manual": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add Manual */
        post: operations["add_manual_api_exercises_manual_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game-providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Providers */
        get: operations["providers_api_game_providers_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/games": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Games */
        get: operations["games_api_games_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/games/{game_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Game Detail */
        get: operations["game_detail_api_games__game_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/games/{game_id}/analyze": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Analyze Variation */
        post: operations["analyze_variation_api_games__game_id__analyze_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/games/{game_id}/position": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Variation Position */
        post: operations["variation_position_api_games__game_id__position_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/games/{game_id}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Review Progress */
        get: operations["review_progress_api_games__game_id__review_get"];
        put?: never;
        /** Begin Review */
        post: operations["begin_review_api_games__game_id__review_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/games/{game_id}/train": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Train Game */
        post: operations["train_game_api_games__game_id__train_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Health */
        get: operations["get_health_api_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/human-model": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Human Model Readiness */
        get: operations["human_model_readiness_api_human_model_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/imports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Upload Pgn */
        post: operations["upload_pgn_api_imports_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/imports/chesscom": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Import Chesscom */
        post: operations["import_chesscom_api_imports_chesscom_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/imports/provider/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Import Provider */
        post: operations["import_provider_api_imports_provider__provider__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Jobs */
        get: operations["jobs_api_jobs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/jobs/{job_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Job */
        post: operations["cancel_job_api_jobs__job_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/jobs/{job_id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retry Job */
        post: operations["retry_job_api_jobs__job_id__retry_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/opening-studies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Studies */
        get: operations["studies_api_opening_studies_get"];
        put?: never;
        /** Enroll */
        post: operations["enroll_api_opening_studies_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/opening-studies/{study_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Study */
        get: operations["get_study_api_opening_studies__study_id__get"];
        put?: never;
        post?: never;
        /** Disable */
        delete: operations["disable_api_opening_studies__study_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/opening-studies/{study_id}/practice": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Practice */
        post: operations["practice_api_opening_studies__study_id__practice_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/opening-studies/{study_id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Restore */
        post: operations["restore_api_opening_studies__study_id__restore_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/openings/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Catalog */
        get: operations["catalog_api_openings_catalog_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/openings/catalog/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detail */
        get: operations["detail_api_openings_catalog__key__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/openings/course-lines/{course_id}/{line_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Course Line */
        get: operations["course_line_api_openings_course_lines__course_id___line_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/practice/queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Focused Queue */
        get: operations["focused_queue_api_practice_queue_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/preferences/audio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Audio Preferences */
        get: operations["get_audio_preferences_api_preferences_audio_get"];
        /** Put Audio Preferences */
        put: operations["put_audio_preferences_api_preferences_audio_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/preferences/coach": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Coach Preferences */
        get: operations["get_coach_preferences_api_preferences_coach_get"];
        /** Put Coach Preferences */
        put: operations["put_coach_preferences_api_preferences_coach_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/preferences/motion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Motion Preferences */
        get: operations["get_motion_preferences_api_preferences_motion_get"];
        /** Put Motion Preferences */
        put: operations["put_motion_preferences_api_preferences_motion_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/providers/{provider}/connection": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Save Connection */
        put: operations["save_connection_api_providers__provider__connection_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/providers/{provider}/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Provider Status */
        get: operations["provider_status_api_providers__provider__sync_get"];
        put?: never;
        /** Provider Sync */
        post: operations["provider_sync_api_providers__provider__sync_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/puzzle-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start */
        post: operations["start_api_puzzle_sessions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/puzzle-sessions/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Session */
        get: operations["get_session_api_puzzle_sessions__session_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/puzzle-sessions/{session_id}/move": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Move */
        post: operations["move_api_puzzle_sessions__session_id__move_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/puzzle-sessions/{session_id}/reveal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reveal */
        post: operations["reveal_api_puzzle_sessions__session_id__reveal_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/puzzles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Library */
        get: operations["library_api_puzzles_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/puzzles/next": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Next Puzzle */
        get: operations["next_puzzle_api_puzzles_next_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/review/count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Review Count */
        get: operations["review_count_api_review_count_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/review/queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Review Queue */
        get: operations["review_queue_api_review_queue_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/review/sessions/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resume */
        get: operations["resume_api_review_sessions__session_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/review/sessions/{session_id}/explanation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Review Explanation */
        get: operations["review_explanation_api_review_sessions__session_id__explanation_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/review/sessions/{session_id}/move": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Move */
        post: operations["move_api_review_sessions__session_id__move_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/review/sessions/{session_id}/reveal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Show Move */
        post: operations["show_move_api_review_sessions__session_id__reveal_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/review/{exercise_id}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Begin Review */
        post: operations["begin_review_api_review__exercise_id__start_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Settings */
        get: operations["get_settings_api_settings_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stats */
        get: operations["stats_api_stats_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/study/courses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Library */
        get: operations["library_api_study_courses_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/study/courses/{course_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Course */
        get: operations["course_api_study_courses__course_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/study/lesson-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start */
        post: operations["start_api_study_lesson_sessions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/study/lesson-sessions/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Session */
        get: operations["get_session_api_study_lesson_sessions__session_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/study/lesson-sessions/{session_id}/command": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Command */
        post: operations["command_api_study_lesson_sessions__session_id__command_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Sync */
        get: operations["get_sync_api_sync_get"];
        put?: never;
        /** Begin Sync */
        post: operations["begin_sync_api_sync_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/teaching-runs/{run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Teaching Audit */
        get: operations["teaching_audit_api_teaching_runs__run_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/teaching-runs/{run_id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reject Teaching */
        post: operations["reject_teaching_api_teaching_runs__run_id__reject_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/weaknesses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Weaknesses */
        get: operations["weaknesses_api_weaknesses_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** AcceptedAnswer */
        AcceptedAnswer: {
            /** Primary */
            primary: boolean;
            /** San */
            san: string;
            /** Uci */
            uci: string;
        };
        /** Account */
        Account: {
            /** Admin */
            admin: boolean;
            /** Chesscom Username */
            chesscom_username: string;
            /** Id */
            id: string;
            /** Onboarding Completed */
            onboarding_completed: boolean;
            /** Username */
            username: string;
        };
        /** AccountProfile */
        AccountProfile: {
            user: components["schemas"]["Account"];
        };
        /** ApiError */
        ApiError: {
            /** Detail */
            detail: string;
        };
        /** AudioPreferences */
        AudioPreferences: {
            /**
             * Board
             * @default true
             */
            board: boolean;
            /**
             * Enabled
             * @default true
             */
            enabled: boolean;
            /**
             * Practice
             * @default true
             */
            practice: boolean;
            /**
             * Volume
             * @default 0.35
             */
            volume: number;
        };
        /** BoardArrow */
        BoardArrow: {
            /** Endsquare */
            endSquare: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "move" | "reply" | "threat";
            /** Startsquare */
            startSquare: string;
        };
        /** BoardCues */
        BoardCues: {
            /** Arrows */
            arrows: components["schemas"]["BoardArrow"][];
            /** Caption */
            caption: string;
            /** Fen */
            fen: string;
            /** Roles */
            roles: {
                [key: string]: string[];
            };
        };
        /** Body_upload_pgn_api_imports_post */
        Body_upload_pgn_api_imports_post: {
            /**
             * Analyze
             * @default true
             */
            analyze: boolean;
            /** File */
            file: Blob;
            /**
             * Side
             * @default auto
             * @enum {string}
             */
            side: "auto" | "white" | "black";
            /**
             * Usernames
             * @default
             */
            usernames: string;
        };
        /** BookOpening */
        BookOpening: {
            /** Eco */
            eco: string | null;
            /** Name */
            name: string | null;
            /** Version */
            version: string;
        };
        /** Candidate */
        Candidate: {
            /**
             * Depth
             * @default 0
             */
            depth: number;
            /** Pv */
            pv: string[];
            /** San */
            san: string;
            score: components["schemas"]["Score"];
            /** Uci */
            uci: string;
        };
        /** ChessComImportProgress */
        ChessComImportProgress: {
            /** Archives Processed */
            archives_processed: number;
            /** Archives Total */
            archives_total: number;
            /** Duplicates */
            duplicates: number;
            /** End Date */
            end_date: string | null;
            /** Errors */
            errors: components["schemas"]["ImportError"][];
            /** Fetch Completed */
            fetch_completed: boolean;
            /** Filtered */
            filtered: number;
            /** Games Fetched */
            games_fetched: number;
            /** Games Imported */
            games_imported: number;
            /** Job Id */
            job_id: string;
            /** Max Games */
            max_games: number;
            /** Months */
            months: number;
            /**
             * Provider
             * @default chesscom
             */
            provider: string;
            /**
             * Provider Name
             * @default Chess.com
             */
            provider_name: string;
            /** Rejected */
            rejected: number;
            /** Start Date */
            start_date: string | null;
            /** Time Class */
            time_class: string;
            /** User Id */
            user_id: string;
            /** Username */
            username: string;
        };
        /** ChessComRequest */
        ChessComRequest: {
            /**
             * Analyze
             * @default true
             */
            analyze: boolean;
            /** End Date */
            end_date?: string | null;
            /**
             * Max Games
             * @default 100
             */
            max_games: number;
            /**
             * Months
             * @default 3
             */
            months: number;
            /** Start Date */
            start_date?: string | null;
            /**
             * Time Class
             * @default rapid
             * @enum {string}
             */
            time_class: "rapid" | "blitz" | "bullet" | "daily" | "all";
            /** Username */
            username: string;
        };
        /** ClassificationAudit */
        ClassificationAudit: {
            /** Attempts */
            attempts: number;
            /** Cache Key */
            cache_key: string;
            /** Confidence */
            confidence: number | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Decision Id */
            decision_id: string;
            /** Error */
            error: string | null;
            /** Id */
            id: string;
            /** Input Tokens */
            input_tokens: number;
            /** Model */
            model: string;
            /** Output Tokens */
            output_tokens: number;
            /** Prompt Version */
            prompt_version: string;
            /** Provider */
            provider: string;
            /** Response */
            response: {
                [key: string]: components["schemas"]["JsonValue"];
            } | null;
            /** Schema Version */
            schema_version: string;
            /** Status */
            status: string;
            /** User Id */
            user_id: string;
            /** Version */
            version: string;
        };
        /** ClockFacts */
        ClockFacts: {
            /**
             * After Band
             * @default unknown
             * @enum {string}
             */
            after_band: "critical" | "low" | "ample" | "unknown";
            /** After Seconds */
            after_seconds?: number | null;
            /**
             * Before Band
             * @default unknown
             * @enum {string}
             */
            before_band: "critical" | "low" | "ample" | "unknown";
            /** Before Seconds */
            before_seconds?: number | null;
            /**
             * Before Source
             * @default unknown
             * @enum {string}
             */
            before_source: "previous_clock" | "initial_control" | "unknown";
            /**
             * Control Kind
             * @default unknown
             * @enum {string}
             */
            control_kind: "increment" | "sudden_death" | "delay" | "staged" | "unknown";
            /** Elapsed Seconds */
            elapsed_seconds?: number | null;
            /**
             * Elapsed Source
             * @default unknown
             * @enum {string}
             */
            elapsed_source: "annotation" | "clock_delta" | "unknown";
            /** Increment Seconds */
            increment_seconds?: number | null;
            /** Limitations */
            limitations?: string[];
            /**
             * Status
             * @default absent
             * @enum {string}
             */
            status: "absent" | "annotated" | "invalid";
            /**
             * Tempo
             * @default unknown
             * @enum {string}
             */
            tempo: "fast_with_time" | "long_think" | "ordinary" | "unknown";
            /** Time Control */
            time_control?: string | null;
            /**
             * Version
             * @default clock-1
             * @constant
             */
            version: "clock-1";
        };
        /** CoachPreferences */
        CoachPreferences: {
            /**
             * Coach Id
             * @default classic
             * @enum {string}
             */
            coach_id: "classic" | "man-host" | "man-expert" | "man-partner" | "woman-captain" | "woman-analyst" | "woman-spark" | "woman-blonde" | "cat-tuxedo" | "cat-black" | "dog-gentle" | "dog-corgi" | "dog-collie" | "human-boy" | "human-girl" | "dog-puppy" | "cat-kitten" | "alien" | "unicorn" | "gorilla" | "robot" | "wizard" | "slime" | "dragon" | "ghost" | "raccoon" | "frog" | "capybara" | "mushroom" | "living-pawn";
            /**
             * Motion
             * @default system
             * @enum {string}
             */
            motion: "system" | "natural" | "still";
        };
        /** ColdPosition */
        ColdPosition: {
            /** Completed */
            completed?: boolean | null;
            /** Exercise Id */
            exercise_id: string;
            /** Failed */
            failed: boolean;
            feedback?: components["schemas"]["ReviewFeedback"] | null;
            /** Fen */
            fen: string;
            /** Last Attempt Id */
            last_attempt_id: string | null;
            /** Legal Moves */
            legal_moves: components["schemas"]["LegalMove"][];
            /** Non Scheduling Reason */
            non_scheduling_reason?: string | null;
            opening?: components["schemas"]["OpeningRecallContext"] | null;
            /**
             * Orientation
             * @enum {string}
             */
            orientation: "white" | "black";
            /** Practice Only */
            practice_only: boolean;
            /** Previous Reviews */
            previous_reviews: number;
            /**
             * Review Reason
             * @enum {string}
             */
            review_reason: "new" | "resume" | "learning" | "relearning" | "review" | "practice";
            /** Session Id */
            session_id: string;
        };
        /** Conditioning */
        Conditioning: {
            /** Opponent Rating */
            opponent_rating: number;
            /**
             * Opponent Source
             * @enum {string}
             */
            opponent_source: "pgn" | "fallback";
            /** Self Rating */
            self_rating: number;
            /**
             * Self Source
             * @enum {string}
             */
            self_source: "pgn" | "fallback";
        };
        /** ContextNode */
        ContextNode: {
            /**
             * Actor
             * @enum {string}
             */
            actor: "white" | "black";
            after: components["schemas"]["Score"];
            before: components["schemas"]["Score"];
            /** Event Ids */
            event_ids: string[];
            /** Evidence */
            evidence: components["schemas"]["EvidenceReference"][];
            /** Input Digest */
            input_digest: string;
            /** Ply */
            ply: number;
        };
        /** Coverage */
        Coverage: {
            /** Abstention Reasons */
            abstention_reasons: {
                [key: string]: number;
            };
            /** Labeled */
            labeled: number;
            /** Mechanisms */
            mechanisms: number;
            /** Outcome Only */
            outcome_only: number;
            /** Outcomes */
            outcomes: number;
            /** Pending */
            pending: number;
            /** Total */
            total: number;
            /** Unclassified */
            unclassified: number;
        };
        /** CreatedId */
        CreatedId: {
            /** Id */
            id: string;
        };
        /** Credentials */
        Credentials: {
            /** Password */
            password: string;
            /** Username */
            username: string;
        };
        /** CrossGameContext */
        CrossGameContext: {
            /** Input Digest */
            input_digest: string;
            /** Limitations */
            limitations: string[];
            /** Recurrence Threshold */
            recurrence_threshold: number;
            /**
             * Scope
             * @default other_saved_games
             * @constant
             */
            scope: "other_saved_games";
            /**
             * Version
             * @default cross-game-1
             * @constant
             */
            version: "cross-game-1";
            /** Weaknesses */
            weaknesses: components["schemas"]["HistoricalWeakness"][];
        };
        /** DifficultyComponents */
        DifficultyComponents: {
            /** Acceptable Count Lower Bound */
            acceptable_count_lower_bound: number;
            /** Alternatives Complete */
            alternatives_complete: boolean;
            /** Best Forcing Plies */
            best_forcing_plies: number;
            /** Best Probability */
            best_probability?: number | null;
            /** Best Rank */
            best_rank?: number | null;
            /** Best Supported Horizon */
            best_supported_horizon: number;
            /** Candidate Gap Cp */
            candidate_gap_cp?: number | null;
            /**
             * Mate Transition
             * @enum {string}
             */
            mate_transition: "allowed" | "missed" | "none";
            /** Normalized Entropy */
            normalized_entropy?: number | null;
            /** Only Good Move At Depth */
            only_good_move_at_depth: boolean | null;
            /** Played Probability */
            played_probability?: number | null;
            /** Played Rank */
            played_rank?: number | null;
            /** Top Three Mass */
            top_three_mass?: number | null;
            /** Verified Sacrifice */
            verified_sacrifice: boolean;
        };
        /** Domain */
        Domain: {
            /**
             * Alignment
             * @enum {string}
             */
            alignment: "related" | "shifted" | "unknown";
            /**
             * Calibration
             * @default unvalidated
             * @constant
             */
            calibration: "unvalidated";
            /** History From Start */
            history_from_start: boolean;
            /**
             * Platform
             * @enum {string}
             */
            platform: "lichess" | "chesscom" | "unknown";
            /** Reasons */
            reasons: string[];
            /** Time Class */
            time_class: string | null;
            /** Time Control */
            time_control: string | null;
        };
        /** Evidence */
        Evidence: {
            /** Allows Mate */
            allows_mate: boolean;
            /** Candidates */
            candidates: components["schemas"]["Candidate"][];
            /** Classifications */
            classifications: components["schemas"]["EvidenceClassification"][];
            /** Facts */
            facts: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            /** Fen */
            fen: string;
            /** Id */
            id: string;
            /** Loss Cp */
            loss_cp: number | null;
            /** Mate Lost */
            mate_lost: boolean;
            /** Played San */
            played_san: string;
            /** Ply */
            ply: number;
        };
        /** EvidenceClassification */
        EvidenceClassification: {
            /** Confidence */
            confidence: number;
            /** Explanation */
            explanation: string;
            /** Findings */
            findings: components["schemas"]["Finding"][];
            /** Provider */
            provider: string;
            /** Run Id */
            run_id: string;
            /** Skill */
            skill: string;
        };
        /** EvidenceReference */
        EvidenceReference: {
            /** Field */
            field: string;
            /** Id */
            id: string;
            /** Ply */
            ply?: number | null;
            /**
             * Source
             * @enum {string}
             */
            source: "stockfish" | "human" | "rule" | "pgn" | "book" | "position" | "weakness";
        };
        /** Finding */
        Finding: {
            /**
             * Actor
             * @enum {string}
             */
            actor: "white" | "black";
            /** Analysis Id */
            analysis_id: string;
            /** Context Fen */
            context_fen?: string | null;
            /** Context Move */
            context_move?: string | null;
            /**
             * Cue
             * @default
             */
            cue: string;
            /**
             * Direction
             * @enum {string}
             */
            direction: "missed_opportunity" | "allowed_opponent_tactic";
            /** Explanation */
            explanation: string;
            /**
             * Frame Ply
             * @default 0
             */
            frame_ply: number;
            /** Moves */
            moves: string[];
            /** Plies */
            plies: number[];
            /** Roles */
            roles?: {
                [key: string]: string[];
            };
            /** Rule Id */
            rule_id: string;
            /** Skill Id */
            skill_id: string;
            /** Squares */
            squares: string[];
            /**
             * Verification
             * @enum {string}
             */
            verification: "engine_mate" | "verified_line" | "engine_defense";
            /** Verification Analysis Ids */
            verification_analysis_ids?: string[];
        };
        /** Frame */
        Frame: {
            /** Annotation */
            annotation: string;
            /** Capture */
            capture?: string | null;
            /** Fen */
            fen: string;
            /**
             * Gives Check
             * @default false
             */
            gives_check: boolean;
            /** Highlights */
            highlights: string[];
            /** Material Change */
            material_change: number;
            /** San */
            san: string;
            /** Uci */
            uci: string | null;
        };
        /** GameAccuracy */
        GameAccuracy: {
            /** Black */
            black: number;
            /** Version */
            version: string;
            /** White */
            white: number;
        };
        /** GameAnalysis */
        GameAnalysis: {
            /** Best Move */
            best_move: string | null;
            report: components["schemas"]["GameReviewReport"] | null;
            score: components["schemas"]["Score"] | null;
        };
        /** GameContext */
        GameContext: {
            /** Biggest Swing Ply */
            biggest_swing_ply: number | null;
            /** Complete */
            complete: boolean;
            /** Input Digest */
            input_digest: string;
            /** Limitations */
            limitations: string[];
            /** Missing Plies */
            missing_plies: number[];
            /** Nodes */
            nodes: components["schemas"]["ContextNode"][];
            /** Relationships */
            relationships: components["schemas"]["GameRelationship"][];
            /** Total Plies */
            total_plies: number;
            /** Turning Points */
            turning_points: components["schemas"]["TurningPoint"][];
            /**
             * Version
             * @default game-context-1
             * @constant
             */
            version: "game-context-1";
        };
        /** GameDetail */
        GameDetail: {
            accuracy: components["schemas"]["GameAccuracy"] | null;
            /** Black */
            black: string;
            /** Black Rating */
            black_rating: number | null;
            context?: components["schemas"]["GameContext"] | null;
            /** Frames */
            frames: components["schemas"]["GameFrame"][];
            history?: components["schemas"]["CrossGameContext"] | null;
            /** Id */
            id: string;
            job: components["schemas"]["ReviewJob"] | null;
            /**
             * Orientation
             * @enum {string}
             */
            orientation: "white" | "black";
            /** Played On */
            played_on: string | null;
            /** Rating */
            rating: number;
            /** Result */
            result: string;
            /**
             * Review Revision
             * @default 0
             */
            review_revision: number;
            /** White */
            white: string;
            /** White Rating */
            white_rating: number | null;
        };
        /** GameFrame */
        GameFrame: {
            /** Actor */
            actor: ("white" | "black") | null;
            /** Fen */
            fen: string;
            /** Legal Moves */
            legal_moves: components["schemas"]["LegalMove"][];
            /** Number */
            number: number;
            report: components["schemas"]["GameReviewReport"] | null;
            /** Result */
            result: string | null;
            /** San */
            san: string;
            /** Termination */
            termination: string | null;
            /**
             * Turn
             * @enum {string}
             */
            turn: "white" | "black";
            /** Uci */
            uci: string | null;
        };
        /** GameHistory */
        GameHistory: {
            /** Items */
            items: components["schemas"]["GameHistoryItem"][];
            /** Total */
            total: number;
        };
        /** GameHistoryItem */
        GameHistoryItem: {
            accuracy: components["schemas"]["GameAccuracy"] | null;
            /** Black */
            black: string;
            /** Black Rating */
            black_rating: number | null;
            /** Id */
            id: string;
            /**
             * Learner Color
             * @enum {string}
             */
            learner_color: "white" | "black";
            /** Move Count */
            move_count: number;
            /** Played At */
            played_at: string | null;
            /** Played On */
            played_on: string | null;
            /** Result */
            result: string;
            /** Status */
            status: string;
            /** Time Control */
            time_control: string | null;
            /** Time Control Label */
            time_control_label: string | null;
            /** White */
            white: string;
            /** White Rating */
            white_rating: number | null;
        };
        /** GameMoveReport */
        GameMoveReport: {
            actual: components["schemas"]["Candidate"];
            best: components["schemas"]["Candidate"];
            board_cues: components["schemas"]["BoardCues"] | null;
            /** Coach */
            coach: string;
            /** Depth */
            depth: number;
            /**
             * Engine Label
             * @enum {string}
             */
            engine_label: "Brilliant" | "Great" | "Best" | "Good" | "Book" | "Inaccuracy" | "Mistake" | "Miss" | "Blunder";
            /** Engine Version */
            engine_version: string;
            human?: components["schemas"]["HumanEvidence"] | null;
            immediate_reply?: components["schemas"]["Frame"] | null;
            intelligence?: components["schemas"]["MoveIntelligence"] | null;
            /**
             * Label
             * @enum {string}
             */
            label: "Brilliant" | "Great" | "Best" | "Good" | "Book" | "Inaccuracy" | "Mistake" | "Miss" | "Blunder";
            opening: components["schemas"]["BookOpening"] | null;
            practical?: components["schemas"]["PracticalAssessment"] | null;
            /** Reason */
            reason: string;
            refinement?: components["schemas"]["RefinementInfo"] | null;
            white_score: components["schemas"]["Score"];
        };
        /** GamePosition */
        GamePosition: {
            /** Fen */
            fen: string;
            /** Legal Moves */
            legal_moves: components["schemas"]["LegalMove"][];
            /** Result */
            result: string | null;
            /** San */
            san: string | null;
            /** Termination */
            termination: string | null;
            /**
             * Turn
             * @enum {string}
             */
            turn: "white" | "black";
        };
        /** GameProvider */
        GameProvider: {
            /** Id */
            id: string;
            /** Name */
            name: string;
            /** Time Classes */
            time_classes: string[];
        };
        /** GameRelationship */
        GameRelationship: {
            /**
             * Actor
             * @enum {string}
             */
            actor: "white" | "black";
            /** Event Ids */
            event_ids: string[];
            /** Evidence */
            evidence: components["schemas"]["EvidenceReference"][];
            /** Facts */
            facts: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            /** Id */
            id: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "repeated_motif" | "punishment" | "recovery" | "advantage_run" | "erosion" | "support_restored";
            /** Plies */
            plies: number[];
        };
        /** GameReviewReport */
        GameReviewReport: {
            actual: components["schemas"]["Candidate"];
            actual_line: components["schemas"]["ReviewLine"];
            /** Before Analysis Id */
            before_analysis_id: string;
            best: components["schemas"]["Candidate"];
            best_line: components["schemas"]["ReviewLine"];
            board_cues: components["schemas"]["BoardCues"] | null;
            /** Coach */
            coach: string;
            /** Depth */
            depth: number;
            /**
             * Engine Label
             * @enum {string}
             */
            engine_label: "Brilliant" | "Great" | "Best" | "Good" | "Book" | "Inaccuracy" | "Mistake" | "Miss" | "Blunder";
            /** Engine Version */
            engine_version: string;
            human?: components["schemas"]["HumanEvidence"] | null;
            immediate_reply?: components["schemas"]["Frame"] | null;
            intelligence?: components["schemas"]["MoveIntelligence"] | null;
            /**
             * Label
             * @enum {string}
             */
            label: "Brilliant" | "Great" | "Best" | "Good" | "Book" | "Inaccuracy" | "Mistake" | "Miss" | "Blunder";
            /** Legal Count */
            legal_count: number;
            /** Loss Cp */
            loss_cp: number | null;
            opening: components["schemas"]["BookOpening"] | null;
            /** Opportunity Missed */
            opportunity_missed: boolean;
            /** Played Analysis Id */
            played_analysis_id: string;
            practical?: components["schemas"]["PracticalAssessment"] | null;
            previous_score: components["schemas"]["Score"] | null;
            /** Reason */
            reason: string;
            refinement?: components["schemas"]["RefinementInfo"] | null;
            /** Root Candidates */
            root_candidates?: components["schemas"]["Candidate"][] | null;
            sacrifice: components["schemas"]["SacrificeEvidence"] | null;
            second_score: components["schemas"]["Score"] | null;
            /** Version */
            version: string;
            white_score: components["schemas"]["Score"];
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** Health */
        Health: {
            /** Classification Available */
            classification_available: boolean;
            /** Database */
            database: string;
            /** Engine Available */
            engine_available: boolean | null;
            /** Engine Error */
            engine_error: string | null;
            /**
             * Engine Status
             * @enum {string}
             */
            engine_status: "unchecked" | "ready" | "unavailable";
            /** Engine Version */
            engine_version: string | null;
        };
        /** HistoricalWeakness */
        HistoricalWeakness: {
            /** Decision Ids */
            decision_ids: string[];
            /** Evidence */
            evidence: components["schemas"]["EvidenceReference"][];
            /** Game Ids */
            game_ids: string[];
            /** Independent Games */
            independent_games: number;
            /** Occurrences */
            occurrences: number;
            /** Related Plies */
            related_plies: number[];
            /** Skill Id */
            skill_id: string;
            /**
             * Status
             * @enum {string}
             */
            status: "provisional" | "supported";
            /** Title */
            title: string;
        };
        /** HumanEvidence */
        HumanEvidence: {
            conditioning: components["schemas"]["Conditioning"];
            /** Configuration Key */
            configuration_key: string;
            domain: components["schemas"]["Domain"];
            engine_best?: components["schemas"]["HumanMove"] | null;
            /** Evidence Id */
            evidence_id?: string | null;
            /** History Key */
            history_key: string;
            /** Legal Count */
            legal_count: number;
            /**
             * Mover
             * @enum {string}
             */
            mover: "white" | "black";
            /** Normalized Entropy */
            normalized_entropy?: number | null;
            played?: components["schemas"]["HumanMove"] | null;
            provenance?: components["schemas"]["ModelProvenance"] | null;
            /**
             * Schema Version
             * @default human-evidence-1
             * @constant
             */
            schema_version: "human-evidence-1";
            /**
             * Status
             * @enum {string}
             */
            status: "available" | "disabled" | "unavailable" | "cancelled" | "not_applicable";
            /** Top Moves */
            top_moves?: components["schemas"]["HumanMove"][];
            /** Top Three Mass */
            top_three_mass?: number | null;
            /** Unavailable Reason */
            unavailable_reason?: string | null;
        };
        /** HumanMove */
        HumanMove: {
            /** Probability */
            probability?: number | null;
            /** Rank */
            rank: number;
            /** Uci */
            uci: string;
        };
        /** HumanReadiness */
        HumanReadiness: {
            /** Message */
            message?: string | null;
            /**
             * Model
             * @default 79m
             */
            model: string;
            /**
             * Provider
             * @default maia3
             */
            provider: string;
            /**
             * Status
             * @enum {string}
             */
            status: "disabled" | "not_configured" | "unchecked" | "ready" | "unavailable";
        };
        /** Identity */
        Identity: {
            /** Csrf */
            csrf?: string | null;
            /** Enabled */
            enabled: boolean;
            user: components["schemas"]["Account"] | null;
        };
        /** ImportError */
        ImportError: {
            /** Archive */
            archive?: string | null;
            /** Error */
            error: string;
            /** Game */
            game?: number | null;
        };
        /** Job */
        Job: {
            activity: components["schemas"]["JobActivity"] | null;
            /** Cancel Requested */
            cancel_requested: boolean;
            chesscom: components["schemas"]["ChessComImportProgress"] | null;
            /** Classifications Completed */
            classifications_completed: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Deep Completed */
            deep_completed: number;
            /** Error */
            error: string | null;
            /** Games Processed */
            games_processed: number;
            /** Games Total */
            games_total: number;
            /** Id */
            id: string;
            /** Import Id */
            import_id: string | null;
            /** Kind */
            kind: string;
            /** Mistakes Identified */
            mistakes_identified: number;
            /** Positions Triaged */
            positions_triaged: number;
            /** Probe Total */
            probe_total: number | null;
            provider_import?: components["schemas"]["ChessComImportProgress"] | null;
            /** Status */
            status: string;
            /** User Id */
            user_id: string;
        };
        /** JobActivity */
        JobActivity: {
            classifications: components["schemas"]["WorkerActivity"];
            games: components["schemas"]["WorkerActivity"];
        };
        /** JobCreated */
        JobCreated: {
            /** Job Id */
            job_id: string;
        };
        /** JobStarted */
        JobStarted: {
            /** Job Id */
            job_id: string;
            /** Status */
            status: string;
        };
        /** JobStatus */
        JobStatus: {
            /** Status */
            status: string;
        };
        JsonValue: unknown;
        /** LegalMove */
        LegalMove: {
            /** Capture */
            capture: boolean;
            /** From Square */
            from_square: string;
            /** Promotion */
            promotion: ("q" | "r" | "b" | "n") | null;
            /** To Square */
            to_square: string;
        };
        /** LessonAnnotations */
        LessonAnnotations: {
            /** Arrows */
            arrows?: components["schemas"]["LessonArrow"][];
            /** Squares */
            squares?: string[];
        };
        /** LessonArrow */
        LessonArrow: {
            /** From Square */
            from_square: string;
            /** To Square */
            to_square: string;
        };
        /** LessonAttribution */
        LessonAttribution: {
            /** License */
            license?: string | null;
            /** Text */
            text: string;
            /** Url */
            url?: string | null;
        };
        /** LessonBranchView */
        LessonBranchView: {
            /** Title */
            title: string;
        };
        /** LessonChapterSummary */
        LessonChapterSummary: {
            /** Completed */
            completed: boolean;
            /** Id */
            id: string;
            /** Title */
            title: string;
        };
        /** LessonCommand */
        LessonCommand: {
            /**
             * Action
             * @enum {string}
             */
            action: "continue" | "back" | "move" | "hint" | "show_move" | "enter_branch" | "return_branch" | "open_game" | "close_game" | "game_seek";
            /** Ply */
            ply?: number | null;
            /** Request Id */
            request_id: string;
            /** Revision */
            revision: number;
            /** Uci */
            uci?: string | null;
        };
        /** LessonCourseSummary */
        LessonCourseSummary: {
            /** Chapter Count */
            chapter_count: number;
            /** Completed Chapters */
            completed_chapters: number;
            /** Description */
            description: string;
            /** Id */
            id: string;
            /**
             * Learner Color
             * @enum {string}
             */
            learner_color: "white" | "black";
            /** Revision */
            revision: string;
            /** Title */
            title: string;
        };
        /** LessonCourseView */
        LessonCourseView: {
            /** Attributions */
            attributions: components["schemas"]["LessonAttribution"][];
            /** Chapters */
            chapters: components["schemas"]["LessonChapterSummary"][];
            /** Description */
            description: string;
            /** Id */
            id: string;
            /**
             * Learner Color
             * @enum {string}
             */
            learner_color: "white" | "black";
            /** Lines */
            lines: components["schemas"]["LessonLineSummary"][];
            /** Revision */
            revision: string;
            /** Title */
            title: string;
        };
        /** LessonFeedback */
        LessonFeedback: {
            /**
             * Kind
             * @enum {string}
             */
            kind: "correct" | "incorrect" | "revealed" | "hint";
            /** Text */
            text: string;
        };
        /** LessonGameNote */
        LessonGameNote: {
            annotations: components["schemas"]["LessonAnnotations"];
            /** Text */
            text: string;
        };
        /** LessonGameView */
        LessonGameView: {
            /** Attributions */
            attributions: components["schemas"]["LessonAttribution"][];
            note: components["schemas"]["LessonGameNote"] | null;
            /** Ply */
            ply: number;
            /** Title */
            title: string;
            /** Total Plies */
            total_plies: number;
        };
        /** LessonLibrary */
        LessonLibrary: {
            /** Courses */
            courses: components["schemas"]["LessonCourseSummary"][];
            /** Resume */
            resume: components["schemas"]["LessonResume"][];
        };
        /** LessonLineSummary */
        LessonLineSummary: {
            /** Id */
            id: string;
            /** Repertoire */
            repertoire: boolean;
            /** Title */
            title: string;
        };
        /** LessonResume */
        LessonResume: {
            /** Chapter Id */
            chapter_id: string;
            /** Chapter Title */
            chapter_title: string;
            /** Course Id */
            course_id: string;
            /** Course Revision */
            course_revision: string;
            /** Course Title */
            course_title: string;
            /** Id */
            id: string;
            /** Updated At */
            updated_at: string;
        };
        /** LessonSessionView */
        LessonSessionView: {
            /** Actions */
            actions: ("continue" | "back" | "move" | "hint" | "show_move" | "enter_branch" | "return_branch" | "open_game" | "close_game" | "game_seek")[];
            /** Assisted */
            assisted: boolean;
            branch: components["schemas"]["LessonBranchView"] | null;
            /** Chapter Id */
            chapter_id: string;
            /** Chapter Title */
            chapter_title: string;
            /** Course Id */
            course_id: string;
            /** Course Revision */
            course_revision: string;
            /** Course Title */
            course_title: string;
            /** Failed */
            failed: boolean;
            feedback: components["schemas"]["LessonFeedback"] | null;
            /** Fen */
            fen: string;
            game: components["schemas"]["LessonGameView"] | null;
            /** History */
            history: components["schemas"]["PuzzleFrame"][];
            /** Id */
            id: string;
            /** Legal Moves */
            legal_moves: components["schemas"]["LegalMove"][];
            /**
             * Orientation
             * @enum {string}
             */
            orientation: "white" | "black";
            /** Playback */
            playback: components["schemas"]["PuzzleFrame"][];
            /** Revision */
            revision: number;
            /**
             * Status
             * @enum {string}
             */
            status: "active" | "completed";
            step: components["schemas"]["LessonStepView"];
        };
        /** LessonStart */
        LessonStart: {
            /** Chapter Id */
            chapter_id: string;
            /** Course Id */
            course_id: string;
            /** Course Revision */
            course_revision: string;
            /** Request Id */
            request_id: string;
        };
        /** LessonStepView */
        LessonStepView: {
            annotations: components["schemas"]["LessonAnnotations"];
            /** Id */
            id: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "explanation" | "demonstration" | "decision" | "branch" | "game_excerpt" | "rehearsal";
            /**
             * Phase
             * @enum {string}
             */
            phase: "ready" | "complete";
            /** Text */
            text: string;
            /** Title */
            title: string;
        };
        /** ManualRequest */
        ManualRequest: {
            /**
             * Explanation
             * @default
             */
            explanation: string;
            /** Fen */
            fen: string;
            /** Moves */
            moves: string[];
            /**
             * Orientation
             * @default white
             * @enum {string}
             */
            orientation: "white" | "black";
            /** Tags */
            tags?: string[];
        };
        /** ModelProvenance */
        ModelProvenance: {
            /** Adapter Version */
            adapter_version: string;
            /** Checkpoint Sha256 */
            checkpoint_sha256: string;
            /** Code Revision */
            code_revision: string;
            /** Inference */
            inference: {
                [key: string]: string | number | boolean;
            };
            /** Model */
            model: string;
            /** Model Revision */
            model_revision: string;
            /** Provider */
            provider: string;
        };
        /** MotionPreferences */
        MotionPreferences: {
            /**
             * Motion
             * @default system
             * @enum {string}
             */
            motion: "system" | "natural" | "still";
        };
        /** MoveExplanation */
        MoveExplanation: {
            /** Accepted */
            accepted: boolean;
            /** Analysis Id */
            analysis_id?: string | null;
            /** Attempt Id */
            attempt_id: string | null;
            /**
             * Authority
             * @enum {string}
             */
            authority: "stockfish" | "curated";
            /** Engine Version */
            engine_version?: string | null;
            /** Findings */
            findings?: components["schemas"]["Finding"][];
            /** Frames */
            frames: components["schemas"]["Frame"][];
            /** Move San */
            move_san: string;
            /** Move Uci */
            move_uci: string;
            /** Notes */
            notes: string[];
            /**
             * Orientation
             * @enum {string}
             */
            orientation: "white" | "black";
            score?: components["schemas"]["Score"] | null;
            /** Summary */
            summary: string;
            /**
             * Version
             * @default 1
             */
            version: string;
        };
        /** MoveIntelligence */
        MoveIntelligence: {
            clock: components["schemas"]["ClockFacts"] | null;
            /** Events */
            events: components["schemas"]["ReviewEvent"][];
            /** Input Digest */
            input_digest: string;
            /** Limitations */
            limitations: string[];
            /** Ply */
            ply: number | null;
            /**
             * Version
             * @default move-events-4
             * @constant
             */
            version: "move-events-4";
        };
        /** MoveRequest */
        MoveRequest: {
            /** From Square */
            from_square: string;
            /** Promotion */
            promotion?: ("q" | "r" | "b" | "n") | null;
            /** To Square */
            to_square: string;
        };
        /** Ok */
        Ok: {
            /** Ok */
            ok: boolean;
        };
        /** OpeningCatalogue */
        OpeningCatalogue: {
            /** Items */
            items: components["schemas"]["OpeningLineSummary"][];
            /** Total */
            total: number;
            /** Version */
            version: string;
        };
        /** OpeningContinuation */
        OpeningContinuation: {
            /** Moves */
            moves: components["schemas"]["PuzzleFrame"][];
            /** Name */
            name: string;
            /** Study Id */
            study_id: string;
        };
        /** OpeningEnrollment */
        OpeningEnrollment: {
            /**
             * Color
             * @enum {string}
             */
            color: "white" | "black";
            /** Course Id */
            course_id?: string | null;
            /** Line Id */
            line_id?: string | null;
            /**
             * Source
             * @enum {string}
             */
            source: "lichess_catalogue" | "course_line";
            /** Source Key */
            source_key: string;
            /** Source Version */
            source_version: string;
        };
        /** OpeningLine */
        OpeningLine: {
            /** Course Id */
            course_id?: string | null;
            /** Eco */
            eco: string | null;
            /** Initial Fen */
            initial_fen: string;
            /** Line Id */
            line_id?: string | null;
            /** Moves */
            moves: string[];
            /** Name */
            name: string;
            /**
             * Source
             * @enum {string}
             */
            source: "lichess_catalogue" | "course_line";
            /** Source Key */
            source_key: string;
            /** Source Version */
            source_version: string;
        };
        /** OpeningLineSummary */
        OpeningLineSummary: {
            /** Black Positions */
            black_positions: number;
            /** Eco */
            eco: string | null;
            /** Name */
            name: string;
            /** Plies */
            plies: number;
            /** Source Key */
            source_key: string;
            /** Source Version */
            source_version: string;
            /** White Positions */
            white_positions: number;
        };
        /** OpeningLineView */
        OpeningLineView: {
            /** Black Positions */
            black_positions: number;
            /** Frames */
            frames: components["schemas"]["PuzzleFrame"][];
            line: components["schemas"]["OpeningLine"];
            /** White Positions */
            white_positions: number;
        };
        /** OpeningPracticeStart */
        OpeningPracticeStart: {
            /** Request Id */
            request_id: string;
        };
        /** OpeningRecallContext */
        OpeningRecallContext: {
            /**
             * Color
             * @enum {string}
             */
            color: "white" | "black";
            /** Names */
            names: string[];
            /** Prompt */
            prompt: string;
            /** Revision */
            revision: number;
        };
        /** OpeningStudyLibrary */
        OpeningStudyLibrary: {
            /** Active Studies */
            active_studies: number;
            /** Due Positions */
            due_positions: number;
            /** Items */
            items: components["schemas"]["OpeningStudySummary"][];
            /** Learning Positions */
            learning_positions: number;
        };
        /** OpeningStudySummary */
        OpeningStudySummary: {
            /** Active */
            active: boolean;
            /**
             * Color
             * @enum {string}
             */
            color: "white" | "black";
            /** Due Positions */
            due_positions: number;
            /** Eco */
            eco: string | null;
            /** Id */
            id: string;
            /** Name */
            name: string;
            /** Positions */
            positions: number;
            /**
             * Source
             * @enum {string}
             */
            source: "lichess_catalogue" | "course_line";
            /** Source Key */
            source_key: string;
            /** Source Version */
            source_version: string;
        };
        /** OpeningStudyView */
        OpeningStudyView: {
            /** Active */
            active: boolean;
            /**
             * Color
             * @enum {string}
             */
            color: "white" | "black";
            /** Due Positions */
            due_positions: number;
            /** Eco */
            eco: string | null;
            /** Frames */
            frames: components["schemas"]["PuzzleFrame"][];
            /** Id */
            id: string;
            line: components["schemas"]["OpeningLine"];
            /** Name */
            name: string;
            /** Positions */
            positions: number;
            /**
             * Source
             * @enum {string}
             */
            source: "lichess_catalogue" | "course_line";
            /** Source Key */
            source_key: string;
            /** Source Version */
            source_version: string;
        };
        /** PgnImportResult */
        PgnImportResult: {
            /** Duplicates */
            duplicates: number;
            /** Errors */
            errors: components["schemas"]["ImportError"][];
            /** Import Id */
            import_id: string;
            /** Imported */
            imported: number;
            /** Job Id */
            job_id: string | null;
            /** Processed */
            processed: number;
        };
        /** PracticalAssessment */
        PracticalAssessment: {
            /**
             * Best Find Difficulty
             * @enum {string}
             */
            best_find_difficulty: "forced" | "natural" | "challenging" | "difficult" | "unknown";
            /**
             * Best Naturalness
             * @enum {string}
             */
            best_naturalness: "preferred" | "plausible" | "unusual" | "unknown";
            /**
             * Calibration
             * @default uncalibrated
             * @constant
             */
            calibration: "uncalibrated";
            components: components["schemas"]["DifficultyComponents"];
            /**
             * Confidence
             * @enum {string}
             */
            confidence: "structural" | "heuristic" | "limited" | "unavailable";
            /** Human Evidence Id */
            human_evidence_id: string | null;
            /** Input Digest */
            input_digest: string;
            /** Interpretations */
            interpretations?: ("forced_reply" | "natural_error" | "unusual_strong_move" | "natural_best" | "hard_to_find_defense" | "immediate_mate_missed")[];
            /** Limitations */
            limitations: string[];
            /**
             * Played Naturalness
             * @enum {string}
             */
            played_naturalness: "preferred" | "plausible" | "unusual" | "unknown";
            /**
             * Probe Version
             * @default synthetic-probe-1
             * @constant
             */
            probe_version: "synthetic-probe-1";
            /** Stockfish Analysis Ids */
            stockfish_analysis_ids: string[];
            /**
             * Version
             * @default practical-2
             * @constant
             */
            version: "practical-2";
        };
        /** PracticeQueueItem */
        PracticeQueueItem: {
            /** Exercise Id */
            exercise_id: string;
        };
        /** Profile */
        Profile: {
            /**
             * Chesscom Username
             * @default
             */
            chesscom_username: string;
        };
        /** ProviderConnectionRequest */
        ProviderConnectionRequest: {
            /** Username */
            username: string;
        };
        /** ProviderImportRequest */
        ProviderImportRequest: {
            /**
             * Analyze
             * @default true
             */
            analyze: boolean;
            /** End Date */
            end_date?: string | null;
            /**
             * Max Games
             * @default 100
             */
            max_games: number;
            /**
             * Months
             * @default 3
             */
            months: number;
            /** Start Date */
            start_date?: string | null;
            /**
             * Time Class
             * @default rapid
             */
            time_class: string;
            /** Username */
            username: string;
        };
        /** PuzzleCommand */
        PuzzleCommand: {
            /** Request Id */
            request_id: string;
            /** Revision */
            revision: number;
        };
        /** PuzzleCompletion */
        PuzzleCompletion: {
            provenance: components["schemas"]["PuzzleProvenance"];
            /** Rating */
            rating: number | null;
            /** Solution */
            solution: components["schemas"]["PuzzleFrame"][];
            /** Themes */
            themes: string[];
        };
        /** PuzzleFeedback */
        PuzzleFeedback: {
            /**
             * Grade
             * @enum {string}
             */
            grade: "correct" | "incorrect" | "revealed";
            /** Submitted San */
            submitted_san: string | null;
        };
        /** PuzzleFrame */
        PuzzleFrame: {
            /** After Fen */
            after_fen: string;
            /** Before Fen */
            before_fen: string;
            /** San */
            san: string;
            /** Uci */
            uci: string;
        };
        /** PuzzleKey */
        PuzzleKey: {
            /** Key */
            key: string;
            /** Provider Id */
            provider_id: string;
            /** Version */
            version: string;
        };
        /** PuzzleLibrary */
        PuzzleLibrary: {
            /** Available */
            available: number;
            /** Resume */
            resume: components["schemas"]["PuzzleResume"][];
            /** Sources */
            sources: components["schemas"]["PuzzleProviderInfo"][];
            stats: components["schemas"]["PuzzleStats"];
        };
        /** PuzzleMove */
        PuzzleMove: {
            /**
             * Elapsed Ms
             * @default 0
             */
            elapsed_ms: number;
            /** Request Id */
            request_id: string;
            /** Revision */
            revision: number;
            /** Uci */
            uci: string;
        };
        /** PuzzleProvenance */
        PuzzleProvenance: {
            /** Attribution */
            attribution: string;
            /** Game Id */
            game_id?: string | null;
            /** Source Ply */
            source_ply?: number | null;
            /** Url */
            url?: string | null;
        };
        /** PuzzleProviderInfo */
        PuzzleProviderInfo: {
            /** Count */
            count: number;
            /** Id */
            id: string;
            /** Name */
            name: string;
            /**
             * Source
             * @enum {string}
             */
            source: "generic" | "games";
        };
        /** PuzzleResume */
        PuzzleResume: {
            /** Failed */
            failed: boolean;
            /** Id */
            id: string;
            /**
             * Source
             * @enum {string}
             */
            source: "generic" | "games";
            /** Started At */
            started_at: string;
            /** Updated At */
            updated_at: string;
        };
        /** PuzzleSessionView */
        PuzzleSessionView: {
            completion: components["schemas"]["PuzzleCompletion"] | null;
            /** Current Step */
            current_step: number;
            /** Failed */
            failed: boolean;
            feedback: components["schemas"]["PuzzleFeedback"] | null;
            /** Fen */
            fen: string;
            /** History */
            history: components["schemas"]["PuzzleFrame"][];
            /** Id */
            id: string;
            /** Legal Moves */
            legal_moves: components["schemas"]["LegalMove"][];
            /**
             * Orientation
             * @enum {string}
             */
            orientation: "white" | "black";
            /** Playback */
            playback: components["schemas"]["PuzzleFrame"][];
            /** Revision */
            revision: number;
            /**
             * Source
             * @enum {string}
             */
            source: "generic" | "games";
            /**
             * Status
             * @enum {string}
             */
            status: "active" | "solved" | "revealed";
        };
        /** PuzzleStart */
        PuzzleStart: {
            /** Key */
            key: string;
            /** Provider Id */
            provider_id: string;
            /** Request Id */
            request_id: string;
            /** Version */
            version: string;
        };
        /** PuzzleStats */
        PuzzleStats: {
            /** Clean */
            clean: number;
            /** Failed Then Solved */
            failed_then_solved: number;
            /** Revealed */
            revealed: number;
            /** Solved */
            solved: number;
        };
        /** RefinementInfo */
        RefinementInfo: {
            /** Adopted */
            adopted: boolean;
            /** Baseline Depth */
            baseline_depth: number;
            /** Queries */
            queries: number;
            /** Reason */
            reason: string | null;
            /** Refined Depth */
            refined_depth: number | null;
            /** Status */
            status: string;
            /** Task Id */
            task_id: string;
            /** Triggers */
            triggers: string[];
            /** Version */
            version: string;
        };
        /** Rejected */
        Rejected: {
            /** Rejected */
            rejected: boolean;
        };
        /** ReviewCount */
        ReviewCount: {
            /** Due */
            due: number;
        };
        /** ReviewEvent */
        ReviewEvent: {
            /**
             * Actor
             * @enum {string}
             */
            actor: "white" | "black";
            /**
             * Confidence
             * @enum {string}
             */
            confidence: "board_fact" | "searched" | "line_witness" | "model_signal" | "annotation";
            /** Evidence */
            evidence: components["schemas"]["EvidenceReference"][];
            /** Facts */
            facts: {
                [key: string]: components["schemas"]["JsonValue"];
            };
            /** Id */
            id: string;
            /** Importance */
            importance: number;
            /**
             * Kind
             * @enum {string}
             */
            kind: "mate" | "evaluation_change" | "critical_resource" | "sacrifice" | "tactic" | "human_contrast" | "clock_observation" | "opening_departure" | "check" | "finish" | "positional";
        };
        /** ReviewFeedback */
        ReviewFeedback: {
            /** Answers */
            answers?: components["schemas"]["AcceptedAnswer"][] | null;
            attempt_frame?: components["schemas"]["Frame"] | null;
            /** Attempt Id */
            attempt_id?: string | null;
            /** Candidates */
            candidates?: components["schemas"]["Candidate"][] | null;
            /** Completed */
            completed: boolean;
            /** Continuations */
            continuations?: components["schemas"]["OpeningContinuation"][] | null;
            counter_reply?: components["schemas"]["Frame"] | null;
            /** Decision Id */
            decision_id?: string | null;
            /** Explanation */
            explanation?: string | null;
            /** Explanation Summary */
            explanation_summary?: string | null;
            /** Facts */
            facts?: {
                [key: string]: components["schemas"]["JsonValue"];
            } | null;
            /** Fen */
            fen?: string | null;
            /** Grade */
            grade: string;
            /** Message */
            message?: string | null;
            /** Next Due */
            next_due?: string | null;
            /** Non Scheduling Reason */
            non_scheduling_reason?: string | null;
            opening?: components["schemas"]["OpeningRecallContext"] | null;
            /** Played San */
            played_san?: string | null;
            /** Practice Only */
            practice_only?: boolean | null;
            /** Retired */
            retired?: boolean | null;
            /** Retired Interval Days */
            retired_interval_days?: number | null;
            reveal_frame?: components["schemas"]["Frame"] | null;
            /** Scheduling Status */
            scheduling_status?: ("recorded" | "previously_recorded" | "content_changed" | "practice") | null;
            /** Source */
            source?: string | null;
            /** Submitted San */
            submitted_san?: string | null;
        };
        /** ReviewJob */
        ReviewJob: {
            /** Cancel Requested */
            cancel_requested: boolean;
            /** Completed */
            completed: number;
            /** Error */
            error: string | null;
            /** Id */
            id: string;
            /**
             * Phase
             * @default baseline
             * @enum {string}
             */
            phase: "baseline" | "refinement" | "complete";
            /**
             * Refinement Completed
             * @default 0
             */
            refinement_completed: number;
            /**
             * Refinement Total
             * @default 0
             */
            refinement_total: number;
            /** Status */
            status: string;
            /** Total */
            total: number;
        };
        /** ReviewLine */
        ReviewLine: {
            /** Findings */
            findings: components["schemas"]["Finding"][];
            /** Frames */
            frames: components["schemas"]["Frame"][];
            /** Material Delta */
            material_delta: number | null;
            /** Settled */
            settled: boolean;
        };
        /** ReviewProgress */
        ReviewProgress: {
            accuracy: components["schemas"]["GameAccuracy"] | null;
            context?: components["schemas"]["GameContext"] | null;
            history?: components["schemas"]["CrossGameContext"] | null;
            job: components["schemas"]["ReviewJob"] | null;
            /** Moves */
            moves: components["schemas"]["ReviewedMove"][];
            /**
             * Revision
             * @default 0
             */
            revision: number;
        };
        /** ReviewQueueItem */
        ReviewQueueItem: {
            /** Due */
            due: string;
            /** Exercise Id */
            exercise_id: string;
            /** New */
            new: boolean;
        };
        /** ReviewRequest */
        ReviewRequest: {
            /** Rating */
            rating?: number | null;
            /**
             * Refine
             * @default false
             */
            refine: boolean;
        };
        /** ReviewedMove */
        ReviewedMove: {
            /** Ply */
            ply: number;
            report: components["schemas"]["GameMoveReport"];
        };
        /** SacrificeEvidence */
        SacrificeEvidence: {
            /** Analysis Id */
            analysis_id: string;
            /** Capture */
            capture: string;
            score: components["schemas"]["Score"];
        };
        /** Score */
        Score: {
            /**
             * Kind
             * @enum {string}
             */
            kind: "cp" | "mate";
            /**
             * Mate Given
             * @default false
             */
            mate_given: boolean;
            /** Value */
            value: number;
        };
        /** SkillPriority */
        SkillPriority: {
            /** Cue */
            cue: string;
            /** Decision Ids */
            decision_ids: string[];
            /** Evidence Ids */
            evidence_ids: string[];
            /** Failures */
            failures: number;
            /** Focused Attempts */
            focused_attempts: number;
            /** Focused Failures */
            focused_failures: number;
            /** Independent Games */
            independent_games: number;
            /**
             * Kind
             * @enum {string}
             */
            kind: "outcome" | "mechanism";
            /** Lesson Attempts */
            lesson_attempts: number;
            /** Lesson Failures */
            lesson_failures: number;
            /** Occurrences */
            occurrences: number;
            /** Practice Positions */
            practice_positions: number;
            /** Priority */
            priority: number;
            /** Provisional */
            provisional: boolean;
            /**
             * Retention
             * @enum {string}
             */
            retention: "improving" | "needs_practice";
            /** Reviews */
            reviews: number;
            /** Skill Id */
            skill_id: string;
            /** Title */
            title: string;
            /** Unique Positions */
            unique_positions: number;
        };
        /** Stats */
        Stats: {
            /** Exercises */
            exercises: number;
            /** Reviews */
            reviews: number;
        };
        /** SyncStatus */
        SyncStatus: {
            /** Checked At */
            checked_at: string | null;
            /** Error */
            error: string | null;
            /** Imported */
            imported: number;
            /** Job Id */
            job_id: string | null;
            /**
             * Provider
             * @default chesscom
             */
            provider: string;
            /** Status */
            status: string;
            /** Username */
            username: string;
        };
        /** TeachingAudit */
        TeachingAudit: {
            /** Attempts */
            attempts: number;
            /** Cache Key */
            cache_key: string;
            /** Confidence */
            confidence: number | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Error */
            error: string | null;
            /** Evidence Ids */
            evidence_ids: string[];
            /** Id */
            id: string;
            /** Input Tokens */
            input_tokens: number;
            /** Model */
            model: string;
            /** Output Tokens */
            output_tokens: number;
            /** Prompt Version */
            prompt_version: string;
            /** Response */
            response: {
                [key: string]: components["schemas"]["JsonValue"];
            } | null;
            /** Schema Version */
            schema_version: string;
            /** Status */
            status: string;
            /** Unit Id */
            unit_id: string;
            /** User Id */
            user_id: string;
        };
        /** TurningPoint */
        TurningPoint: {
            /**
             * Actor
             * @enum {string}
             */
            actor: "white" | "black";
            /** Event Ids */
            event_ids: string[];
            /** Loss Cp */
            loss_cp: number | null;
            /** Mate Transition */
            mate_transition: boolean;
            /** Ply */
            ply: number;
        };
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
        /** VariationRequest */
        VariationRequest: {
            /** Moves */
            moves?: string[];
            /**
             * Ply
             * @default 0
             */
            ply: number;
        };
        /** Weaknesses */
        Weaknesses: {
            /** Classification Available */
            classification_available: boolean;
            coverage: components["schemas"]["Coverage"];
            /** Skills */
            skills: components["schemas"]["SkillPriority"][];
            /** Unclassified */
            unclassified: number;
        };
        /** WorkerActivity */
        WorkerActivity: {
            /** Active */
            active: number;
            /** Pending */
            pending: number;
        };
        /** WorkspaceSettings */
        WorkspaceSettings: {
            /**
             * Acceptance Mode
             * @enum {string}
             */
            acceptance_mode: "best_only" | "engine_tolerance" | "practical" | "custom";
            /** Accounts Enabled */
            accounts_enabled: boolean;
            /** Chesscom Max Response Bytes */
            chesscom_max_response_bytes: number;
            /** Chesscom Timeout Seconds */
            chesscom_timeout_seconds: number;
            /** Chesscom User Agent */
            chesscom_user_agent: string;
            /** Classification Abstained */
            classification_abstained: number;
            /** Classification Available */
            classification_available: boolean;
            /** Classification Extension Plies */
            classification_extension_plies: number;
            /** Classification Failed */
            classification_failed: number;
            /** Classification Max Plies */
            classification_max_plies: number;
            /** Classification Min Loss Cp */
            classification_min_loss_cp: number;
            /** Classification Min Material */
            classification_min_material: number;
            /** Classification Probe Depth */
            classification_probe_depth: number;
            /** Classification Probe Positions */
            classification_probe_positions: number;
            /** Classification Probe Queries */
            classification_probe_queries: number;
            /** Classification Probe Time */
            classification_probe_time: number;
            /** Classification Provider */
            classification_provider: string;
            /** Classification Rejected */
            classification_rejected: number;
            /** Classification Runs */
            classification_runs: number;
            /** Classification Tactic Plies */
            classification_tactic_plies: number;
            /** Classification Version */
            classification_version: string;
            /** Classification Workers */
            classification_workers: number;
            coverage: components["schemas"]["Coverage"];
            /** Database Path */
            database_path: string;
            /** Deep Depth */
            deep_depth: number;
            /** Deep Nodes */
            deep_nodes: number | null;
            /** Deep Time */
            deep_time: number;
            /** Desired Retention */
            desired_retention: number;
            /** Engine Available */
            engine_available: boolean | null;
            /** Engine Error */
            engine_error: string | null;
            /** Engine Slots */
            engine_slots: number;
            /**
             * Engine Status
             * @enum {string}
             */
            engine_status: "unchecked" | "ready" | "unavailable";
            /** Engine Version */
            engine_version: string | null;
            /**
             * Human Model Device
             * @enum {string}
             */
            human_model_device: "cpu" | "cuda";
            /** Human Model Enabled */
            human_model_enabled: boolean;
            /** Human Model Path */
            human_model_path: string;
            /** Human Model Threads */
            human_model_threads: number;
            /** Human Model Timeout */
            human_model_timeout: number;
            /** Human Model Workers */
            human_model_workers: number;
            /** Lan Token Configured */
            lan_token_configured: boolean;
            /** Max Import Bytes */
            max_import_bytes: number;
            /** Min Independent Games */
            min_independent_games: number;
            /** Mistake Threshold Cp */
            mistake_threshold_cp: number;
            /** Multipv */
            multipv: number;
            /** Practical Tolerance Cp */
            practical_tolerance_cp: number;
            /** Provider Max Response Bytes */
            provider_max_response_bytes: number;
            /** Provider Max Scan Games */
            provider_max_scan_games: number;
            /** Provider Timeout Seconds */
            provider_timeout_seconds: number;
            /** Public Origin */
            public_origin: string;
            /** Retire After Days */
            retire_after_days: number;
            /** Review Refinement Depth */
            review_refinement_depth: number;
            /** Review Refinement Multipv */
            review_refinement_multipv: number;
            /** Review Refinement Positions */
            review_refinement_positions: number;
            /** Review Refinement Queries */
            review_refinement_queries: number;
            /** Review Refinement Time */
            review_refinement_time: number;
            /** Server Host */
            server_host: string;
            /** Server Port */
            server_port: number;
            /** Session Secure */
            session_secure: boolean;
            /** Slow Answer Seconds */
            slow_answer_seconds: number;
            /** Stockfish Hash Mb */
            stockfish_hash_mb: number;
            /** Stockfish Path */
            stockfish_path: string;
            /** Stockfish Threads */
            stockfish_threads: number;
            /** Stockfish Workers */
            stockfish_workers: number;
            /** Target Rating */
            target_rating: number;
            /** Tolerance Cp */
            tolerance_cp: number;
            /** Triage Depth */
            triage_depth: number;
            /** Triage Nodes */
            triage_nodes: number | null;
            /** Triage Time */
            triage_time: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    login_api_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Credentials"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Identity"];
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
    logout_api_auth_logout_post: {
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
                    "application/json": components["schemas"]["Ok"];
                };
            };
        };
    };
    logout_all_api_auth_logout_all_post: {
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
                    "application/json": components["schemas"]["Ok"];
                };
            };
        };
    };
    get_identity: {
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
                    "application/json": components["schemas"]["Identity"];
                };
            };
        };
    };
    complete_onboarding_api_auth_onboarding_complete_post: {
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
                    "application/json": components["schemas"]["AccountProfile"];
                };
            };
        };
    };
    profile_api_auth_profile_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Profile"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountProfile"];
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
    signup_api_auth_signup_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Credentials"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Identity"];
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
    classification_run_api_classification_runs__run_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
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
                    "application/json": components["schemas"]["ClassificationAudit"];
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
    reject_classification_api_classification_runs__run_id__reject_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
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
                    "application/json": components["schemas"]["Rejected"];
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
    enrich_classifications_api_classifications_enrich_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobCreated"];
                };
            };
        };
    };
    retry_classifications_api_classifications_retry_post: {
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
                    "application/json": components["schemas"]["JobCreated"];
                };
            };
        };
    };
    generate_lesson_teaching_api_course_teaching_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    evidence_api_evidence__decision_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                decision_id: string;
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
                    "application/json": components["schemas"]["Evidence"];
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
    add_manual_api_exercises_manual_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedId"];
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
    providers_api_game_providers_get: {
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
                    "application/json": components["schemas"]["GameProvider"][];
                };
            };
        };
    };
    games_api_games_get: {
        parameters: {
            query?: {
                offset?: number;
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
                    "application/json": components["schemas"]["GameHistory"];
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
    game_detail_api_games__game_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                game_id: string;
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
                    "application/json": components["schemas"]["GameDetail"];
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
    analyze_variation_api_games__game_id__analyze_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                game_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VariationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GameAnalysis"];
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
    variation_position_api_games__game_id__position_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                game_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VariationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GamePosition"];
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
    review_progress_api_games__game_id__review_get: {
        parameters: {
            query?: {
                after?: number;
                after_revision?: number | null;
            };
            header?: never;
            path: {
                game_id: string;
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
                    "application/json": components["schemas"]["ReviewProgress"];
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
    begin_review_api_games__game_id__review_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                game_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReviewRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobStarted"];
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
    train_game_api_games__game_id__train_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                game_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobStarted"];
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
    get_health_api_health_get: {
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
                    "application/json": components["schemas"]["Health"];
                };
            };
        };
    };
    human_model_readiness_api_human_model_get: {
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
                    "application/json": components["schemas"]["HumanReadiness"];
                };
            };
        };
    };
    upload_pgn_api_imports_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_pgn_api_imports_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PgnImportResult"];
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
    import_chesscom_api_imports_chesscom_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChessComRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobStarted"];
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
    import_provider_api_imports_provider__provider__post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProviderImportRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobStarted"];
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
    jobs_api_jobs_get: {
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
                    "application/json": components["schemas"]["Job"][];
                };
            };
        };
    };
    cancel_job_api_jobs__job_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
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
                    "application/json": components["schemas"]["JobStatus"];
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
    retry_job_api_jobs__job_id__retry_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
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
                    "application/json": components["schemas"]["JobStatus"];
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
    studies_api_opening_studies_get: {
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
                    "application/json": components["schemas"]["OpeningStudyLibrary"];
                };
            };
        };
    };
    enroll_api_opening_studies_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OpeningEnrollment"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OpeningStudyView"];
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
    get_study_api_opening_studies__study_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                study_id: string;
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
                    "application/json": components["schemas"]["OpeningStudyView"];
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
    disable_api_opening_studies__study_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                study_id: string;
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
                    "application/json": components["schemas"]["OpeningStudyView"];
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
    practice_api_opening_studies__study_id__practice_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                study_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OpeningPracticeStart"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LessonSessionView"];
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
    restore_api_opening_studies__study_id__restore_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                study_id: string;
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
                    "application/json": components["schemas"]["OpeningStudyView"];
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
    catalog_api_openings_catalog_get: {
        parameters: {
            query?: {
                q?: string;
                eco?: string;
                offset?: number;
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
                    "application/json": components["schemas"]["OpeningCatalogue"];
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
    detail_api_openings_catalog__key__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
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
                    "application/json": components["schemas"]["OpeningLineView"];
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
    course_line_api_openings_course_lines__course_id___line_id__get: {
        parameters: {
            query: {
                revision: string;
            };
            header?: never;
            path: {
                course_id: string;
                line_id: string;
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
                    "application/json": components["schemas"]["OpeningLineView"];
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
    focused_queue_api_practice_queue_get: {
        parameters: {
            query: {
                skill_id: string;
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
                    "application/json": components["schemas"]["PracticeQueueItem"][];
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
    get_audio_preferences_api_preferences_audio_get: {
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
                    "application/json": components["schemas"]["AudioPreferences"];
                };
            };
        };
    };
    put_audio_preferences_api_preferences_audio_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AudioPreferences"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AudioPreferences"];
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
    get_coach_preferences_api_preferences_coach_get: {
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
                    "application/json": components["schemas"]["CoachPreferences"];
                };
            };
        };
    };
    put_coach_preferences_api_preferences_coach_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CoachPreferences"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CoachPreferences"];
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
    get_motion_preferences_api_preferences_motion_get: {
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
                    "application/json": components["schemas"]["MotionPreferences"];
                };
            };
        };
    };
    put_motion_preferences_api_preferences_motion_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MotionPreferences"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MotionPreferences"];
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
    save_connection_api_providers__provider__connection_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProviderConnectionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyncStatus"];
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
    provider_status_api_providers__provider__sync_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
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
                    "application/json": components["schemas"]["SyncStatus"];
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
    provider_sync_api_providers__provider__sync_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyncStatus"];
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
    start_api_puzzle_sessions_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PuzzleStart"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PuzzleSessionView"];
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
    get_session_api_puzzle_sessions__session_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
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
                    "application/json": components["schemas"]["PuzzleSessionView"];
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
    move_api_puzzle_sessions__session_id__move_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PuzzleMove"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PuzzleSessionView"];
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
    reveal_api_puzzle_sessions__session_id__reveal_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PuzzleCommand"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PuzzleSessionView"];
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
    library_api_puzzles_get: {
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
                    "application/json": components["schemas"]["PuzzleLibrary"];
                };
            };
        };
    };
    next_puzzle_api_puzzles_next_get: {
        parameters: {
            query?: {
                source?: ("generic" | "games") | null;
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
                    "application/json": components["schemas"]["PuzzleKey"] | null;
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
    review_count_api_review_count_get: {
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
                    "application/json": components["schemas"]["ReviewCount"];
                };
            };
        };
    };
    review_queue_api_review_queue_get: {
        parameters: {
            query?: {
                last_id?: string | null;
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
                    "application/json": components["schemas"]["ReviewQueueItem"][];
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
    resume_api_review_sessions__session_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
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
                    "application/json": components["schemas"]["ColdPosition"];
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
    review_explanation_api_review_sessions__session_id__explanation_get: {
        parameters: {
            query?: {
                attempt_id?: string | null;
                solution?: boolean;
            };
            header?: never;
            path: {
                session_id: string;
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
                    "application/json": components["schemas"]["MoveExplanation"];
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
    move_api_review_sessions__session_id__move_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MoveRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewFeedback"];
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
    show_move_api_review_sessions__session_id__reveal_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
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
                    "application/json": components["schemas"]["ReviewFeedback"];
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
    begin_review_api_review__exercise_id__start_post: {
        parameters: {
            query?: {
                focus_skill_id?: string | null;
            };
            header?: never;
            path: {
                exercise_id: string;
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
                    "application/json": components["schemas"]["ColdPosition"];
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
    get_settings_api_settings_get: {
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
                    "application/json": components["schemas"]["WorkspaceSettings"];
                };
            };
        };
    };
    stats_api_stats_get: {
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
                    "application/json": components["schemas"]["Stats"];
                };
            };
        };
    };
    library_api_study_courses_get: {
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
                    "application/json": components["schemas"]["LessonLibrary"];
                };
            };
        };
    };
    course_api_study_courses__course_id__get: {
        parameters: {
            query?: {
                revision?: string | null;
            };
            header?: never;
            path: {
                course_id: string;
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
                    "application/json": components["schemas"]["LessonCourseView"];
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
    start_api_study_lesson_sessions_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LessonStart"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LessonSessionView"];
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
    get_session_api_study_lesson_sessions__session_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
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
                    "application/json": components["schemas"]["LessonSessionView"];
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
    command_api_study_lesson_sessions__session_id__command_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LessonCommand"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LessonSessionView"];
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
    get_sync_api_sync_get: {
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
                    "application/json": components["schemas"]["SyncStatus"];
                };
            };
        };
    };
    begin_sync_api_sync_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyncStatus"];
                };
            };
        };
    };
    teaching_audit_api_teaching_runs__run_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
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
                    "application/json": components["schemas"]["TeachingAudit"];
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
    reject_teaching_api_teaching_runs__run_id__reject_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                run_id: string;
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
                    "application/json": components["schemas"]["Rejected"];
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
    weaknesses_api_weaknesses_get: {
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
                    "application/json": components["schemas"]["Weaknesses"];
                };
            };
        };
    };
}
