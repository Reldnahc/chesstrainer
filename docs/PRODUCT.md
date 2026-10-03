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

Import PGNs or completed public Chess.com games, analyze the learner's decisions locally, save verified evidence, and turn meaningful mistakes into review positions. Versioned local rules classify supported consequences and tactical mechanisms. A position can remain unclassified and still be useful in Review.

The five screens are **Home, Study, Games, Insights and Settings**, in that order on desktop and mobile.
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

- **Study → Due** starts scheduled game recall with an unlabeled board. The backend supplies legal moves and grades answers. A failed engine answer previews the opponent's saved counter; Try again restores the board and Show me why opens deeper playback. Success offers factual feedback and optional Show why. Reveal move performs the saved answer. Repeated retries create only one failed recall per session. Existing `/review` bookmarks and exercise/focused-practice links redirect to Due without an extra browser-history entry.
- **Opening recall in Due** shows the selected opening context and asks for a studied move. Overlapping active lines share a card and union their answers. These are repertoire decisions, not engine grades: a different legal move is outside the selected study. Attempts pin their answers; an outdated attempt can finish without changing the current schedule. Pausing a study preserves its history, and dedicated line practice remains separate from FSRS.
- **Study → Puzzles** uses separate multi-move practice sessions. The server saves accepted moves and opponent replies together; reload restores that committed position. A wrong move keeps the same decision available and permanently marks that solve as non-clean. Reveal ends the solve. Themes, solutions and attribution remain hidden until completion. A bundled, hash-pinned CC0 Lichess starter pack of 972 puzzles, each solution verified unique and winning by Stockfish, supplies production content; `PUZZLE_PACK_PATH` adds a larger installed pack and `PUZZLE_STARTER_PACK=false` leaves an honest empty library. Difficulty bands, a theme filter and a Retry mode choose among unseen puzzles without any rating or mastery claim. Test fixtures are injected only into the test application. Puzzle practice never updates FSRS, ordinary recalls or weaknesses.
- **Study → Openings** hosts authored lessons with explanations, demonstrations, guided decisions, optional branches, annotated source-game playback and independent rehearsal. Progress belongs to the account and a pinned content revision. Back, branch return and reload preserve chess context; lesson completion records activity rather than mastery. Three included courses teach a quiet White Italian repertoire, Black’s Italian responses and the King’s Gambit for White. Chapter boundaries follow distinct learning goals and the opening's demands, with sourced historical examples and concrete practice of the resulting plans. Their designated lines enter Due only through explicit enrollment.
- **Insights** opens on an **Overview** of patterns across saved games: when and how they are won or lost, records and ratings, openings, conversion and escapes, game shapes, accuracy by move and phase, play after a loss, clock pressure and endgames. It is read-only and starts no analysis; see [Insights](INSIGHTS.md). Its **Tactical patterns** and **Material & mate** sections are the former Weaknesses screen: it separates material/mate outcomes from tactical patterns, shows supporting decisions and practice cues, and starts focused batches of up to 12 distinct positions. Focused attempts are stored separately and never change FSRS.
- **Import games in Settings** supports multi-game PGNs, explicit learner matching and filtered Chess.com username imports. Only new games enter new analysis jobs; cancellation/retry preserves completed work.
  Source selection sits above equally sized form and activity panels. Their
  headings and edges align on desktop; activity entries share one panel with
  separators. At 900px and below, activity stacks below the form. Training analysis
  is an optional inline checkbox for either source.
- **Settings** contains account and device sign-out controls, the Chess.com connection, game import tools and analysis activity, and actions to refresh training labels or deepen unclear positions. Its compact coach grid shows all thirty characters in six columns and five rows on desktop, with fewer columns on smaller screens and no category headings or navigation; the saved selection changes presentation and wording, never chess evidence. Coach and interface motion remain separate account preferences. Host configuration and diagnostic tables stay out of the user interface; operators configure the environment or .env. The header shows navigation without a local/account status badge.

FSRS increases intervals after successful recall. An interval strictly above the configured threshold (100 days by default) permanently retires the position, preserving history. The cold review board hides source, concept, previous moves, scores and answers; feedback and playback become available after an attempt or reveal.

## Authorities and limits

Python-chess owns rules. Stockfish owns evaluations and verified alternatives. Python policy owns grading. Local detectors assign labels only when their evidence conditions pass. The retained low-level manual exercise API validates curated moves with python-chess; saved manual answers define those exercises' acceptance.

Classification supports factual feedback, recurring-weakness evidence and focused practice. Independent games support recurrence; one error does not establish a recurring weakness or reveal what the player was thinking. Classification v4 reuses pinned Lichess motif recognition and retains auditable witnesses, optional native defense checks and explicit abstentions. Coverage and accuracy are separate measurements. The first [assistant assessment](CLASSIFICATION_ASSESSMENT.md) is not an independent human benchmark or proof of improvement over time.

## Removed and archived

The old generated lesson/course domain, Repertoire and manual-position entry forms remain archived. Historical data and domain helpers remain for compatibility and backups. Their legacy product routes return HTTP 410; archived sessions cannot be practiced through review endpoints. The new authored Study lesson framework uses separate versioned content and progress, not those archived tables or endpoints. Historical teaching audits and the low-level manual exercise API remain accessible. Imports and classification never generate courses or enroll cards into lessons.

There is no LLM runtime, SDK, model service or model API-key requirement. The original OpenAI requirement was superseded by the user's September 12, 2026 instruction. Historical model responses are retained locally for audit; their labels are inactive.

## Local operation

Data lives in one SQLite database on the host. PGN analysis and training work offline once dependencies and Stockfish are installed. Shared hosting supports self-service accounts with private games and training history, persistent device sessions, and remembered Chess.com usernames. Recent-game sync contacts the public Chess.com API without starting analysis. Docker packages the app and native Stockfish for Unraid behind an existing reverse proxy and optional Cloudflare Access. LAN clients can also use the original single-user mode. There is no cloud database or telemetry. See [Accounts](ACCOUNTS.md) and [Unraid](UNRAID.md).

See [FEATURE_STATUS.md](FEATURE_STATUS.md) for implemented features, limits and remaining work, and [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for detector scope.
