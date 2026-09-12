# Feature status against the original specification

Last reviewed: 2026-09-11. This is the current feature inventory and gap list. Section numbers refer to the original 53-section product specification. Update this file when behavior or verification changes; keep milestone sequencing in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

**Current outcome:** the import → local analysis → meaningful exercise → review → FSRS loop works. Optional structured classification can supply skill evidence for basic courses. The full adaptive curriculum described in the original north star is not complete.

Status meanings: **Implemented** means a working capability exists, within the limits stated here. **Partial** means important requested behavior remains. **Unverified** distinguishes missing validation from missing code. **Deferred** means deliberately outside current scope. These labels are not completion percentages.

## What works today

| Capability | Status and scope | Original sections |
|---|---|---|
| Local Python application | Implemented: FastAPI, Pydantic, SQLAlchemy, SQLite/WAL, Alembic; React/TypeScript/Vite frontend served from the same origin. No mandatory accounts or external workers. | 8–11, 48 |
| Chess rules | Implemented: python-chess validates boards and moves, parses PGNs, supplies SAN/UCI and handles special moves. The browser collects interaction; it does not decide legality. | 3–4, 9, 34–35, 52 |
| Local engine | Implemented: native Stockfish through UCI, configurable resources/limits, MultiPV, actual-move comparison, explicit mate scores and perspective normalization. | 5, 13, 33–34 |
| Deterministic facts | Partial: material, geometric attacked/undefended pieces, check/capture/castling move and rights, move number, simple phase heuristic, legally replayed PV material changes and checkmate. Broader development state, castling history, endgame types and verified motif detectors remain. Geometric attacks are not asserted to prove hanging material. | 6, 18 |
| PGN import | Implemented: single/multiple games, original provenance, practical fingerprints, explicit learner matching or batch side assignment, invalid-game reporting. Cross-provider deduplication is not universal. | 12, 18, 49 |
| Analysis pipeline and cache | Implemented: bounded triage, deeper suspicious-position analysis, persistent evidence/candidates/PVs and compatible engine caching. Keys preserve rule state and additional draw/history context for engine work. | 13–14, 18, 34–35, 44–45 |
| Practical grading | Implemented baseline: best_only, engine_tolerance, practical and custom settings, stored alternatives, separate policy from engine facts. Unlisted legal moves require local verification. Practical/custom currently use configured score thresholds and mate transitions; there is no sophisticated model of human move difficulty. | 15–16, 44–45 |
| Rating target | Partial: configurable, default 1500; affects foundational-skill priority. The current rule is a coarse weight for targets up to 1600, not a comprehensive rating-specific curriculum. | 17, 46 |
| Background work | Implemented: SQLite job states, progress, cancellation, retry, startup recovery and saved-work reuse. REST polling is used instead of optional WebSockets. Hundreds-of-games throughput and prolonged resource use have not been profiled. One server process is required. | 29–31, 49 |
| Skill taxonomy and classifier | Implemented adapter: controlled IDs, strict structured output, confidence threshold, evidence linkage, audits and retry/cache behavior. Tests inject a mock; live OpenAI classification has not been validated. | 7, 19–20, 32 |
| Weakness evidence | Partial: aggregation by independent games, bounded severity/recency/confidence and linked review failures/timing. Single-game evidence is explicitly exploratory. No comprehensive assessment of strengths, calibrated mastery model or structure-specific pattern discovery. | 21–22, 53 |
| Personalized courses | Partial: evidence-linked units, rationale, deterministic priority/order and titles, per-example model explanation, persisted diagnose/teach/drill/retain stages. See the specific course gaps below. | 22–23, 53 |
| Exercise sources | Implemented: learner mistakes, curated repertoire and manually entered positions. Synthetic positions are excluded. No dedicated source-priority selection policy or additional verified-source integrations yet. | 24 |
| Review interaction | Implemented: cold board, drag/drop, click/tap moves, server-provided legal-move dots and capture rings, promotion, backend grading, retries without automatic reveal, Show move, one failed recall per session, reload persistence. | 25–26 |
| Spaced repetition | Implemented: FSRS adapter, behavior-derived Again/Hard/Good, raw timing, due/relearning before new, repeat avoidance when alternatives exist. Hints and optional manual rating selection are absent. Exercises enroll immediately, not after course graduation. | 23, 27 |
| Repertoire | Implemented: PGN variation traversal, selected-side exercises, transposition/continuation merging within an import, curated answer authority. The UI imports/lists repertoires; a full line editor, delete/update management and merging across separate imports are absent. | 28, 38 |
| Manual positions | Implemented: validated FEN, expected UCI moves, orientation and optional explanation. Tags are supported in the API/data model but not exposed by the manual-position form. Curated legality is checked; supplied answers are not asserted to be engine-optimal. | 29 |
| Settings | Partial: centralized validated configuration, .env.example and safe read-only status UI. Changes require editing .env and restarting; there is no settings editor. | 33, 38, 46 |
| LAN/mobile operation | Implemented configuration: bind address/port, same-origin production assets, optional shared token, responsive board and forms. Desktop and emulated mobile browser checks pass; physical LAN devices remain unverified. | 10, 36–38 |
| Privacy and observability | Implemented baseline: local storage, backend-only secrets, structured logging, classification audit/call/token metrics and documented outbound payloads. No classification batching or dollar-cost estimator. | 32, 36, 39 |
| Backup/export | Implemented CLI: consistent SQLite snapshot, safe settings reference, restore into a new path, integrity checks and secret exclusion. No in-app backup/restore screen; safe settings are reapplied manually. | 40 |
| Documentation and validation | Implemented living product/architecture/domain/setup/test docs, migrations and local correctness/browser fixtures. Remaining validation limits are listed below. | 1, 41–43, 48, 50–51 |

