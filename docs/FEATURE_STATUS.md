# Feature status against the original specification

Current direction: game review, local mistake classification and structured Study. The user's September 12, 2026 instruction supersedes the original required OpenAI integration. Model connectivity and paid lesson generation have been removed; historical data remains archived. New authored lessons have their own versioned content and account progress.

| Area | Implemented | Missing / limits |
|---|---|---|
| Chess authority | python-chess, native Stockfish, separate practical acceptance policy, explicit mate/perspective types | No tablebases or synthetic positions |
| Accounts | Self-service signup, persistent device sessions, account ownership in one SQLite database, host password recovery | No email recovery or web admin dashboard |
| Game import | Multi-PGN, learner matching, provenance, deduplication, partial errors | Standard chess only |
| Chess.com | Username, mode/date filters, lookback, new-game limit and resumable archives | Completed public games only; automatic recent-game sync for accounts; cached upstream data; no exact clock/increment filter |
| Analysis | Triage/deep passes, MultiPV, actual move at same root, deterministic facts, compatible persistent cache | Bounded engine limits can miss tactics; subtle positional causes often unexplained |
| Human move evidence | Pinned Maia-3 79M policy in a shared isolated CPU worker, both-color ratings/history/domain, private cache, explicit offline-capable setup and optional GPU runtime | Uncalibrated human-likeness signal; never objective evaluation, population percentages or a grading authority |
| Practical difficulty | Versioned deterministic naturalness, best-find bands, candidate-coverage limits, narrow-defense and witness components | Inspected synthetic probe only; domain/fallback uncertainty explicit; does not change grades or infer mental states |
| Review intelligence | Additive bounded refinement, traceable tactical/positional/clock events, game links and owned cross-game context for individual move explanations | Positional facts are descriptive; search drift/gaps abstain; no psychological or training-transfer claims |
| Coach dialogue | Shared evidence-led intents and deterministic utterances; every registered coach has a character bible, curated voice and complete neutral fallback | No LLM or runtime TTS; finite curated corpus; long authorized explanations remain scrollable; only Walter and Rivet have recorded speech |
| Sound and coach voice | Owner-selected recorded board and practice sounds; account sound settings and device mute; prerecorded Walter and Rivet banks (438 recordings each) with Automatic, On request and Off narration, one automatic turn per review action and aligned mouth timing | Other coaches stay text-only until their own approved bank is registered; spoken audio summarizes the supported idea rather than reading every sentence; lessons are not narrated |
| Developer diagnostics | Separate offline intelligence lab, full-cast/blind comparison and corpus audit; existing expression studio remains separate | Local saved JSON only; absent production routes and bundles |
| Jobs | Persistent queue/progress, parallel engines/local rule workers, cancellation/cache/restart | One backend process |
| Classification | Pinned Lichess tactical recognition, adaptive saved continuations, connected combinations, before/after causes, native tests for relative pins/fork defenses/trapped pieces, separated outcomes/patterns/cues and exact audits | Version 4 with unchanged mistake-evidence gates; overloads, economically ineffective multiple defenders and broad strategic causes remain unsupported |
| Weaknesses | Independent-game aggregation, separate pattern/outcome coverage, cues, all supporting examples and focused practice | No calibrated diagnostic accuracy; independent human benchmark outstanding |
| Review | Cold board, tap/drag, backend legal markers, promotion, accepted alternatives, first-failure semantics; shared animated board, badges and stable illustrated coach; compact header and full-width mobile board | No multi-move graded sequence; deeper lines are playback; training acceptance is separate from full-game ratings |
| Full-game review | Games library, both-color resumable analysis, Lichess accuracy beside players and move quality, nine move labels including offline Book recognition, responsive evaluation timeline, stable illustrated coach, rated branching variations, immediate arrows and witness highlights, animated moves, compact notation and integrated return-to-game navigation | Finite engine evidence; conservative Brilliant/Great rules; Book means a recognized opening, including unsound named lines; only Blunder severity varies by rating; branches last while the game is open; accuracy requires a complete review with both sides having moved; spoken coaching only for Walter and Rivet |
| Explanations | Automatic counter on failure, Try again, deeper Show me why; Reveal move plays answer; success explanation/playback | Witness buttons and square-role highlights where supported; quiet positional explanations remain limited |
| Focused practice | Up to 12 distinct real positions per selected weakness, separate session/attempt/time records, no FSRS writes | A new batch can repeat earlier practice; reload returns to mixed review |
| SRS | FSRS, automatic Again/Hard/Good, raw response times, persistent due queue, permanent retirement above configured 100 days | No personal parameter optimization; elapsed time includes idle/tab time |
| Guided Study lessons | Six authored step types, connected branches, annotated game playback, independent rehearsal, private versioned progress and exact resume; sourced courses for White’s Italian, Black’s Italian and White’s King’s Gambit, with chapter boundaries based on distinct learning goals | No graphical content editor or generated lessons; three focused courses, not a complete opening repertoire |
| Archived courses / lessons | Historical data preserved in backups; nonretired lesson-held positions released to Due | Legacy product routes remain removed; not reused by authored Study lessons |
| Opening study | Bundled catalogue and designated course lines, preview and side choice, transposed/shared cards in existing Due, immutable attempt answers, safe pause/restore/content revisions, dedicated rehearsal | One-decision scheduled recall; no arbitrary repertoire PGN import or automatic enrollment |
| Repertoire | Historical records preserved for backup/export | Removed from the app and review queue; list/import and direct practice return 410 |
| Manual exercises | Low-level validated API retained for existing integrations and deterministic review fixtures | Creation form removed; no product navigation |
| Settings | Account sessions, Chess.com connection, training-label refresh and capped deeper-evidence jobs; compact source download link | Host configuration stays in the environment; restart after edits |
| LAN/mobile | Same-origin frontend, configurable bind, optional token, compact four-screen mobile layout, expandable filters/settings/history, accessible evidence dialog, Windows firewall helper | Use the documented account/proxy configuration for shared hosting |
| Data and backups | SQLite WAL, migrations, consistent backup/restore and preserved historical audits | CLI backup only; no cloud sync |
| Quality | Rules/engine/API/browser tests, frozen HTTP contracts, independent app instances, migration preservation, blinded stratified export and frozen annotation comparison; first assistant assessment with preserved adjudications; offline Lichess positive-theme benchmark and per-theme failure corpus | External puzzle agreement tests the line detector only; initial recognition is uneven. Independent human precision, full-classifier recall and long-term improvement remain unmeasured |

