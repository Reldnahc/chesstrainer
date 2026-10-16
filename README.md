# Fieldwork — local chess practice

A private chess trainer built around decisions in your own games. Import Chess.com or Lichess history by username or upload PGNs, analyze learner moves with native Stockfish, practice meaningful mistakes, and retain them with FSRS. Local rules classify supported tactical patterns from saved engine evidence. Study brings scheduled recall, guided opening lessons and separate puzzle practice together. See [Study](docs/STUDY.md) for content availability and the distinct learning modes.

Start with **Study → Openings** for Italian Game, King’s Gambit and Vienna Gambit
courses for White or Italian Game and Sicilian Dragon courses for Black, or browse
the opening catalogue and choose lines to remember. **Study → Skills** teaches
basic skills and tactical patterns. Administrators can add or edit club courses
in **Settings → Courses**; see [course files](docs/COURSE_FILES.md). Lessons and
line rehearsal save their own progress; only scheduled
**Due** attempts advance FSRS. **Study → Puzzles** practices a bundled, offline
selection of 940 engine-verified CC0 Lichess puzzles by difficulty and theme, with a retry mode
for puzzles you revealed or failed; a larger installed pack is optional.

The shared [animated coach](docs/COACH.md) reacts to your moves and practice, with
account-saved character and motion preferences. Choose from 30 human, animal and
fantasy characters in **Settings → Coach & animations**, each with all 20 expressions.
Existing users keep Walter
until they choose another coach; the choice follows their account across devices.

The shared [audio system](docs/AUDIO.md) adds board sounds and practice feedback.
Move ratings have no sounds. Adjust it in **Settings → Sound** or quickly
mute the current device from a board. The separate development sound studio
(`npm --prefix frontend run dev:audio`, port 5176) previews the nine approved
sounds individually and in context. All 30 coaches have prerecorded voice banks
for supported teaching lines, with automatic lip sync, available automatically or
on request. They ship with the app and need no API key or paid service. The [voice studio](frontend/src/audio/speech/README.md)
compares their complete recordings for the same supported meanings.

