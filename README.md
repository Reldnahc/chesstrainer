# Fieldwork — local chess practice

A private chess trainer built around decisions in your own games. Import Chess.com history by username or upload PGNs, analyze learner moves with native Stockfish, practice meaningful mistakes, and retain them with FSRS. Local rules classify supported tactical patterns from saved engine evidence. Review is the primary product; lessons have been removed from the interface, with historical data preserved.

Python-chess owns rules; Stockfish owns evaluation; configurable Python policy owns grading. Versioned Python detectors assign labels only when their evidence conditions pass. There is no LLM integration or API-key requirement. This is a local application, not a hosted service.

## Implemented

For a requirement-by-requirement comparison with the original product specification, see [Feature status and missing work](docs/FEATURE_STATUS.md). It distinguishes implemented features, partial behavior, unverified integrations and deliberate non-goals, including local classification coverage and its limits.

* Single/multi-game PGN import, explicit learner matching, duplicate detection and original provenance. Only newly added games enter new analysis jobs.
* Chess.com username import: completed public games, rapid by default, selectable time control, lookback or exact dates, and game limit; resumable archive downloads and automatic learner matching.
* Persistent background jobs, progress, cancellation/retry and startup recovery. Finished classifications survive cancellation and are reused for matching evidence/rule versions.
* Independent bounded Stockfish and local classification pools process multiple games/positions within one import; configure `STOCKFISH_WORKERS` and `CLASSIFICATION_WORKERS`.
* Two-pass local Stockfish analysis, MultiPV, explicit mate/centipawn scores and persistent compatible cache.
* Local mate-transition, material-consequence, hanging-capture, fork, discovered/double-check and promotion detectors with auditable witness moves. Ambiguous cases remain unclassified.
* Evidence-linked weakness groups; single-game evidence is marked exploratory. Lesson progression is archived pending a future redesign.
* Classification rejection, versioned caches and historical audit preservation. New imports/backfills cannot create lessons. Previously lesson-held positions are available in Review.
* Cold board review with drag/drop, tap-to-move, legal-move dots/capture rings, promotion selection and backend grading.
* Show me why and Show why: annotated playback of the submitted move and saved engine replies, short factual explanations, and return-to-attempt without extra SRS events.
* FSRS scheduling, one failed recall per session, continued retries and answer reveal. Positions retire permanently once their scheduled interval exceeds 100 days (configurable), with history preserved.
* Optional LAN token and backup/restore. Repertoire training and manual-position entry have been removed from the interface.


* Local rules v3.1 separate material/mate outcomes from specific patterns. Adaptive continuations, connected combinations, move causes and bounded native defense tests provide auditable witnesses. Weaknesses shows coverage and every supporting example.
* Focused practice from a weakness uses up to 12 distinct positions and saves attempts separately, without changing your FSRS schedule. Show why highlights verified tactical witnesses on the board.
* Settings can deepen a capped batch of unclear positions using local Stockfish. Completed probes are reused; original exercise answers stay intact.

The interface has **Review**, **Weaknesses**, **Import**, and **Settings**, in that order. Review hides source, concepts, scores and answers until completion. See [development status](docs/DEVELOPMENT_PLAN.md) for remaining scope.

![Desktop review interface](docs/screenshots/review-desktop.png)

[Mobile review](docs/screenshots/review-mobile.png) / [Mobile settings](docs/screenshots/settings-mobile.png)

[Desktop username import](docs/screenshots/import-desktop.png) · [Mobile username import](docs/screenshots/import-mobile.png)

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
CLASSIFICATION_WORKERS=2
```

Classification runs locally after analysis. Restart after editing configuration. Settings displays effective values without exposing the optional LAN token.

```sh
cd frontend
npm ci
npm run build
cd ..
python -m trainer
```

Open **http://127.0.0.1:8000**. Startup applies Alembic migrations, seeds skills and checks Stockfish. Missing Stockfish produces an actionable status; curated practice still works. Data defaults to `data/trainer.sqlite3`.

Explicit migration commands are `alembic upgrade head` and `alembic check`. Run from a source checkout: migrations and frontend assets live beside the Python package; standalone wheel deployment is not supported yet.

## First session

1. Open Import and enter your Chess.com username. Defaults fetch up to 100 rapid games from the current and preceding two calendar months. Change the range, time control or limit as needed, then click **Fetch & analyze games**. No login or API key is needed. Alternatively choose **PGN file** and identify your username(s); explicitly assign a side only when it is yours in every game.
2. Watch progress; invalid/ambiguous games are reported separately. Completed work survives interruptions.
3. Open Review. A meaningful error becomes practice; small preferences usually do not.
4. Open Weaknesses to inspect supported recurring patterns. Use **Settings > Classify saved games** to backfill existing analyses locally. Some mistakes remain unclassified; they still work in Review.
5. Import curated PGN lines or add a manual position under Repertoire.

## Local network

Set `SERVER_HOST` in `.env` to the host's home-network IPv4 address (find it using `ipconfig`) and restart. Connect the phone to the same trusted network; the host may use Ethernet. Open `http://HOST-LAN-IP:8000` on both desktop and phone. Binding a specific address limits the listening interface; `0.0.0.0` instead listens on every IPv4 interface if that is explicitly desired. Production frontend and API share one origin.

