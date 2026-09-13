# Product

Fieldwork is private chess practice built from the player's own games. Import games, identify practical mistakes with native Stockfish, review useful positions and retain them with FSRS. Defaults serve a beginner progressing toward 1500 rapid. Multiple sound answers are accepted; small engine preferences usually do not create exercises.

Python-chess owns rules. Stockfish owns evaluations and verified alternatives. Python policy owns grading. Local, versioned detectors classify supported mistake mechanisms and consequences. Curated repertoire answers retain their authority. There is no LLM connectivity, model service or model API-key requirement.

Review is the primary product. It hides source, concept, previous moves, scores and answers before an attempt. A failed engine answer previews the opponent's counter; Try again restores the board and Show me why opens the deeper saved line. Success has a concise factual explanation and optional playback. Reveal move performs the saved answer. One failed recall is recorded per session. FSRS increases intervals, with permanent retirement above the configured 100-day threshold.

Local labels include allowed/missed mate, material consequences and a conservative subset of tactical motifs. Every finding links to engine evidence. Unclassified positions remain useful exercises. Repeated independent games support weakness priorities; a single error does not establish a recurring weakness or reveal the player's thought process.

Lessons and repertoire are removed from the active product. Their historical data is archived; the old APIs do not create or advance training. A future lesson redesign would need to build on reliable classification and review.

Primary screens are Review, Weaknesses, Import and Settings, in that order on desktop and mobile. Data lives locally in SQLite. No accounts, cloud database, telemetry, social features or public hosting. Explicit Chess.com imports retrieve completed public games; PGN import and training work offline once Stockfish is installed.

Classification improvements must make review explanations more useful while preserving auditable evidence. Measure specific causes separately from broad material/mate outcomes. Offline assistant review may help find bad labels, but it must be identified as assistant review and cannot establish independent accuracy or replace chess verification.

See [FEATURE_STATUS.md](FEATURE_STATUS.md) for implemented and missing features, and [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for detector scope and quality limits. The original OpenAI requirement was superseded by the user's September 12, 2026 decision to remove model connectivity.


Current product scope: lessons and Course navigation have been removed at the user's request. The active loop is import games, analyze and classify locally, then practice in Review with FSRS. Saved lesson history is archived; a future lesson design requires separate work.


Repertoire training and manual-position entry are also removed from the interface. The four active destinations are Review, Weaknesses, Import and Settings. Imports and local classification support review of meaningful mistakes from the learner's games. Historical repertoire positions are excluded from practice.


Classification supports three connected uses: factual explanations after an answer, independent recurring-weakness evidence, and optional focused position practice. The cold mixed review board stays unlabeled. Outcome coverage and motif coverage are shown separately; focused attempts are distinguished from scheduled recalls.


Classification v3.1 is available in the active review product. Weaknesses separates tactical mechanisms from material/mate outcomes, provides practice cues and all supporting examples, and starts focused batches of up to 12 distinct real positions. Focused practice is explicitly separate from scheduled recall: it preserves FSRS and retirement. Show why offers witness-frame square highlights when the exact answer's saved line supports a pattern. Settings provides an optional capped deeper-evidence job. No lessons, repertoire or LLM functionality is reintroduced.

Classification quality is measured separately from coverage. The first blinded assistant assessment and resulting rule corrections are documented in CLASSIFICATION_ASSESSMENT.md; independent human accuracy and demonstrated improvement over time remain outstanding.
