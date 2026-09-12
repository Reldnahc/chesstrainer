# Architecture

React/TypeScript/Vite is a thin same-origin client for FastAPI. Python 3.12+ modules separate rules, engine, policy, importing, pedagogy, curriculum, reviews and scheduling. SQLAlchemy 2 owns relational persistence; Alembic owns schema versions. SQLite uses foreign keys, WAL and a busy timeout. Run one application process; internal bounded worker threads claim persisted jobs. No Redis or external worker service.

## Boundaries

* `backend/trainer/chess_core.py`: python-chess rules, position identity, facts and explicit score types.
* `engine.py`: native UCI lifecycle, conservative limits, immutable persistent analysis cache; no training policy.
* `policy.py`: versioned configurable interpretation of verified scores.
* `imports.py`, `jobs.py`: learner resolution, provenance, deduplication and one ordered persistent-job coordinator.
* `pipeline.py`, `work_pool.py`: bounded game-analysis and independent classification pools, task draining, cancellation and atomic progress.
* `chesscom.py`: bounded serial public archive client, validated username queries and resumable download checkpoints; feeds the same PGN importer.
* `pedagogy.py`, `curriculum.py`: validated skill IDs, auditable classifications, aggregation and evidence-linked courses.
* `reviews.py`, `scheduling.py`: move validation, first-failure semantics, FSRS adapter.
* `models.py`, `db.py`: queryable relationships and transactions.
* `api.py`: HTTP contracts, sanitized settings, production static frontend.

Engine processes belong to workers and close on shutdown/failure. Jobs commit per decision so interruption preserves completed work. A single process owns startup recovery; multiple Uvicorn workers are unsupported. REST polling is sufficient for progress initially.

Within one job, STOCKFISH_WORKERS games can be analyzed in parallel, each worker owning an independent native process and DB session. Moves within a game remain ordered. Meaningful saved decisions flow to a separate LLM_WORKERS pool, so model latency no longer blocks the next engine decision until the bounded queue is full. Each pool admits at most twice its worker count in running-plus-queued tasks. Producers stop on cancellation; in-flight requests finish saving before final status. A game counts as processed only after its produced classification tasks finish. Classification-only jobs use saved decisions without PGN replay or starting background engines.

Short application write phases share a lock; model network calls happen outside that lock and without an open database transaction. Progress increments use SQL arithmetic. Shared engine-cache lock stripes prevent duplicate simultaneous searches for identical cache keys. The interactive review engine remains separate. Runtime activity is reported through /api/jobs; it is transient, while job counters/results remain persistent.

Training identity ignores clocks but preserves legal en passant and castling. Engine cache identity additionally preserves rule clocks and move history because draw/repetition context affects evaluation. Scores are always normalized to the decision maker, with mate kept separate from centipawns.

OpenAI receives engine candidates, verified continuations, deterministic facts, evidence IDs and the controlled taxonomy. It receives no game headers, credentials or database. Its output cannot modify engine answers. No key means explicitly unavailable classification, with evidence retained for retry.

Repertoire/manual exercises use validated curated answers. Engine exercises store a policy snapshot and verified candidates; unlisted legal alternatives require engine verification before grading. Engine unavailability must not turn an unknown move into a failure.

Chess.com username import adds a second explicit network boundary: the host retrieves completed public games using a username and monthly archive paths. No credentials, local database or moves are sent. Download jobs persist their query and checkpoint each archive before continuing to local analysis. Browser and backend still share one origin; only the backend contacts the provider. See CHESSCOM_IMPORT.md.
