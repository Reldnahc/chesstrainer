# Decisions

Read older entries as historical decisions. Current product scope is in PRODUCT.md and FEATURE_STATUS.md; later removals supersede earlier descriptions of lessons, Repertoire and model connectivity.

## 2026-09-12: Adaptive evidence and offline assistant assessment

Improve local classification by following unfinished tactical continuations forward and testing specific defensive alternatives. A longer root search alone leaves the fixed-endpoint bottleneck intact. New searches must preserve history, use the compatible persistent engine cache, remain bounded/cancellable, and link separately from exercise grading evidence.

Distinguish an observed event in a selected continuation from a verified defensive test. Neither implies a psychological diagnosis or that every engine reply is forced. Attribution to the learner's move needs an explicit before/after witness; distant unrelated exchanges are insufficient.

The user authorized comparing classifications against the coding assistant. Export evidence without predicted labels, save annotations before revealing predictions, retain uncertainty and reviewer provenance, and report agreement on the reviewed subset. This is not independent human gold data because the reviewer also develops the rules. Keep all private packets local/ignored and do not add LLM connectivity to the application.

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

## 008 - Initial course scope (superseded by 018)
Courses use deterministic priority/order and controlled titles. LLM supplies validated example classifications/explanations. Stage completion is user-marked and exercises enroll immediately in FSRS. These boundaries preserve a usable offline practice loop while richer lesson sequencing remains explicit future work.

## 009 ? Reproducible dependencies and source deployment (accepted)
Tested FSRS 6.3.2 is pinned; Python dependencies are locked in requirements.lock and frontend packages in package-lock.json. Production runs from a source checkout so Alembic and built assets remain available. Native Stockfish is separately installed, never bundled in source.

## 010 ? Compatible unknown-answer grading (accepted)
A precomputed set cannot cover all legal moves. Unknown moves are searched with the exercise's saved limits/resources and same binary identity. Changed engine versions cause an actionable unavailable response, never a fabricated wrong answer. Existing accepted moves remain usable.

## 011 ? Versioned classification evidence (initial limitation)
Existing evidence links retain the original audit so archived course support stays traceable. A changed model can add new skill links; automatic reconciliation/removal of prior labels is not yet implemented. Default same-version retries are idempotent.

## 012 ? Backup and configuration
The database never stores credentials. Online SQLite snapshots include WAL state; restore validates integrity and requires a new destination. Safe .env settings are included as reference JSON, with API key/LAN token values excluded. Settings UI is read-only for the initial release.

## 017 - Training interface redesign

Replace the original beige/green serif UI with a graphite, slate and orange visual system, IBM Plex Sans/Mono, compact navigation and a prominent board beside focused review controls. Fonts and the SVG app mark/favicon are local build assets to preserve offline use. CSS tokens also control the rendered chessboard so the theme stays consistent. Mobile keeps all six navigation destinations visible, uses stacked content and 16px form text to avoid input zoom. This is a presentation change; chess authority, grading and scheduling do not change.

## 018 - Stable lesson sequences and distinct practice authority

Keep an active course and stable unit identity across rebuilds. Store actual ordered lesson items and progress relationally; archive revision evidence/priority snapshots for explanation of updates. Course attempts share chess grading but never add FSRS recall events. Only new, unreviewed, unopened selected cards are withheld for course graduation; existing review history and unclassified offline practice remain available. A check uses first-attempt behavior, not a user-marked mastery checkbox.

## Automatic retirement after long recall intervals

User-requested policy: permanently retire a position from SRS once the calculated interval exceeds 100 days (configurable). Keep FSRS as the interval authority and persist retirement separately from eligibility, preserving all history. Use the scheduled interval, not age or time remaining. Previously saved lessons remain accessible for deliberate study but cannot reactivate a retired card. This supersedes the earlier default of indefinite occasional reviews.

## Exact-attempt explanation authority

Review explanations follow the submitted UCI and its saved engine candidate, including accepted alternatives. Reuse verified playback mechanics independently of lessons. Deterministic event captions and material/mate summaries provide both positive and negative explanations without paid OpenAI calls. Avoid inferring positional causes from a score or claiming that a single PV forces every reply. Use an explicit latest-attempt relationship rather than guessing from timestamps after reload. Keep explanation requests read-only and separate from SRS grading.

## Replace LLM runtime with local classification

The user explicitly superseded the original OpenAI requirement. Remove provider calls, SDK and settings; preserve historical classifications and teaching audits. New classifications use versioned local rules over saved Stockfish evidence. Unknown causes remain unclassified; do not infer thought processes from blunders. Store direction and concrete witness moves/squares. Native SQLite table/column renames preserve audit IDs and foreign keys without recreating learning-history tables. Historical model fields remain for export compatibility, with explicit legacy provenance. Classification backfills must not enroll new lesson cards or change SRS; course development stays paused.


### Remove lessons from the active product (September 12, 2026)

The user has rejected the current lesson experience. Course and lesson flows are removed, rather than kept as a paused tab. Historical database records remain for backups and a possible future redesign; old lesson APIs return HTTP 410 and cannot create or advance lessons. Nonretired cards withheld only for lessons become eligible for ordinary Review without resetting FSRS. Review, game imports, local mistake classification and repertoire remain the product. Mobile screens share Review's compact shell; less frequent controls and technical details use explicit disclosure instead of long default pages.


