# Architecture

React/TypeScript/Vite is a thin same-origin client for FastAPI. Python 3.12+ owns rules, engine evaluation, grading, local classification, reviews and scheduling. SQLAlchemy 2 and Alembic manage SQLite with foreign keys, WAL and a busy timeout. Run one application process; no Redis, external worker service or cloud database is needed.

## Boundaries

Classification v3 work is staged in DEVELOPMENT_PLAN.md: adaptive continuation evidence, connected tactical witnesses, separately cached defensive probes, then a blinded offline assessment. Engine evidence and deterministic geometry remain the authorities. Assistant-assisted review is a development activity with recorded provenance; it is not an application dependency or an automatic source of labels.

- `chess_core.py`: python-chess rules, canonical legal-position identity, deterministic facts and explicit score types.
- `engine.py`: native UCI lifecycle, analysis limits and compatible persistent cache; no training policy.
- `policy.py`: configurable acceptance policy over verified scores.
- `imports.py`, `chesscom.py`: learner resolution, PGN provenance, deduplication and bounded serial public-game download.
- `jobs.py`, `pipeline.py`, `work_pool.py`: ordered persistent jobs, bounded engine/classification pools, cancellation and atomic progress.
- `local_classifier.py`: versioned tactical/consequence detectors, witness plies/squares and abstention.
- `classification.py`: validated labels, cache identity, immutable run responses and active evidence projection.
- `curriculum.py`, `lessons.py`: saved course aggregation/progression; development paused. New imports/classification do not rebuild courses automatically.
- `reviews.py`, `explanations.py`, `scheduling.py`, `retirement.py`: backend grading, local consequence playback, FSRS and persistent retirement.
- `models.py`, `db.py`, `api.py`: relational persistence, migrations, HTTP contracts and production static assets.

Within one job, STOCKFISH_WORKERS games run in parallel, each with its own native process and DB session. Moves within a game stay ordered. Meaningful decisions flow to CLASSIFICATION_WORKERS local tasks. Each pool admits at most twice its worker count. Producers stop on cancellation and started tasks finish saving; a game is complete after its classification tasks finish. Classification-only backfills use saved evidence and neither start background engines nor create/enroll exercises.

Short writes share a lock; rule computation runs outside it. Progress uses atomic SQL increments. Engine cache lock stripes coalesce identical concurrent searches. Interactive grading has its own engine. Startup recovers unfinished jobs; multiple Uvicorn processes are unsupported.

Training identity ignores clocks but preserves legal en passant and castling. Engine cache identity also preserves rule clocks and move history. Scores are normalized to the learner with mate separate from centipawns. Classification caches include rules, parameters, taxonomy and saved evidence. Classification weights are not calibrated probabilities.

OpenAI runtime integration has been removed. No model SDK or model network calls remain. Historical classification and teaching audits are retained locally; model teaching-generation endpoints return 410. New audits explicitly identify local_rules provenance. See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md).

Production serves the frontend on the API origin. LAN binding and an optional shared token are configuration; do not expose directly to the internet. Only explicit Chess.com imports need outbound network access.


Lesson removal: the web app exposes four destinations (Review, Import, Weaknesses, Settings). Lesson/course APIs are tombstones returning 410. Legacy domain modules and relational history remain for compatibility and archival tests, but no production route or job calls lesson generation/progression. A one-time migration releases nonretired lesson-held review cards while preserving their scheduler state.


Repertoire removal uses a source filter in both due and unfinished-session review queries. API guards reject repertoire starts/moves/reveals and repertoire list/import with HTTP 410. No database migration or SRS mutation is needed. Legacy parsing/domain helpers and the low-level manual exercise API remain for compatibility and deterministic fixtures, without a creation UI.


Review explanation playback runs inline in the existing practice panel and supplies verified frames to the original Board component. It does not open a modal, remount the board, hide navigation or change page geometry. Explanation API and scheduling behavior are unchanged.


Classification upgrade plan: keep deterministic evidence extraction, tactical detectors, classification persistence and review scheduling separate. Shared line detectors supply witness frames to both local classification and explanation playback. Supplemental analysis records reference immutable engine cache entries; they do not replace exercise authority. Focused practice is a separate ReviewSession mode, while normal mixed review retains FSRS ownership.


## Implemented classification v2 boundaries

`diagnosis_types.py` defines immutable outcomes, findings, square roles and cues. `local_classifier.py` gates decision findings using comparative engine scores and quiet material endpoints. Shared `tactical_patterns.py` recognizes concrete geometric witnesses; `explanations.py` uses it only on the selected answer's own line. `coverage.py` separates current outcomes from specific mechanisms, independently of cumulative run counts.

`enrichment.py` plans a persisted bounded batch and uses the existing native engine worker pool. Supplemental analysis references are separate from grading references. Completed searches use the normal durable cache; mismatched engine/settings after a restart require a new probe job. Classification-only backfills still launch no engines.

`practice.py` selects active evidence positions across games and deduplicates legal position keys. ReviewSession.mode and focus_skill_id distinguish these attempts from mixed recall. `record_once` cannot write a Review or SRSState for a focus session. First-response timing and completion timestamps are retained separately. ReviewExplanation receives backend witness roles; the browser only renders them.

`classification_quality.py` provides local CSV sampling and human-annotation metrics through the read-only report script. It never creates gold labels or calls a model. Schema migration e6294af71b35 uses additive native SQLite changes and preserves historical data.
