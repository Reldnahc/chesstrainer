# Fieldwork — local chess practice

A private chess trainer built around decisions in your own games. Import Chess.com or Lichess history by username or upload PGNs, analyze learner moves with native Stockfish, practice meaningful mistakes, and retain them with FSRS. Local rules classify supported tactical patterns from saved engine evidence. Study brings scheduled recall, guided opening lessons and separate puzzle practice together. See [Study](docs/STUDY.md) for content availability and the distinct learning modes.

Start with **Study → Openings** for Italian Game, King’s Gambit and Vienna Gambit
courses for White or Italian Game and Sicilian Dragon courses for Black, or browse
the opening catalogue and choose lines to remember. **Study → Skills** teaches
basic skills and tactical patterns. Administrators can add or edit club courses
in **Settings → Courses**; see [course files](docs/COURSE_FILES.md). Lessons and
line rehearsal save their own progress; only scheduled
**Due** attempts advance FSRS. **Study → Puzzles** practices a bundled, offline
selection of 972 engine-verified CC0 Lichess puzzles by difficulty and theme, with a retry mode
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

## Implemented

See [Feature status](docs/PRODUCT.md#feature-status) for the comparison with the original specification and the limits of each feature.

- Multi-game PGN import, explicit learner matching, duplicate detection and original provenance. Only newly added games enter new analysis jobs.
- Chess.com and Lichess username imports with time-class filters, lookback or exact dates, and a new-game limit. Downloads resume from saved checkpoints.
- Persistent jobs, progress, cancellation/retry and startup recovery. Bounded Stockfish and local classification pools reuse compatible completed work.
- Two-pass native analysis, MultiPV, separate mate/centipawn scores and a durable cache. Practical grading accepts verified sound alternatives.
- Local classification v4 reuses the pinned Lichess tactical tagger and separates material/mate outcomes from specific patterns, with auditable witnesses and explicit abstentions. Settings can deepen a capped batch of unclear positions without changing original exercise answers.
- Evidence-linked weakness groups and focused practice of up to 12 distinct positions. Focused attempts are saved separately from FSRS.
- Cold review with drag/drop, tap-to-move, legal-move dots/capture rings and promotion selection. Failures preview a verified counter; Show me why opens deeper playback. Reveal move plays the saved answer.
- SRS and game review render through one workspace: identical board sizing, compact headers, responsive sidebar, animations, move badges and illustrated coach. Cold SRS positions still hide all answers and tactical hints.
- Pages and the site header use the available width on laptops and smaller screens (up to 1440 CSS pixels), and a centered 80% container on larger desktops. Reviews narrow the sidebar first and expand the container only when needed to preserve the board's size. The header keeps all navigation labels visible, reduces the branding to its icon on smaller desktops, and becomes a full-width sticky navigation bar on phones.
- Compact game history shows player ratings/colors, results, accuracy, time control, move count and date. Browsing uses saved data without running analysis; each row opens its review.
- Full-game review in **Games**: saved analysis and Lichess accuracy for both players, nine move labels including **Book**, an evaluation timeline, an illustrated tactical coach, and playable branching variations. A bundled Lichess opening catalogue recognizes book moves locally, including named unsound lines, in saved games and branches. Accuracy appears beside players and in the move-quality breakdown; it uses every saved evaluation with no Elo adjustment or additional engine searches. Pause/resume preserves completed analysis; game review never changes scheduled practice. See [Game review](docs/GAME_REVIEW.md) for scoring and evidence limits.
- FSRS scheduling, one failed recall per session, continued retries and permanent retirement above a configurable interval threshold (100 days by default).
- Same-origin LAN operation, optional shared access token, or accounts with private data (administrators add members; sign-ups are closed unless opened) and persistent device sessions. CLI backup/restore covers the single database and the club's course files.
- Remembered Chess.com and Lichess usernames with automatic polling for new games. Every saved game is analyzed in the background, newest first; opening a game moves its review to the front.

Navigation is **Home, Study, Play, Games, Insights, Settings**. **Home** brings together scheduled recalls, recent games, saved lessons and supported practice priorities without starting analysis or a practice session. **Study → Due** contains scheduled recalls; old Review bookmarks remain usable. The initial cold game-recall board hides source, concepts, scores and answers; feedback and playback become available after an attempt or reveal. Games provides open analysis and coaching for the complete game. **Play** starts a game against your selected coach. **Insights** summarizes your rated games and ranks supported weaknesses; Chess.com games saved before the rated flag existed count as rated until a re-import (see [Insights](docs/INSIGHTS.md)). Study also hosts multi-move puzzle practice from a bundled CC0 Lichess starter pack, chosen by difficulty band and theme with a separate retry mode. Puzzle practice has its own saved progress and never changes FSRS or weaknesses. The historical course/Repertoire system and manual-position entry forms remain archived; see [Product](docs/PRODUCT.md#removed-and-archived).

Pages and individual games have their own URLs, with browser Back/Forward,
bookmarks and new-tab links. Refreshing a game review preserves the selected
move; stepping through moves does not add browser-history entries.

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

To reimport a library from scratch, stop the server and run `python scripts/clear_games.py` for a dry run, then `--yes` to back up into `data/backups` (or `--backup-dir`) and delete. It removes games, imports and their jobs, engine and review findings, mistakes, game-based review cards with their history and the archived game-built course; `--user NAME` limits it to one account. Accounts, preferences, saved provider usernames, Study lesson progress, puzzles and opening studies stay, and shared engine cache rows still used elsewhere are kept.

Games, analysis, classification, explanations, exercises and review history stay on the host. There is no OpenAI SDK, model connection or outbound pedagogy payload. Legacy model audit records are retained locally for historical reference/export. No telemetry, remote fonts or external board assets are used. IBM Plex fonts are bundled locally; their license notices are in [docs/licenses](docs/licenses).

Username imports contact the selected site's public API from the backend, sending the requested username and filters. It downloads completed games and never sends moves, credentials, your database or existing local games to either provider. Archive data may be delayed by provider caching. Repeat imports deduplicate against both previous downloads and PGN uploads. See [game provider imports](docs/GAME_ANALYSIS.md#game-provider-imports) and [Chess.com transport details](docs/GAME_ANALYSIS.md#chesscom-transport).

## Documentation

- **Product:** [product and feature status](docs/PRODUCT.md)
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
