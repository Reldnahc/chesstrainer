# Feature status against the original specification

Current direction: Review and local mistake classification. The user's September 12, 2026 instruction supersedes the original required OpenAI integration. Model connectivity and paid lesson generation have been removed; historical data remains. Course and lesson flows are removed pending a future redesign; historical rows are archived.

| Area | Implemented | Missing / limits |
|---|---|---|
| Chess authority | python-chess, native Stockfish, separate practical acceptance policy, explicit mate/perspective types | No tablebases or synthetic positions |
| Accounts | Self-service signup, persistent device sessions, account ownership in one SQLite database, host password recovery | No email recovery or web admin dashboard |
| Game import | Multi-PGN, learner matching, provenance, deduplication, partial errors | Standard chess only |
| Chess.com | Username, mode/date filters, lookback, new-game limit and resumable archives | Completed public games only; automatic recent-game sync for accounts; cached upstream data; no exact clock/increment filter |
| Analysis | Triage/deep passes, MultiPV, actual move at same root, deterministic facts, compatible persistent cache | Bounded engine limits can miss tactics; subtle positional causes often unexplained |
| Jobs | Persistent queue/progress, parallel engines/local rule workers, cancellation/cache/restart | One backend process |
| Classification | Pinned Lichess tactical recognition, adaptive saved continuations, connected combinations, before/after causes, native tests for relative pins/fork defenses/trapped pieces, separated outcomes/patterns/cues and exact audits | Version 4 with unchanged mistake-evidence gates; overloads, economically ineffective multiple defenders and broad strategic causes remain unsupported |
| Weaknesses | Independent-game aggregation, separate pattern/outcome coverage, cues, all supporting examples and focused practice | No calibrated diagnostic accuracy; independent human benchmark outstanding |
| Review | Cold board, tap/drag, backend legal markers, promotion, accepted alternatives, first-failure semantics | No multi-move graded sequence; deeper lines are playback |
| Full-game review | Games library, both-color resumable analysis, eight move labels, evaluation timeline, illustrated coach, rated branching variations, short coach previews and witness highlights, animated moves, prominent ratings, compact desktop layout and explicit return-to-game navigation | Finite engine evidence; conservative Brilliant/Great rules; only Blunder severity varies by rating; branches last while the game is open; no accuracy percentage or voice |
| Explanations | Automatic counter on failure, Try again, deeper Show me why; Reveal move plays answer; success explanation/playback | Witness buttons and square-role highlights where supported; quiet positional explanations remain limited |
| Focused practice | Up to 12 distinct real positions per selected weakness, separate session/attempt/time records, no FSRS writes | A new batch can repeat earlier practice; reload returns to mixed review |
| SRS | FSRS, automatic Again/Hard/Good, raw response times, persistent due queue, permanent retirement above configured 100 days | No personal parameter optimization; elapsed time includes idle/tab time |
| Courses / lessons | Historical data preserved in backups; nonretired lesson-held positions released to Review | Removed from navigation and active API; future lesson design is deferred |
| Repertoire | Historical records preserved for backup/export | Removed from the app and review queue; list/import and direct practice return 410 |
| Manual exercises | Low-level validated API retained for existing integrations and deterministic review fixtures | Creation form removed; no product navigation |
| Settings | Validated .env, current coverage, local backfill and capped optional deeper-evidence jobs | No full settings editor; restart after edits |
| LAN/mobile | Same-origin frontend, configurable bind, optional token, compact five-screen mobile layout, expandable filters/settings/history, accessible evidence dialog, Windows firewall helper | Private LAN product, not secured for direct public hosting |
| Data and backups | SQLite WAL, migrations, consistent backup/restore and preserved historical audits | CLI backup only; no cloud sync |
| Quality | Rules/engine/API/browser tests, frozen HTTP contracts, independent app instances, migration preservation, blinded stratified export and frozen annotation comparison; first assistant assessment with preserved adjudications; offline Lichess positive-theme benchmark and per-theme failure corpus | External puzzle agreement tests the line detector only; initial recognition is uneven. Independent human precision, full-classifier recall and long-term improvement remain unmeasured |

## What no longer needs a model

Import, analysis, classification, weakness aggregation, answers, explanations, playback and FSRS all run locally. PGN training needs no network; explicit Chess.com imports contact its public API. No model key, SDK, selector, paid request pool or outbound pedagogy payload remains.

Historical classification IDs/responses remain in provider-neutral audit storage. Old model labels are inactive; local findings replace the active projection. Historical teaching records remain in backups/audit endpoints; generation and old job retries return 410. Saved lessons and review history are retained.

## Incremental behavior

New-game limits exclude duplicates. Reimported games do not rerun analysis. Local classification caches labeled and unclassified outcomes by rules, parameters, taxonomy and evidence. Worker-count changes do not invalidate caches. Cancel/retry preserves work. Reclassification creates no reviews, changes no SRS and never reactivates retired cards.

See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for exact scope/limits, [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for current priorities, [VERIFICATION.md](VERIFICATION.md) for completed checks, and [CLASSIFICATION_RESEARCH.md](CLASSIFICATION_RESEARCH.md) for the research behind this change.

The deeper-evidence job prioritizes concrete pending defensive questions, then unknown outcomes and saves supplemental analysis links separately. Completed probe keys and persisted task lists support cancellation/restart without repeating completed searches or expanding the job budget. Existing grading evidence and schedules remain unchanged.

See [CLASSIFICATION_ASSESSMENT.md](CLASSIFICATION_ASSESSMENT.md) for coverage progression and the first blinded assistant comparison. [LICHESS_BENCHMARK.md](LICHESS_BENCHMARK.md) documents the developer-only external positive-label test, with [initial results](LICHESS_BENCHMARK_RESULTS.md). It is not a Lichess import/training product feature.

## Game-review interaction

The review workspace uses a compact title and viewport-sized desktop board; mobile
remains scrollable. Move quality appears on the destination square, coach bubble,
main-game notation and rated variation moves. Piece transitions last 280 ms and
respect reduced-motion preferences.

Back to game (or Escape) returns to the game move from which exploration began,
including when a coach preview started one ply earlier. Coach previews show the
move and immediate reply, with up to four plies for a selected tactical witness;
they do not populate the user's variation history. These are short engine
continuations, not proofs that every defense fails. Every manually played
variation move is analyzed through a serialized, deduplicated queue, even when
the user plays ahead or returns to the game before its rating arrives. Browsing
positions remains debounced. Variations are retained while that game is open.

Player Elo is read from the PGN WhiteElo/BlackElo headers and displayed beside
each player. Both saved-game and variation labels use the moving player's Elo;
missing or invalid headers use the review fallback (1000 by default). Completed
reviews have no report-control panel or manual label-update action. Start, pause
and resume controls appear only while analysis remains unfinished.

On desktop the board uses the available viewport height, with only compact
player rows and move controls around it. The title, branch-return action and
evaluation timeline live in the right panel, which fills the remaining width
rather than having a fixed width. Resizing accounts for the application and
account bars; narrow windows may limit the board width to keep the panel usable.
