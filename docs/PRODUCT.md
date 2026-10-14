# Product

Fieldwork is private chess practice built from the player's own games. Import games, identify practical mistakes with native Stockfish, review useful positions and retain them with FSRS. Defaults serve a beginner progressing toward 1500 rapid. Multiple sound answers are accepted; small engine preferences usually do not create exercises.

Open review can explain supported tactical consequences, immediate positional
changes, human difficulty and relationships to earlier game moments. Saved
classified history can add a supported recurring issue to individual move
feedback. These references have explicit evidence, not simulated
memory. Optional Maia describes human-like choices without changing grades or
claiming calibrated percentages for Chess.com ratings. A selected coach changes
the language and expression, not the chess truth. Cold SRS still reveals none of
these hints before an attempt or reveal.

## Active learning loop

Import PGNs or completed public Chess.com and Lichess games, analyze the learner's decisions locally, save verified evidence, and turn meaningful mistakes into review positions. Versioned local rules classify supported consequences and tactical mechanisms. A position can remain unclassified and still be useful in Review.

The six screens are **Home, Study, Play, Games, Insights and Settings**, in that order on desktop and mobile.
All screens share the compact navigation header, including the Games library and
game-review workspace. Desktop uses the same 56px navigation row throughout;
phones retain the compact navigation with full-size touch targets; it scrolls
away with the page instead of staying pinned, so the screen keeps its vertical space.
Each screen and game has its own URL. Browser Back/Forward, bookmarks, refresh,
and opening navigation or game links in a new tab work normally. Returning to the
Games library restores its page and scroll position; returning to a game restores
the selected move. Moving through a game updates the current URL without adding
a browser-history stop for each move.

- **Home** is the default landing page at `/`: the authoritative due count and a study action, four latest saved games, up to two resumable lessons (or an available course), active opening-line count and up to three supported tactical practice priorities. Priorities retain backend evidence ordering and mark early evidence. Each area loads and retries independently. Home starts no sessions, imports or analysis; its links open the existing pages. It never previews cold recall answers or boards.
- **Games** browses imported games, runs resumable analysis of both colors, and shows Lichess accuracy for each player, move-quality labels, a timeline and an illustrated tactical coach. Accuracy uses saved evaluations with no Elo adjustment or extra engine searches. The board accepts variations at any point, with undo, saved in-session branches and a return to the original game. Coach evidence and variation analysis never count as scheduled recalls. See [Game review](GAME_REVIEW.md) for scoring rules and limits.
  The progress panel closes after baseline analysis. Targeted deeper checks
  continue in the background and update the review as results arrive. Interrupted
  or failed work retains recovery controls.

- **Play** starts a game against the selected coach. The coach's bot plays like a person at a chosen rating, or at the level measured from the learner's own imported games, with Stockfish only vetoing the mistakes that rating never makes; engine levels from 1800 use Stockfish's own limiter. Commentary is always on: each move gets the review's label, evaluation, coach reaction and graph as it is played, and the coach's verdict on the learner's move arrives before the bot answers. The coach never resigns or offers draws. Finished games, including the learner's resignations, are saved to Games and reviewed there. See [Play](PLAY.md).
- **Study → Due** starts scheduled game recall with an unlabeled board. The backend supplies legal moves and grades answers. A failed engine answer previews the opponent's saved counter; Try again restores the board and Show me why opens deeper playback. Success offers factual feedback and optional Show why. Reveal move performs the saved answer. Repeated retries create only one failed recall per session. Existing `/review` bookmarks and exercise/focused-practice links redirect to Due without an extra browser-history entry.
- **Opening recall in Due** shows the selected opening context and asks for a studied move. Overlapping active lines share a card and union their answers. These are repertoire decisions, not engine grades: a different legal move is outside the selected study. Attempts pin their answers; an outdated attempt can finish without changing the current schedule. Pausing a study preserves its history, and dedicated line practice remains separate from FSRS.
- **Study → Puzzles** uses separate multi-move practice sessions. The server saves accepted moves and opponent replies together; reload restores that committed position. A wrong move keeps the same decision available and permanently marks that solve as non-clean. Reveal ends the solve. Themes, solutions and attribution remain hidden until completion. A bundled, hash-pinned CC0 Lichess starter pack of 972 puzzles, each solution verified unique and winning by Stockfish, supplies production content; `PUZZLE_PACK_PATH` adds a larger installed pack and `PUZZLE_STARTER_PACK=false` leaves an honest empty library. Difficulty bands, a theme filter and a Retry mode choose among unseen puzzles without any rating or mastery claim. Test fixtures are injected only into the test application. Puzzle practice never updates FSRS, ordinary recalls or weaknesses.
- **Study → Lessons → Openings** hosts authored lessons with explanations, demonstrations, guided decisions, optional branches, annotated source-game playback and independent rehearsal. Progress belongs to the account and a pinned content revision. Back, branch return and reload preserve chess context; lesson completion records activity rather than mastery. Five opening courses teach a quiet White Italian repertoire, Black’s Italian responses, the King’s Gambit for White, the Sicilian Dragon for Black and the Vienna Gambit for White. Chapter boundaries follow distinct learning goals and the opening's demands, with concrete practice of the resulting plans; the Italian and King’s Gambit courses also include sourced historical examples. Their designated lines enter Due only through explicit enrollment.
- **Study → Lessons → Fundamentals** uses the same lesson player and progress for courses that teach patterns and basic skills rather than an opening. A tactics course teaches forks, pins, skewers, discovered attacks, removing a defender and back-rank checkmate on short, engine-checked positions. A fundamentals course teaches piece values, counting attackers and defenders, looking for checks, captures and threats, opening principles, checkmating a lone king and king and pawn endings. Neither has recall lines. The Study home's Lessons card counts the chapters not yet completed across all lesson courses.
- **Insights** opens on an **Overview** of patterns across saved games: when and how they are won or lost, records and ratings, openings, conversion and escapes, game shapes, accuracy by move and phase, play after a loss, clock pressure and endgames. It is read-only and starts no analysis; see [Insights](INSIGHTS.md). Its **Weaknesses** section, with **Tactical patterns** and **Material & mate** categories, separates material/mate outcomes from tactical patterns, shows supporting decisions and practice cues, and starts focused batches of up to 12 distinct positions. Focused attempts are stored separately and never change FSRS.
- **Import games in Settings** supports multi-game PGNs, explicit learner matching and filtered Chess.com and Lichess username imports. Only new games enter new analysis jobs; cancellation/retry preserves completed work.
  Source selection sits above equally sized form and activity panels. Their
  headings and edges align on desktop; activity entries share one panel with
  separators. At 900px and below, activity stacks below the form. Every new game is
  analyzed automatically; there is no analysis choice ([Automatic game analysis](GAME_ANALYSIS.md)).