Game review now connects supported tactics, immediate positional changes, human
difficulty, clocks, earlier moments and relevant saved weaknesses into factual
move-by-move coaching. Every selectable coach has its own [writing voice](docs/COACH_DIALOGUE.md#character-writing).
Changing characters rephrases the same evidence without rerunning analysis.
The separate [developer intelligence lab](docs/REVIEW_INTELLIGENCE.md#review-intelligence-laboratory) can trace a
sentence back to that evidence and compare the cast; it is not a production page.

Python-chess owns rules; Stockfish owns evaluation; configurable Python policy owns grading. The pinned Lichess tagger recognizes tactical motifs; versioned Fieldwork evidence checks decide which findings support a mistake label. There is no LLM integration or API-key requirement. The application can run locally or be self-hosted for friends with private accounts in one SQLite database.

Install with [Docker](docs/INSTALL.md) or the [Unraid template](docs/INSTALL.md#unraid).
One container includes Stockfish and its database; no source checkout is needed.

Optional [Maia human move evidence](docs/REVIEW_INTELLIGENCE.md#human-move-evidence) uses an isolated local
CPU worker alongside Stockfish. Docker includes the runtime; acquire the pinned
model explicitly with `docker exec fieldwork python -m trainer.human_models.setup`.
Ordinary review never downloads weights, and Stockfish remains the evaluation
authority when the human model is present or absent.

```sh
docker run -d --name fieldwork --restart unless-stopped --init -p 18000:8000 -v fieldwork-data:/data ghcr.io/reldnahc/chesstrainer:latest
docker exec -it fieldwork python -m trainer.accounts create-admin YOUR_USERNAME
```

Open `http://localhost:18000` (or your server's LAN IP) and sign in. The container
always requires sign-in; see [Docker installation](docs/INSTALL.md) for the recommended
hardening options and [shared hosting](docs/INSTALL.md#shared-https-hosting) for HTTPS.
See [account administration](docs/ADMINISTRATION.md) for account recovery.

Run from source, Fieldwork defaults to one local workspace without login, for
development and single-computer use. Everyone who can reach that instance shares its
games and progress. Set `ACCOUNTS_ENABLED=true` for separate accounts.

## Screens

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
- **Games** browses imported games, runs resumable analysis of both colors, and shows Lichess accuracy for each player, move-quality labels, a timeline and an illustrated tactical coach. Accuracy uses saved evaluations with no Elo adjustment or extra engine searches. The board accepts variations at any point, with undo, saved in-session branches and a return to the original game. Coach evidence and variation analysis never count as scheduled recalls. See [Game review](docs/GAME_REVIEW.md) for scoring rules and limits.
  The progress panel closes after baseline analysis. Targeted deeper checks
  continue in the background and update the review as results arrive. Interrupted
  or failed work retains recovery controls.

- **Play** starts a game against the selected coach. The coach's bot plays like a person at a chosen rating, or at the level measured from the learner's own imported games, with Stockfish only vetoing the mistakes that rating never makes; engine levels from 1800 use Stockfish's own limiter. Commentary is always on: each move gets the review's label, evaluation, coach reaction and graph as it is played, and the coach's verdict on the learner's move arrives before the bot answers. The coach never resigns or offers draws. Finished games, including the learner's resignations, are saved to Games and reviewed there. See [Play](docs/PLAY.md).
- **Study → Due** starts scheduled game recall with an unlabeled board. The backend supplies legal moves and grades answers. A failed engine answer previews the opponent's saved counter; Try again restores the board and Show me why opens deeper playback. Success offers factual feedback and optional Show why. Reveal move performs the saved answer. Repeated retries create only one failed recall per session. Existing `/review` bookmarks and exercise/focused-practice links redirect to Due without an extra browser-history entry.
- **Opening recall in Due** shows the selected opening context and asks for a studied move. Overlapping active lines share a card and union their answers. These are repertoire decisions, not engine grades: a different legal move is outside the selected study. Attempts pin their answers; an outdated attempt can finish without changing the current schedule. Pausing a study preserves its history, and dedicated line practice remains separate from FSRS.
- **Study → Puzzles** uses separate multi-move practice sessions. The server saves accepted moves and opponent replies together; reload restores that committed position. A wrong move keeps the same decision available and permanently marks that solve as non-clean. Reveal ends the solve. Themes, solutions and attribution remain hidden until completion. A bundled, hash-pinned CC0 Lichess starter pack of 940 puzzles, each solution verified unique and winning by Stockfish, supplies production content; `PUZZLE_PACK_PATH` adds a larger installed pack and `PUZZLE_STARTER_PACK=false` leaves an honest empty library. Difficulty bands, a theme filter and a Retry mode choose among unseen puzzles without any rating or mastery claim. Test fixtures are injected only into the test application. Puzzle practice never updates FSRS, ordinary recalls or weaknesses.
- **Study → Lessons → Openings** hosts authored lessons with explanations, demonstrations, guided decisions, optional branches, annotated source-game playback and independent rehearsal. Progress belongs to the account and a pinned content revision. Back, branch return and reload preserve chess context; lesson completion records activity rather than mastery. Five opening courses teach a quiet White Italian repertoire, Black’s Italian responses, the King’s Gambit for White, the Sicilian Dragon for Black and the Vienna Gambit for White. Chapter boundaries follow distinct learning goals and the opening's demands, with concrete practice of the resulting plans; the Italian and King’s Gambit courses also include sourced historical examples. Their designated lines enter Due only through explicit enrollment.
- **Study → Lessons → Fundamentals** uses the same lesson player and progress for courses that teach patterns and basic skills rather than an opening. A tactics course teaches forks, pins, skewers, discovered attacks, removing a defender and back-rank checkmate on short, engine-checked positions. A fundamentals course teaches piece values, counting attackers and defenders, looking for checks, captures and threats, opening principles, checkmating a lone king and king and pawn endings. Neither has recall lines. The Study home's Lessons card counts the chapters not yet completed across all lesson courses.
- **Insights** opens on an **Overview** of patterns across saved games: when and how they are won or lost, records and ratings, openings, conversion and escapes, game shapes, accuracy by move and phase, play after a loss, clock pressure and endgames. It is read-only and starts no analysis; see [Insights](docs/INSIGHTS.md). Its **Weaknesses** section, with **Tactical patterns** and **Material & mate** categories, separates material/mate outcomes from tactical patterns, shows supporting decisions and practice cues, and starts focused batches of up to 12 distinct positions. Focused attempts are stored separately and never change FSRS.
- **Import games in Settings** supports multi-game PGNs, explicit learner matching and filtered Chess.com and Lichess username imports. Only new games enter new analysis jobs; cancellation/retry preserves completed work.
  Source selection sits above equally sized form and activity panels. Their
  headings and edges align on desktop; activity entries share one panel with
  separators. At 900px and below, activity stacks below the form. Every new game is
  analyzed automatically; there is no analysis choice ([Automatic game analysis](docs/GAME_ANALYSIS.md)).
- **Settings** contains account and device sign-out controls, password changes, the Chess.com and Lichess connections, game import tools and analysis activity, actions to refresh training labels or deepen unclear positions, and, for administrators, account and course management. Its compact coach grid shows all thirty characters in six columns and five rows on desktop, with fewer columns on smaller screens and no category headings or navigation; the saved selection changes presentation and wording, never chess evidence. Coach and interface motion remain separate account preferences. Host configuration and diagnostic tables stay out of the user interface; operators configure the environment or .env. The header shows navigation without a local/account status badge.

FSRS increases intervals after successful recall. An interval strictly above the configured threshold (100 days by default) permanently retires the position, preserving history. The cold review board hides source, concept, previous moves, scores and answers; feedback and playback become available after an attempt or reveal.

## Authorities and limits

Python-chess owns rules. Stockfish owns evaluations and verified alternatives. Python policy owns grading. Local detectors assign labels only when their evidence conditions pass. The retained low-level manual exercise API validates curated moves with python-chess; saved manual answers define those exercises' acceptance.

Classification supports factual feedback, recurring-weakness evidence and focused practice. Independent games support recurrence; one error does not establish a recurring weakness or reveal what the player was thinking. Classification v4 reuses pinned Lichess motif recognition and retains auditable witnesses, optional native defense checks and explicit abstentions. Coverage and accuracy are separate measurements. Independent human review of accuracy is still outstanding.

## Removed and archived

The old generated lesson/course domain, model teaching, Repertoire and manual-position entry forms were removed, and their tables dropped. Their legacy routes return HTTP 410. Saved lesson attempts and repertoire cards stay as archived review history that cannot be practiced through review endpoints. The authored Study lesson framework uses separate versioned content and progress. The low-level manual exercise API remains. Imports and classification never generate courses or enroll cards into lessons.

There is no LLM runtime, SDK, model service or model API-key requirement. Historical model responses are retained locally for audit; their labels are inactive.

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
| Puzzles | Bundled hash-pinned CC0 Lichess starter pack (940 puzzles weighted toward lower ratings, every solution verified by Stockfish as the unique winning line), optional installed pack, puzzles mined from the learner's own analyzed games (missed mates and wins verified by Stockfish as unique two-plus-move lines, generated after each analysis job and by a capped backfill job, provenance and game-review link after the solve), offline multi-move solving with retry/reveal, unseen-first selection by difficulty band, goal and theme, Retry mode, private progress separate from FSRS | Own-game puzzles cover missed mates and material wins only, with no defensive puzzles, accepted alternatives or difficulty rating yet; Lichess themes and ratings are external labels, not a mastery or transfer measure |
| Play | Games against the selected coach: human-like levels sampled from Maia-3 at a chosen or measured rating with Stockfish as a blunder guardrail, engine levels from 1800, a per-account level fit from imported games, commentary always on (the review's own per-move evidence, spoken before the bot answers), the learner can resign, opening practice against a course's repertoire lines; finished games enter the library and its ordinary review | No clock; the coach never resigns and offers no draws; no games seeded from weakness positions; new game-specific spoken meanings are listed in [Play](docs/PLAY.md) and not yet recorded, so those moments show text or stay silent; bot strength labels are measured conditioning values, not calibrated ratings |
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
authored material are recorded in [Study](docs/STUDY.md#deferred-content-requirements).
These are remaining limits, not newly scheduled implementation work.

## Prerequisites

Python 3.12+, Node.js 22.12+ (Node 24 tested), and a native [Stockfish executable](https://stockfishchess.org/download/) compatible with your CPU. Extract the executable; do not configure its ZIP/directory. On Linux use your distribution's package; macOS users can also use Homebrew. No model service or API key is required.

## Install and run

From the repository root:

```sh
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell instead:
# .venv\Scripts\Activate.ps1
python -m pip install -r requirements.lock
python -m pip install --no-deps -e .
```

If PowerShell script execution is disabled, activation is unnecessary: use `.venv\Scripts\python.exe` and `npm.cmd` instead.

Copy `.env.example` to `.env` and set the native engine path:

```dotenv
STOCKFISH_PATH=C:/tools/stockfish/stockfish-windows-x86-64-avx2.exe
# Linux/macOS example: /usr/local/bin/stockfish
```

Classification runs locally after analysis; the vendored Lichess code makes no network requests. Restart after editing `.env`. Engine, review, sync and classification settings are stored in the database: change them in Settings → Advanced → Server. Browser Settings also contains account preferences and training actions.

```sh
cd frontend
npm ci
npm run build
cd ..
python -m trainer
```

**Settings > Advanced > Source code on GitHub** links to the public repository, which is the source offer for the vendored AGPL code. Push deployed changes there before serving them to other people.

Open **http://127.0.0.1:8000**. Startup applies Alembic migrations, seeds skills and checks Stockfish. Missing Stockfish produces an actionable status. Saved answers and saved-evidence classification remain usable; new analysis and unlisted engine answers require the executable. Data defaults to `data/trainer.sqlite3`.

Explicit migration commands are `alembic upgrade head` and `alembic check`. Run from a source checkout: migrations and frontend assets live beside the Python package; standalone wheel deployment is not supported yet.

## First session

New accounts get a short, one-time welcome: optional Chess.com/Lichess usernames, then import instructions. Without connected usernames, it explains PGN files instead. Existing accounts and local-only installs skip onboarding.

1. Open **Settings → Games & imports** and save your Chess.com or Lichess username; Fieldwork then checks for new games every minute. For older games choose **Import older games**. Defaults fetch up to 100 **new** rapid games from the current and preceding two calendar months. Change time control, range or limit as needed, then click **Import games**. Every imported game is analyzed in the background. No login or API key is needed. Alternatively choose **Import PGN**, identify your username(s), and explicitly assign a side only when it is yours in every game.
2. Watch progress; invalid or ambiguous games are reported separately. Completed work survives interruptions. Retry an older cancelled job separately; a new import only queues new games.
3. Open Study → Due. Meaningful errors become practice; small engine preferences usually do not. Try a move, inspect the saved counter/playback when useful, and continue to the next position.
4. Open **Insights → Weaknesses** to inspect supported recurring patterns and their evidence. Choose a skill for focused practice; those attempts do not change your scheduled recalls. Unclassified mistakes remain available in Study → Due.
5. Use **Settings > Advanced > Classify saved games** to classify existing analyses locally, or **Deepen unclear positions** for optional bounded Stockfish evidence. No model setup is needed.

## Local network

Set `SERVER_HOST` in `.env` to the host's home-network IPv4 address (find it using `ipconfig`) and restart. Connect the phone to the same trusted network; the host may use Ethernet. Open `http://HOST-LAN-IP:8000` on both desktop and phone. Binding a specific address limits the listening interface; `0.0.0.0` instead listens on every IPv4 interface if that is explicitly desired. Production frontend and API share one origin.

On Windows, run this once from an administrator PowerShell in the repository root, substituting your host address:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/allow-lan.ps1 -LocalAddress 192.168.1.12
```

The firewall helper allows TCP 8000 to that address from the local subnet on **Private** networks only. Pass `-Port` if you changed `SERVER_PORT`. Remove the rule with `Remove-NetFirewallRule -Name Fieldwork-LAN-TCP-8000` as administrator. Keep the host awake and backend running. Guest Wi-Fi isolation can prevent phone access. If the host IP changes, update `.env` and rerun the helper; a router DHCP reservation can keep the address stable.

Optionally set LAN_ACCESS_TOKEN and enter it in the browser. The token is kept in session storage. This is a shared private-network gate, not full authentication or encryption. **Do not expose the application directly to the public internet without securing it.** Run one Uvicorn process, never multiple `--workers`.

## Development and tests

Before changing frontend UI, read the [component inventory and reuse rules](docs/UI_COMPONENTS.md).
It identifies existing shared components, records the site-wide consistency audit,
and holds the [owner's standardization decisions](docs/UI_COMPONENTS.md#owner-decision-record).
Promote main-application components before development-tool versions. Reuse or
extend the existing component for a job rather than recreating it on another page.

The Vite proxy targets **127.0.0.1:8000**. Stop an existing backend using the same database before starting a development instance. If .env is configured for a LAN address or another port, override those values in the development backend terminal.

PowerShell, with the virtual environment activated:

```powershell
$env:SERVER_HOST = '127.0.0.1'
$env:SERVER_PORT = '8000'
python -m trainer
```

Linux/macOS equivalent: `SERVER_HOST=127.0.0.1 SERVER_PORT=8000 python -m trainer`. In a second terminal, run `npm run dev` inside frontend and open http://127.0.0.1:5173. Production/LAN use serves the built frontend directly from the backend instead.

For coach artwork and animation development, run `npm run dev:coach` inside
`frontend` and open http://127.0.0.1:5174. This separate development server needs
no backend or account. The expression viewer is absent from the application,
including production/Docker builds. See [Coach development](docs/COACH.md).

To add or finish a character, follow [Create a Fieldwork coach](docs/COACH_CREATION_GUIDE.md).
It connects personality, artwork, idle behavior, dialogue, recorded voices and
lip sync, with Walter and Rivet as the current quality references.

```sh
python -m pytest -q
ruff check backend scripts migrations
ruff format --check backend scripts migrations
cd frontend
npm run build
npx playwright install chromium
npx playwright test
```

Build before running tests that use frontend/dist; do not rebuild it during backend or browser suites. Set STOCKFISH_PATH for native integration tests; missing Stockfish produces explicit skips. Normal tests make no model or live Chess.com requests. Playwright uses an isolated database and both desktop and phone-emulated Chromium projects.

[TESTING.md](docs/TESTING.md) includes isolated migration/schema-drift checks and platform-specific commands.

Developer-only [Lichess benchmark tooling](docs/LOCAL_CLASSIFICATION.md#lichess-positive-theme-benchmark) streams a local puzzle dataset to measure positive-theme agreement with the shared tactical detector. It does not add puzzle training to the app or infer precision from missing tags. Its [results](docs/LOCAL_CLASSIFICATION.md#results) compare the earlier detector, raw upstream recognition and current admission; agreement with related upstream labels is not independent precision.

## Backup and privacy

```sh
python scripts/backup.py export data/backups/practice.zip
python scripts/backup.py restore data/backups/practice.zip --destination data/restored.sqlite3
```

Export uses SQLite's online backup API, including committed WAL state. Restore validates integrity/foreign keys and only writes to a **new** path; it also refuses a path that still has `-wal`/`-shm` sidecar files from an interrupted server, because SQLite would replay them over the restored data. Stop the server, set DATABASE_PATH to the restored file and restart. The archive also holds the club's course files; restore puts them in a `courses` folder beside the new database (or `<name>-courses` when that folder is in use). Settings are included for reference; reapply them manually. The LAN token value is excluded. Backups themselves contain private games.

To reimport a library from scratch, stop the server and run `python scripts/clear_games.py` for a dry run, then `--yes` to back up into `data/backups` (or `--backup-dir`) and delete. It removes games, imports and their jobs, engine and review findings, mistakes, game-based review cards with their history; `--user NAME` limits it to one account. Accounts, preferences, saved provider usernames, Study lesson progress, puzzles and opening studies stay, and shared engine cache rows still used elsewhere are kept.

Games, analysis, classification, explanations, exercises and review history stay on the host. There is no OpenAI SDK, model connection or outbound pedagogy payload. Legacy model audit records are retained locally for historical reference/export. No telemetry, remote fonts or external board assets are used. IBM Plex fonts are bundled locally; their license notices are in [docs/licenses](docs/licenses).

Username imports contact the selected site's public API from the backend, sending the requested username and filters. It downloads completed games and never sends moves, credentials, your database or existing local games to either provider. Archive data may be delayed by provider caching. Repeat imports deduplicate against both previous downloads and PGN uploads. See [game provider imports](docs/GAME_ANALYSIS.md#game-provider-imports) and [Chess.com transport details](docs/GAME_ANALYSIS.md#chesscom-transport).

## Documentation

- **Features:** [Study](docs/STUDY.md), [course files](docs/COURSE_FILES.md) and [course sources](docs/COURSE_SOURCES.md), [spaced repetition](docs/STUDY.md#spaced-repetition), [Play](docs/PLAY.md), [game review](docs/GAME_REVIEW.md), [Insights and weaknesses](docs/INSIGHTS.md)
- **Analysis:** [game imports](docs/GAME_ANALYSIS.md#game-provider-imports), [automatic analysis and the pipeline](docs/GAME_ANALYSIS.md), [local classification](docs/LOCAL_CLASSIFICATION.md), [review intelligence](docs/REVIEW_INTELLIGENCE.md), [human move evidence](docs/REVIEW_INTELLIGENCE.md#human-move-evidence), [Lichess benchmark](docs/LOCAL_CLASSIFICATION.md#lichess-positive-theme-benchmark)
- **Coaches and sound:** [coach creation guide](docs/COACH_CREATION_GUIDE.md), [cast bible](docs/COACH_CAST_BIBLE.md), [animation](docs/COACH.md), [dialogue](docs/COACH_DIALOGUE.md), [character writing](docs/COACH_DIALOGUE.md#character-writing), [audio](docs/AUDIO.md)
- **Running it:** [Docker](docs/INSTALL.md), [Unraid](docs/INSTALL.md#unraid), [accounts](docs/ADMINISTRATION.md), [configuration](docs/ADMINISTRATION.md#configuration)
- **Development:** [architecture](docs/ARCHITECTURE.md), [data model](docs/ARCHITECTURE.md#data-model), [UI components](docs/UI_COMPONENTS.md), [testing](docs/TESTING.md)

Earlier implementation journals and verification records remain in Git history.

## Forking and licensing

Keep authority boundaries explicit, add deterministic fixtures for chess changes, update living documents and use Alembic revisions for schema changes. Never commit .env, private databases/PGNs, binaries or dependency folders. requirements.lock and frontend/package-lock.json pin tested dependencies.

Original Fieldwork source remains GPL-3.0-or-later; see [LICENSE](LICENSE). The vendored Lichess tagger is AGPL-3.0. The combined application includes a local source download and carries the applicable AGPL obligations; see [NOTICE.md](NOTICE.md) and [upstream provenance](backend/trainer/_vendor/lichess_puzzler/README.md). Python-chess is GPL-licensed; Stockfish is GPLv3 and installed separately, not bundled in source. Preserve relevant license notices and source obligations when redistributing GPL components. Other libraries retain their own licenses.

For blinded human/assistant annotation, frozen comparisons and reviewer provenance, see [Local classification evaluation](docs/LOCAL_CLASSIFICATION.md#configuration-and-evaluation). Coverage is measured separately from accuracy.