On Windows, run this once from an administrator PowerShell in the repository root, substituting your host address:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/allow-lan.ps1 -LocalAddress 192.168.1.12
```

The firewall helper allows TCP 8000 to that address from the local subnet on **Private** networks only. Pass `-Port` if you changed `SERVER_PORT`. Remove the rule with `Remove-NetFirewallRule -Name Fieldwork-LAN-TCP-8000` as administrator. Keep the host awake and backend running. Guest Wi-Fi isolation can prevent phone access. If the host IP changes, update `.env` and rerun the helper; a router DHCP reservation can keep the address stable.

Optionally set LAN_ACCESS_TOKEN and enter it in the browser. The token is kept in session storage. This is a shared private-network gate, not full authentication or encryption. **Do not expose the application directly to the public internet without securing it.** Run one Uvicorn process, never multiple `--workers`.

## Development and tests

Run `python -m trainer` at the root and `npm run dev` inside frontend in a second terminal. Vite proxies /api from port 5173 to 8000.

```sh
python -m pytest -q
ruff check backend scripts
ruff format --check backend scripts migrations
cd frontend
npm run build
npx playwright install chromium
npx playwright test
```

Set STOCKFISH_PATH for integration tests; missing native Stockfish produces explicit skips. No application path calls an LLM. Tests include conservative detector fixtures and local classification through native Stockfish. Browser tests use a separate database under ignored data/. See [TESTING.md](docs/TESTING.md).

## Backup and privacy

```sh
python scripts/backup.py export backups/practice.zip
python scripts/backup.py restore backups/practice.zip --destination data/restored.sqlite3
```

Export uses SQLite's online backup API, including committed WAL state. Restore validates integrity/foreign keys and only writes to a **new** path. Stop the server, set DATABASE_PATH to the restored file and restart. Safe settings are included for reference; reapply them manually. API keys and LAN token values are excluded. Backups themselves contain private games.

Games, analysis, classification, explanations, exercises and review history stay on the host. There is no OpenAI SDK, model connection or outbound pedagogy payload. Legacy model audit records are retained locally for historical reference/export. No telemetry, remote fonts or external board assets are used. IBM Plex fonts are bundled locally; their license notices are in [docs/licenses](docs/licenses).

Username import contacts Chess.com's public API from the backend, sending the requested username/archive paths and configured User-Agent. It downloads completed games and never sends moves, credentials, your database or existing local games to Chess.com. Archive data may be delayed by provider caching. Repeat imports deduplicate against both previous downloads and PGN uploads. See [Chess.com import details](docs/CHESSCOM_IMPORT.md).

## Documentation

[Local classification](docs/LOCAL_CLASSIFICATION.md) ? [Assessment results](docs/CLASSIFICATION_ASSESSMENT.md) / [Product](docs/PRODUCT.md) · [Architecture](docs/ARCHITECTURE.md) · [Analysis](docs/ANALYSIS_PIPELINE.md) · [Curriculum](docs/CURRICULUM_ENGINE.md) · [Data model](docs/DATA_MODEL.md) · [SRS](docs/SRS.md) · [Configuration](docs/CONFIGURATION.md) · [Testing](docs/TESTING.md) · [Plan](docs/DEVELOPMENT_PLAN.md) · [Decisions](docs/DECISIONS.md)

## Forking and licensing

Keep authority boundaries explicit, add deterministic fixtures for chess changes, update living documents and use Alembic revisions for schema changes. Never commit .env, private databases/PGNs, binaries or dependency folders. requirements.lock and frontend/package-lock.json pin tested dependencies.

Project source is GPL-3.0-or-later; see [LICENSE](LICENSE). Python-chess is GPL-licensed; Stockfish is GPLv3 and installed separately, not bundled in source. Preserve relevant license notices and source obligations when redistributing GPL components. Other libraries retain their own licenses.

For blinded human/assistant annotation, frozen comparisons and reviewer provenance, see [Local classification evaluation](docs/LOCAL_CLASSIFICATION.md#configuration-and-evaluation). Coverage is measured separately from accuracy.