- **Settings** contains account and device sign-out controls, password changes, the Chess.com and Lichess connections, game import tools and analysis activity, actions to refresh training labels or deepen unclear positions, and, for administrators, account and course management. Its compact coach grid shows all thirty characters in six columns and five rows on desktop, with fewer columns on smaller screens and no category headings or navigation; the saved selection changes presentation and wording, never chess evidence. Coach and interface motion remain separate account preferences. Host configuration and diagnostic tables stay out of the user interface; operators configure the environment or .env. The header shows navigation without a local/account status badge.

FSRS increases intervals after successful recall. An interval strictly above the configured threshold (100 days by default) permanently retires the position, preserving history. The cold review board hides source, concept, previous moves, scores and answers; feedback and playback become available after an attempt or reveal.

## Authorities and limits

Python-chess owns rules. Stockfish owns evaluations and verified alternatives. Python policy owns grading. Local detectors assign labels only when their evidence conditions pass. The retained low-level manual exercise API validates curated moves with python-chess; saved manual answers define those exercises' acceptance.

Classification supports factual feedback, recurring-weakness evidence and focused practice. Independent games support recurrence; one error does not establish a recurring weakness or reveal what the player was thinking. Classification v4 reuses pinned Lichess motif recognition and retains auditable witnesses, optional native defense checks and explicit abstentions. Coverage and accuracy are separate measurements. Independent human review of accuracy is still outstanding.

## Removed and archived

The old generated lesson/course domain, Repertoire and manual-position entry forms remain archived. Historical data and domain helpers remain for compatibility and backups. Their legacy product routes return HTTP 410; archived sessions cannot be practiced through review endpoints. The authored Study lesson framework uses separate versioned content and progress, not those archived tables or endpoints. Historical teaching audits and the low-level manual exercise API remain accessible. Imports and classification never generate courses or enroll cards into lessons.

There is no LLM runtime, SDK, model service or model API-key requirement. Historical model responses are retained locally for audit; their labels are inactive.

## Local operation

Data lives in one SQLite database on the host. PGN analysis and training work offline once dependencies and Stockfish are installed. Shared hosting supports self-service accounts with private games and training history, persistent device sessions, and remembered Chess.com and Lichess usernames. Recent-game sync contacts the public Chess.com and Lichess APIs and queues each new game's review in the background. Docker packages the app and native Stockfish for Unraid behind an existing reverse proxy and optional Cloudflare Access. LAN clients can also use the original single-user mode. There is no cloud database or telemetry. See [Accounts](ACCOUNTS.md) and [Unraid](UNRAID.md).

See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for detector scope.

## Feature status

