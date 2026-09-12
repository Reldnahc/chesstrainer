# Decisions

## 016 — Parallelize within one job with separate bounded pools (accepted)

The old worker count only helped independent jobs; a single import and every model request remained serial. Keep one persisted-job coordinator, then analyze games across independent native Stockfish processes and classify saved decisions in a separate thread pool. This preserves local simplicity and ordered work within each game while overlapping CPU and network stages. Bound active-plus-queued tasks to twice each pool's configured worker count. Serialize short application writes, use atomic progress increments, share no sessions across threads, and drain in-flight work before completing/cancelling a job. Keep Chess.com requests serial and an independent interactive engine available. Cache compatibility excludes concurrency settings. Per-model batches and distributed workers are unnecessary for this improvement.

## 015 — Incremental imports and persistent cancellation (accepted)

Repeated imports should schedule only newly inserted games, while keeping duplicate provenance queryable. Add `import_games.is_new`; preserve existing job scopes during migration. A new import must not silently resume older cancelled work; the user retries that job explicitly. Chess.com limits count new valid games, not duplicates; scanning may backfill older unsaved games within the selected range. Monthly provider responses can still contain old games. Completed classification responses remain versioned and cached immediately; cancellation is cooperative and waits for the current bounded operation. Duplicate-only imports do not rebuild courses.

## 014 — Legal-move markers use the rules authority (accepted)

Cold review responses include every python-chess legal move with source, destination, promotion and capture metadata. The frontend renders dots/rings locally from that list, without per-click requests or a JavaScript chess rules dependency. Legal destinations include rejected exercise answers, so markers cannot disclose grading policy. Capture metadata handles en passant correctly. Selection does not count as an SRS hint or recall event; only submitted legal attempts/reveal retain their existing scheduling behavior.

## 013 — Public Chess.com import (accepted)

Explicit From/To dates override the relative lookback so the default three-month window cannot silently exclude an older requested period. Filter by completion date, including both whole UTC days, and persist nullable relational dates alongside the other import parameters. Open-ended ranges remain bounded by the selected-game limit.
Explicit user request promotes username game import into current scope. Use the documented read-only PubAPI archive index and monthly JSON (including PGNs and time-class/rules metadata). The backend alone fetches fixed api.chess.com URLs, serially with bounded retries, and hands selected completed standard games to the existing PGN authority. Default rapid / 3 calendar months / latest 100 games is configurable per import. Store relational job parameters and per-archive checkpoints, retain original selected PGNs, and resume before local analysis. No credentials or OpenAI access are needed. Username and requested archive paths are sent to Chess.com; saved games stay local except optional existing OpenAI pedagogy.

Reference verified: https://www.chess.com/news/view/published-data-api (2026-09-11). The provider caches responses, so newly finished games may appear after a delay.

## 001 — Local monolith (accepted)
FastAPI plus React, SQLite/WAL and internal workers keep deployment private and simple. One server process owns workers. Production frontend shares origin. No external broker or account system.

## 002 — Separate authorities (accepted)
Python-chess validates every position/move; Stockfish supplies evaluations; policy grades; optional structured OpenAI classifies evidence. A model cannot create accepted moves. Curated repertoire/manual answers are explicit human authority.

## 003 — Distinct identities (accepted)
Training keys preserve placement, turn, castling and legal en passant, ignoring clocks. Cache keys preserve full rule context/history, engine identity/settings/limits/root moves/MultiPV. This sacrifices some cache hits to prevent incorrect reuse.

## 004 — Persist before classify (accepted)
Objective analysis commits before any network request. Failed/absent classification leaves retryable evidence. Audits store versions, model, evidence IDs, confidence, output and timestamps. No silent fake classifier in production.

## 005 — Practical answer policy (accepted)
Default practical tolerance is configurable; forced-mate transitions are separate from centipawn loss. Candidate sets are precomputed; unseen legal answers are verified before judgment. Each exercise snapshots policy so settings changes do not silently alter existing cards.

## 006 — FSRS adapter (accepted)
Use maintained `fsrs` (py-fsrs), pin the tested release, retain card state plus raw review behavior. First failure schedules Again once, subsequent retries do not add recall events. Revealing also schedules Again.

## 007 — Conservative diagnosis (accepted)
Independent source-game recurrence establishes a course weakness. One example can produce provisional practice, explicitly labeled; it cannot justify claims of recurring behavior. Course ordering is deterministic initially; LLM labeling/explanation is optional.

## References checked
* [python-chess engine API](https://python-chess.readthedocs.io/en/latest/engine.html)
* [py-fsrs](https://github.com/open-spaced-repetition/py-fsrs)
* [React chessboard](https://github.com/Clariity/react-chessboard)
* [OpenAI structured outputs](https://platform.openai.com/docs/guides/structured-outputs)

Exact dependency versions and compatibility results are recorded after installation/testing.

## 008 ? Initial course scope (accepted)
Courses use deterministic priority/order and controlled titles. LLM supplies validated example classifications/explanations. Stage completion is user-marked and exercises enroll immediately in FSRS. These boundaries preserve a usable offline practice loop while richer lesson sequencing remains explicit future work.

## 009 ? Reproducible dependencies and source deployment (accepted)
Tested FSRS 6.3.2 is pinned; Python dependencies are locked in requirements.lock and frontend packages in package-lock.json. Production runs from a source checkout so Alembic and built assets remain available. Native Stockfish is separately installed, never bundled in source.

## 010 ? Compatible unknown-answer grading (accepted)
A precomputed set cannot cover all legal moves. Unknown moves are searched with the exercise's saved limits/resources and same binary identity. Changed engine versions cause an actionable unavailable response, never a fabricated wrong answer. Existing accepted moves remain usable.

## 011 ? Versioned classification evidence (initial limitation)
Existing evidence links retain the original audit so archived course support stays traceable. A changed model can add new skill links; automatic reconciliation/removal of prior labels is not yet implemented. Default same-version retries are idempotent.

## 012 ? Backup and configuration
The database never stores credentials. Online SQLite snapshots include WAL state; restore validates integrity and requires a new destination. Safe .env settings are included as reference JSON, with API key/LAN token values excluded. Settings UI is read-only for the initial release.
