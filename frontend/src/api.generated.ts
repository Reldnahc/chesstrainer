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
        /** ColdPosition */
        ColdPosition: {
            /** Exercise Id */
            exercise_id: string;
            /** Failed */
            failed: boolean;
            /** Fen */
            fen: string;
            /** Last Attempt Id */
            last_attempt_id: string | null;
            /** Legal Moves */
            legal_moves: components["schemas"]["LegalMove"][];
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
        /** GameDetail */
        GameDetail: {
            accuracy: components["schemas"]["GameAccuracy"] | null;
            /** Black */
            black: string;
            /** Black Rating */
            black_rating: number | null;
            /** Frames */
            frames: components["schemas"]["GameFrame"][];
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
            /**
             * Label
             * @enum {string}
             */
            label: "Brilliant" | "Great" | "Best" | "Good" | "Book" | "Inaccuracy" | "Mistake" | "Miss" | "Blunder";
            opening: components["schemas"]["BookOpening"] | null;
            /** Reason */
            reason: string;
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
            previous_score: components["schemas"]["Score"] | null;
            /** Reason */
            reason: string;
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
            engine_available: boolean;
            /** Engine Error */
            engine_error: string | null;
            /** Engine Version */
            engine_version: string | null;
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
        /** Rejected */
        Rejected: {
            /** Rejected */
            rejected: boolean;
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
            /** Played San */
            played_san?: string | null;
            /** Practice Only */
            practice_only?: boolean | null;
            /** Retired */
            retired?: boolean | null;
            /** Retired Interval Days */
            retired_interval_days?: number | null;
            reveal_frame?: components["schemas"]["Frame"] | null;
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
            job: components["schemas"]["ReviewJob"] | null;
            /** Moves */
            moves: components["schemas"]["ReviewedMove"][];
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
            engine_available: boolean;
            /** Engine Error */
            engine_error: string | null;
            /** Engine Slots */
            engine_slots: number;
            /** Engine Version */
            engine_version: string | null;
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
            /** Public Origin */
            public_origin: string;
            /** Retire After Days */
            retire_after_days: number;
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