Current direction: game review, local mistake classification and structured Study. Historical generated-lesson data remains archived (see [Removed and archived](#removed-and-archived)); authored lessons have their own versioned content and account progress.

| Area | Implemented | Missing / limits |
|---|---|---|
| Chess authority | python-chess, native Stockfish, separate practical acceptance policy, explicit mate/perspective types | No tablebases or synthetic positions |
| Accounts | Administrator-added members (sign-ups closed by default, with a switch to open them), persistent device sessions, account ownership in one SQLite database, password changes in Settings, an administrator account list in Settings → Account (temporary password resets), host `promote` and password recovery commands | No email recovery |
| Game import | Multi-PGN, learner matching, provenance, deduplication, partial errors | Standard chess only |
| Chess.com and Lichess | Username, mode/date filters, lookback, new-game limit and resumable checkpoints; saved connections polled for new games, which are reviewed automatically | Completed public games only; cached upstream data; no exact clock/increment filter |
| Analysis | Triage/deep passes, MultiPV, actual move at same root, deterministic facts, compatible persistent cache | Bounded engine limits can miss tactics; subtle positional causes often unexplained |
| Human move evidence | Pinned Maia-3 79M policy in a shared isolated CPU worker, both-color ratings/history/domain, a cache shared across accounts, explicit offline-capable setup and optional GPU runtime | Uncalibrated human-likeness signal; never objective evaluation, population percentages or a grading authority |
| Practical difficulty | Versioned deterministic naturalness, best-find bands, candidate-coverage limits, narrow-defense and witness components | Inspected synthetic probe only; domain/fallback uncertainty explicit; does not change grades or infer mental states |
| Review intelligence | Additive bounded refinement, traceable tactical/positional/clock events, game links and owned cross-game context for individual move explanations | Positional facts are descriptive; search drift/gaps abstain; no psychological or training-transfer claims |
| Coach dialogue | Shared evidence-led intents and deterministic utterances; every registered coach has a character bible, curated voice and complete neutral fallback | No LLM or runtime TTS; finite curated corpus; long authorized explanations remain scrollable |
| Sound and coach voice | Owner-selected recorded board and practice sounds; account sound settings and device mute; prerecorded voice banks for all 30 coaches with Automatic, On request and Off narration, one automatic turn per review action and aligned mouth timing | A line written but not yet recorded shows as text; spoken audio summarizes the supported idea rather than reading every sentence; Maia readings appear only in the Maia badge and popup, never in the coach's line; lessons are not narrated |
| Developer diagnostics | Separate offline intelligence lab, full-cast/blind comparison and corpus audit; existing expression studio remains separate | Local saved JSON only; absent production routes and bundles |
| Jobs | Persistent queue/progress, parallel engines/local rule workers, cancellation/cache/restart | One backend process |
| Classification | Pinned Lichess tactical recognition, adaptive saved continuations, connected combinations, before/after causes, native tests for relative pins/fork defenses/trapped pieces, separated outcomes/patterns/cues and exact audits | Version 4; upstream motifs do not relax mistake-evidence gates; overloads, economically ineffective multiple defenders and broad strategic causes remain unsupported |
| Weaknesses | Under Insights; rated (or unknown) games only; independent-game aggregation, separate pattern/outcome coverage, cues, all supporting examples and focused practice | No calibrated diagnostic accuracy; independent human benchmark outstanding |
| Review | Cold board, tap/drag, backend legal markers, promotion, accepted alternatives, first-failure semantics; shared animated board, badges and stable illustrated coach; compact header and full-width mobile board | No multi-move graded sequence; deeper lines are playback; training acceptance is separate from full-game ratings |
| Full-game review | Games library, both-color resumable analysis, Lichess accuracy beside players and move quality, nine move labels including offline Book recognition, responsive evaluation timeline, stable illustrated coach, rated branching variations, immediate arrows and witness highlights, the opponent's best reply as an arrow and under Best, PGN clocks, animated moves, compact notation and integrated return-to-game navigation | Finite engine evidence; conservative Brilliant/Great rules; Book means a recognized opening, including unsound named lines; only Blunder severity varies by rating; branches last while the game is open; accuracy requires a complete review with both sides having moved |
| Game insights | Insights → Overview: results by weekday/time, endings, streaks, rating series, openings, book exits, conversion/escapes, game shapes, accuracy by move and phase, after-loss play, clocks, punished mistakes and endgames; read-only from saved PGNs and completed reviews; Weaknesses categories in the same tab bar | Unrated games are excluded (Chess.com games saved before the rated flag need a re-import to get it); evaluation sections cover reviewed games only; no tactics-found-of-chances by motif, mastery score or coach commentary |
| Explanations | Automatic counter on failure, Try again, deeper Show me why; Reveal move plays answer; success explanation/playback | Witness buttons and square-role highlights where supported; quiet positional explanations remain limited |
| Focused practice | Up to 12 distinct real positions per selected weakness, separate session/attempt/time records, no FSRS writes | A new batch can repeat earlier practice; reload returns to mixed review |
| SRS | FSRS, automatic Again/Hard/Good, raw response times, persistent due queue, permanent retirement above configured 100 days | No personal parameter optimization; elapsed time includes idle/tab time |
| Guided Study lessons | Six authored step types, connected branches, annotated game playback, independent rehearsal, private versioned progress and exact resume; sourced courses for White’s Italian, Black’s Italian, White’s King’s Gambit, Black’s Sicilian Dragon and White’s Vienna Gambit, with chapter boundaries based on distinct learning goals; a tactics course on six basic patterns and a fundamentals course on six basic skills, listed under Study → Lessons → Fundamentals | Administrator lesson editor only (Settings → Courses); no generated lessons; five focused opening courses, not a complete opening repertoire; the tactics and fundamentals courses cover six basic patterns and six basic skills, White to move only |
| Archived courses / lessons | Historical data preserved in backups; nonretired lesson-held positions released to Due | Legacy product routes remain removed; not reused by authored Study lessons |
| Puzzles | Bundled hash-pinned CC0 Lichess starter pack (972 puzzles weighted toward lower ratings, every solution verified by Stockfish as the unique winning line), optional installed pack, puzzles mined from the learner's own analyzed games (missed mates and wins verified by Stockfish as unique two-plus-move lines, generated after each analysis job and by a capped backfill job, provenance and game-review link after the solve), offline multi-move solving with retry/reveal, unseen-first selection by difficulty band, goal and theme, Retry mode, private progress separate from FSRS | Own-game puzzles cover missed mates and material wins only, with no defensive puzzles, accepted alternatives or difficulty rating yet; Lichess themes and ratings are external labels, not a mastery or transfer measure |
| Play | Games against the selected coach: human-like levels sampled from Maia-3 at a chosen or measured rating with Stockfish as a blunder guardrail, engine levels from 1800, a per-account level fit from imported games, commentary always on (the review's own per-move evidence, spoken before the bot answers), the learner can resign, opening practice against a course's repertoire lines; finished games enter the library and its ordinary review | No clock; the coach never resigns and offers no draws; no games seeded from weakness positions; new game-specific spoken meanings are listed in [Play](PLAY.md) and not yet recorded, so those moments show text or stay silent; bot strength labels are measured conditioning values, not calibrated ratings |
| Opening study | Bundled catalogue and designated course lines, preview and side choice, transposed/shared cards in existing Due, immutable attempt answers, safe pause/restore/content revisions, dedicated rehearsal | One-decision scheduled recall; no arbitrary repertoire PGN import or automatic enrollment |
| Repertoire | Historical records preserved for backup/export | Removed from the app and review queue; list/import and direct practice return 410 |
| Manual exercises | Low-level validated API retained for existing integrations and deterministic review fixtures | Creation form removed; no product navigation |
| Settings | Account sessions and password, Chess.com and Lichess connections, training-label refresh and capped deeper-evidence jobs, administrator account and course tools; compact source download link | Host configuration stays in the environment; restart after edits |
| LAN/mobile | Same-origin frontend, configurable bind, optional token, compact six-screen mobile layout, expandable filters/settings/history, accessible evidence dialog, Windows firewall helper | Use the documented account/proxy configuration for shared hosting |
| Data and backups | SQLite WAL, migrations, consistent backup/restore and preserved historical audits | CLI backup only; no cloud sync |
| Quality | Rules/engine/API/browser tests, frozen HTTP contracts, independent app instances, migration preservation, blinded stratified export and frozen annotation comparison; an assistant assessment with preserved adjudications; offline Lichess positive-theme benchmark and per-theme failure corpus | External puzzle agreement tests the line detector only; initial recognition is uneven. Independent human precision, full-classifier recall and long-term improvement remain unmeasured |

### Remaining validation and packaging work

Independent human-reviewed precision and full-classifier recall on unseen games
remain unmeasured; the existing assistant assessment and puzzle benchmark are not
substitutes. Longitudinal training-transfer measurement is separate from retention
or recurrence statistics. Representative large-import/resource measurements,
manual Linux/macOS installation and physical-phone LAN checks require their own
validation; browser emulation alone does not establish those results.

Source-checkout and Docker installation are supported. Standalone wheel/static
asset packaging and a dedicated engine-upgrade/reanalysis workflow remain future
work. Defensive game-derived puzzles, accepted alternatives and additional
authored material are recorded in [Study](STUDY.md#deferred-content-requirements).
These are remaining limits, not newly scheduled implementation work.