## Chess.com import: added after the original specification

The original prompt deferred live Chess.com integration (sections 47 and 51's staged scope). A subsequent explicit request brought **read-only completed-game import by username** into scope. It does not add live gameplay or account authentication.

Implemented: rapid/blitz/bullet/daily/all filters, calendar-month lookback or explicit inclusive UTC completion dates, newest-first limits of 1–1000 games, learner matching, duplicate handling, serial archive requests, checkpoints, cancellation/retry and local analysis. Defaults are 100 rapid games from the current and previous two calendar months. All-history selection still respects the game limit. Both rated and unrated standard games are included; there is no separate rated-only or exact clock/increment filter. There is no automatic recurring synchronization. See [CHESSCOM_IMPORT.md](CHESSCOM_IMPORT.md).

The limit counts **newly inserted valid games**, so duplicates do not consume it. New imports analyze only their new games; retry older interrupted work separately. Saved classifications survive cancellation and are cached by evidence/model versions. A fresh Chess.com fetch still reads monthly archive responses containing old games, but duplicate records trigger no engine or model work. This is incremental processing, not a network-level delta sync.

## What OpenAI does, and what happens when it is off

| Operation | OpenAI off | OpenAI enabled and configured |
|---|---|---|
| Import PGN/Chess.com games | Works; Chess.com downloads still need internet | Same |
| Legal moves, engine analysis, scores, grading | Local python-chess/Stockfish/policy | Same; model has no authority here |
| Create mistake exercises and schedule reviews | Works from meaningful engine evidence | Same |
| Repertoire/manual practice | Works | Same |
| Assign new pedagogical skill labels | No new model labels; evidence remains available for later classification | Model classifies verified individual decisions into controlled IDs |
| Explain individual classified examples | Previously saved explanations remain | Model writes an interpretation of supplied evidence |
| Weakness priorities and basic course units | Existing evidence/courses remain usable; fresh unclassified data cannot establish new labeled weaknesses | Deterministic code aggregates classified evidence and creates basic units |
| Cross-game model diagnosis, course-level planning/prose | Not implemented | Not implemented |

The model currently classifies one meaningful decision per call; it does not independently choose lesson sequences, diagnose a whole game collection in one request or choose chess answers. Structured validation rejects invalid IDs/schema/evidence references, but does **not** prove that every sentence of an explanation is factually supported. Stronger semantic claim checks and real-model quality evaluation remain work to do. See [CURRICULUM_ENGINE.md](CURRICULUM_ENGINE.md).

## Largest gaps from the original learning experience

1. **Course teaching and progression:** stages are user-marked. Diagnose/Drill currently open the first supporting exercise; Teach opens the first supporting decision, with the other evidence available separately. There is no ordered sequence across multiple examples, automatic stage completion, teaching-gated SRS graduation or mixed-review unit.
2. **Adaptive curriculum continuity:** rebuilding archives the previous course and creates new units. Preserving lesson progress across course revisions, explaining priority changes over time and reconciling old model labels after model/prompt changes need explicit policies.
3. **Broader diagnosis:** the system has a controlled taxonomy and recurrence heuristic, but it does not yet reliably establish all the tactical, opening-structure, conversion, endgame and strength patterns described in the north star. Taxonomy membership is not proof of detector coverage.
4. **LLM pedagogy beyond individual examples:** aggregated classification, grouping related skills, course-level summaries/lesson prose and optional pedagogical ordering are absent. These must stay grounded in saved evidence and cannot affect chess authority.
5. **Practical policy refinement:** currently soundness is interpreted through score/mate thresholds. Better handling of human complexity, recurring low-loss conceptual errors and exercise usefulness needs fixtures and evaluation, not an invented Elo-to-centipawn formula.
6. **Everyday management and hardening:** editable settings, repertoire editing, manual tags UI, large-import profiling, physical LAN testing and cross-platform installation verification remain. Engine changes are detected for compatibility, but automatic reanalysis/regrading migration is not implemented.

## Verification boundary

Last recorded checks: **52 backend tests and 12 desktop/mobile-emulated browser tests passed**, plus TypeScript/Vite build and Ruff. Incremental imports add new-game-only job scope, duplicate-limit and cancellation/cache regressions. Legal-move markers have special-move payload and desktop/mobile interaction coverage.

The end-to-end fixture covers asynchronous PGN import → native Stockfish → injected classifier → course/exercise → persisted review → application reload. Browser tests cover interaction and both import sources using a test-only Chess.com HTTP fixture. A separate read-only live Chess.com smoke check succeeded; it imported no sample account games into the application database. The backup/restore fixture validates a local round trip and secret exclusion.

Not yet verified: live OpenAI response quality/cost, hundreds-of-games performance, physical LAN/mobile use, Linux/macOS installation and remote CI execution. Passing fixtures do not establish complete chess-motif coverage or measurable rating improvement. Existing upstream TestClient deprecation warnings and a Windows pytest-cache permission warning are documented in the plan.

## Deliberately excluded, not forgotten

Public SaaS hosting, registration, payments, social features, matchmaking, LLM opponents, synthetic positions, cloud synchronization, public tactics databases, native mobile apps, distributed workers/engine clusters and GPU chess support remain non-goals (sections 2, 8, 24, 37 and 47). The local-first authority boundaries remain the constraints for every next milestone (sections 3, 39, 46, 48, 52–53).

## Suggested next implementation order

1. Build an actual multi-example Diagnose → Teach → Drill → Retain unit with persisted progress and defined graduation behavior.
2. Preserve that progress when new games update course priorities, with auditable classification-version reconciliation.
3. Expand verified facts and pedagogical quality fixtures, then evaluate the real classifier separately with deliberate opt-in calls.
4. Profile larger imports and finish the settings/repertoire management and LAN/install checks.

This is proposed sequencing, not a claim these features are already underway. See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for milestone status and [DECISIONS.md](DECISIONS.md) for accepted architectural choices.