### Remove repertoire from the product

The user wants the application centered on reviewing mistakes from real games. Remove the Repertoire screen and manual-entry form. Repertoire APIs return 410 and existing repertoire cards no longer enter Review, including unfinished sessions. Archive through source filtering rather than deleting records, resetting FSRS or marking cards retired: removal is a product decision, not a successful recall. The manual exercise API remains for existing integrations and deterministic review fixtures; it has no navigation or form. No migration is necessary.


### Inline review explanations

Show why reuses the existing review board and page shell. Full-screen dialogs resized/repositioned the board and obscured navigation, which the user found distracting. Playback controls replace the practice controls in place; only verified board frames change. Loading/errors preserve the board, and Back/Escape restore focus without scrolling. Evidence audit dialogs remain separate.


### Persistent wrong-move cue

A backend-graded failure receives a steady red board outline/tint plus Mistake text. Avoid a timed flash or shake, which could be missed or create the distracting movement the user previously reported. The overlay does not intercept taps and preserves piece readability, counter playback and all board dimensions. It is presentation state only; no new grading or scheduling event is introduced.


### Layered local diagnosis and focused practice

Outcomes describe observed mate/material consequences. Motifs require additional chess geometry and a witnessed consequence in the selected engine line. Practice cues are deterministic advice, not assertions about the learner's thoughts. Coverage reports must distinguish outcomes, specific motifs and score-only context; no aggregate labeled percentage may imply measured accuracy.

Additional Stockfish evidence for classification is bounded and separately linked, preserving original decisions and accepted answers. Focused practice has explicit session provenance and does not change FSRS; raw attempts remain usable for separate progress reporting. Saved and supplemental engine PVs remain finite continuations, never assertions that all replies are forced.


## 2026-09-12: Classification usefulness v2

Separate observable outcomes from specific mechanisms and static practice cues. Lower material-size gating to one point while retaining meaningful relative engine loss; a lost pawn or exchange can matter, including from a winning position. Inspect 16 plies by default. Require the actual selected endpoint to be quiet; do not inflate coverage by picking an earlier favorable prefix. Keep unknown causes explicit. Add motif rules only with legal positive/negative witnesses.

Share line detectors between classification and explanations, but attach review findings only to the selected answer's exact saved analysis. Highlight witness squares after an answer. Do not copy source-game labels onto a different attempted move.

Make extra engine work an opt-in capped job, using durable tasks and separate supplemental references. Cached completed work survives cancellation/restart. A changed binary or probe configuration cannot reuse a planned key. New classification evidence never replaces exercise acceptance policy or grading analyses.

Use focused batches from Weaknesses instead of reviving lessons. Topic-selected practice is not blind recall, so persist its sessions/timing separately and never update FSRS from it. Canonical position deduplication and source-game rotation keep batches useful. Ordinary mixed Review is unchanged.

Measure coverage separately from accuracy. Export stratified human-label samples with game-separated development/holdout assignment; compute precision/recall only from explicitly exhaustive human annotations. Keep uncertain labels blank and do not claim independent accuracy from synthetic-score tests or engine legality alone.

## 2026-09-12: preserve blind comparisons and verify audit corrections

The first assistant assessment exposed both classifier and reviewer mistakes. Preserve original annotations and predictions; record independently checked reviewer corrections in a separate adjudication artifact. Evaluate code changes against exactly the frozen evidence, and describe the result as development diagnostics. Additional native searches change evidence fingerprints and require a fresh review. A small game-separated holdout and a reviewer who wrote the rules do not establish independent accuracy.

Version 3.1 tightens causal witnesses while extending supported patterns: an equal initial trade cannot become a hanging-piece diagnosis because of later losses; incidental pawn cleanup is not a defender-removal lesson; a defender that stays geometrically aligned but becomes pinned is not deflected. Trace pinned victims and released relative pins explicitly. Capturable forks with later collection and persistent relative-pin threats require bounded native defensive queries. Reduced synthetic regressions capture these cases without publishing private games.

## 2026-09-13: cohesive interface modules and current documentation

Keep create_app as the composition root for database sessions, shared mutation lock, scheduler, injected engine/classifier factories and worker lifecycle. Extract endpoint groups through ordinary APIRouter factories with explicit existing resources. Preserve app.state compatibility and request-model imports; avoid global routers holding one application's mutable dependencies. HTTP middleware and static delivery remain interface concerns. No domain or schema behavior changes.

Keep navigation, connection and shared errors in App. Move the existing Review, Import, Settings and evidence display into cohesive frontend modules, with shared PageTitle and exercise-link cleanup helpers. Preserve hook/state lifetimes, board identity, DOM structure and interaction timers; do not introduce a router library or new state framework.

Separate the current roadmap from the earlier deployment/validation journal. IMPLEMENTATION_HISTORY preserves that journal as historical context; VERIFICATION records current checks and TESTING provides repeatable commands. Current guides must distinguish active review/weakness workflows, retained low-level APIs and archived/tombstoned lesson/repertoire behavior. Historical statements are not current setup instructions.
