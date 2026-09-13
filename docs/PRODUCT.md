# Product

Fieldwork is private chess practice built from the player's own games. Import games, identify practical mistakes with native Stockfish, review useful positions and retain them with FSRS. Defaults serve a beginner progressing toward 1500 rapid. Multiple sound answers are accepted; small engine preferences usually do not create exercises.

## Active learning loop

Import PGNs or completed public Chess.com games, analyze the learner's decisions locally, save verified evidence, and turn meaningful mistakes into review positions. Versioned local rules classify supported consequences and tactical mechanisms. A position can remain unclassified and still be useful in Review.

The four screens are **Review, Weaknesses, Import and Settings**, in that order on desktop and mobile.

- **Review** starts with an unlabeled board. The backend supplies legal moves and grades answers. A failed engine answer previews the opponent's saved counter; Try again restores the board and Show me why opens deeper playback. Success offers factual feedback and optional Show why. Reveal move performs the saved answer. Repeated retries create only one failed recall per session.
- **Weaknesses** separates material/mate outcomes from tactical patterns, shows supporting decisions and practice cues, and starts focused batches of up to 12 distinct positions. Focused attempts are stored separately and never change FSRS.
- **Import** supports multi-game PGNs, explicit learner matching and filtered Chess.com username imports. Only new games enter new analysis jobs; cancellation/retry preserves completed work.
- **Settings** displays effective host configuration and classification coverage. It can classify saved evidence or queue a capped local Stockfish enrichment job. Configuration itself is edited in the host's environment or .env.

FSRS increases intervals after successful recall. An interval strictly above the configured threshold (100 days by default) permanently retires the position, preserving history. The cold review board hides source, concept, previous moves, scores and answers; feedback and playback become available after an attempt or reveal.

## Authorities and limits

Python-chess owns rules. Stockfish owns evaluations and verified alternatives. Python policy owns grading. Local detectors assign labels only when their evidence conditions pass. The retained low-level manual exercise API validates curated moves with python-chess; saved manual answers define those exercises' acceptance.

Classification supports factual feedback, recurring-weakness evidence and focused practice. Independent games support recurrence; one error does not establish a recurring weakness or reveal what the player was thinking. Classification v3.1 retains auditable witnesses, optional native defense checks and explicit abstentions. Coverage and accuracy are separate measurements. The first [assistant assessment](CLASSIFICATION_ASSESSMENT.md) is not an independent human benchmark or proof of improvement over time.

## Removed and archived

Lessons, course UI, Repertoire and manual-position entry forms are removed. Historical lesson/repertoire data and domain helpers remain for compatibility and backups. Lesson/course and repertoire product routes return HTTP 410; archived sessions cannot be practiced through review endpoints. Historical teaching audits and the low-level manual exercise API remain accessible. Imports and classification never generate courses or enroll cards into lessons.

There is no LLM runtime, SDK, model service or model API-key requirement. The original OpenAI requirement was superseded by the user's September 12, 2026 instruction. Historical model responses are retained locally for audit; their labels are inactive.

## Local operation

Data lives in SQLite on the host. PGN analysis and training work offline once dependencies and Stockfish are installed. Explicit Chess.com imports contact its public API. There are no accounts, cloud database, telemetry, social features or public-hosting workflow. LAN clients use the same backend and production origin.

See [FEATURE_STATUS.md](FEATURE_STATUS.md) for implemented features and limits, [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for detector scope, and [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for remaining work.