## Remaining validation and packaging work

Independent human-reviewed precision and full-classifier recall on unseen games
remain unmeasured; the existing assistant assessment and puzzle benchmark are not
substitutes. Longitudinal training-transfer measurement is separate from retention
or recurrence statistics. Representative large-import/resource measurements,
manual Linux/macOS installation and physical-phone LAN checks require their own
validation; browser emulation alone does not establish those results.

Source-checkout and Docker installation are supported. Standalone wheel/static
asset packaging and a dedicated engine-upgrade/reanalysis workflow remain future
work. Deferred puzzle acquisition/generation and additional authored material are
recorded in [Study](STUDY.md#deferred-content-requirements). These are remaining
limits, not newly scheduled implementation work.

## No remote teaching model

Import, analysis, classification, weakness aggregation, answers, explanations, playback and FSRS all run locally. PGN training needs no network; explicit Chess.com imports contact its public API. Optional Maia inference uses an explicitly pre-cached local checkpoint. No remote teaching model, API key, paid request pool or outbound pedagogy payload is used. Coach recordings are bundled files; playback uses no voice service.

Historical classification IDs/responses remain in provider-neutral audit storage. Old model labels are inactive; local findings replace the active projection. Historical teaching records remain in backups/audit endpoints; generation and old job retries return 410. Saved lessons and review history are retained.

## Incremental behavior

New-game limits exclude duplicates. Reimported games do not rerun analysis. Local classification caches labeled and unclassified outcomes by rules, parameters, taxonomy and evidence. Worker-count changes do not invalidate caches. Cancel/retry preserves work. Reclassification creates no reviews, changes no SRS and never reactivates retired cards.

See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for exact scope and limits and [VERIFICATION.md](VERIFICATION.md) for completed checks.

The deeper-evidence job prioritizes concrete pending defensive questions, then unknown outcomes and saves supplemental analysis links separately. Completed probe keys and persisted task lists support cancellation/restart without repeating completed searches or expanding the job budget. Existing grading evidence and schedules remain unchanged.

See [CLASSIFICATION_ASSESSMENT.md](CLASSIFICATION_ASSESSMENT.md) for coverage progression and the first blinded assistant comparison. [LICHESS_BENCHMARK.md](LICHESS_BENCHMARK.md) documents the developer-only external positive-label test, with [initial results](LICHESS_BENCHMARK_RESULTS.md). It is not a Lichess import/training product feature.

## Game-review interaction

The game history uses compact rows with player ratings and piece colors, aligned
results and accuracy, the learner's won/lost/drawn result, time control, move count
and date. Whole-row game links retain browser navigation and new-tab behavior.
On mobile the time, moves and date sit below the two player lines. The page uses
saved PGN metadata and batches completed accuracy reads without engine work.

The review workspace uses a compact title and viewport-sized desktop board; mobile
remains scrollable. Move quality appears on the destination square, coach bubble,
main-game notation and rated variation moves. Piece transitions last 280 ms and
respect reduced-motion preferences.

The permanent Game control in board navigation returns to the move from which
exploration began. Show why uses arrows and square highlights without moving
pieces or creating a branch. Only immediate saved evidence is drawn; deeper
engine positions are not overlaid onto the current board. Escape first clears
cues, then returns from a manual variation. Every manually played
variation move is analyzed through a serialized, deduplicated queue, even when
the user plays ahead or returns to the game before its rating arrives. Browsing
positions remains debounced. Variations are retained while that game is open.

Player Elo is read from the PGN WhiteElo/BlackElo headers and displayed beside
each player. Both saved-game and variation labels use the moving player's Elo;
missing or invalid headers use the review fallback (1000 by default). Completed
reviews have no report-control panel or manual label-update action. Start, pause
and resume controls appear only while analysis remains unfinished.

Completed reviews show Lichess accuracy beside each player's name, independent of
Elo. Saved evaluations supply the scores without more engine work. The readouts
reserve their space during review and keep the original game's values in variations.
See [Game accuracy](GAME_ACCURACY.md) for the pinned method and completeness rules.

On desktop the board uses the available viewport height, with only compact
player rows and move controls around it. The title, coach, compact notation and
evaluation timeline live in the right panel, which fills the remaining width
rather than having a fixed width. Resizing accounts for the shared header;
narrow windows may limit the board width to keep the panel usable.
The coach's message scrolls within a stable bubble and its actions keep a reserved
row, so changes in wording, loading, errors or tactical evidence do not move the
notation. The graph fills its panel at every width, with dots sized to the space
per ply. Clicking or tapping a dot or the graph selects the corresponding original
game position. Review progress and the move-quality summary follow the graph.
