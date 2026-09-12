# Fieldwork — local chess practice

A private chess curriculum engine built around decisions in your own games. Import Chess.com history by username or upload PGNs, analyze learner moves with native Stockfish, practice meaningful mistakes, and retain them with FSRS. Optional OpenAI classification organizes verified evidence into skills and basic courses.

Python-chess owns rules; Stockfish owns evaluation; configurable Python policy owns grading. The LLM interprets supplied evidence and never chooses an accepted move. This is a local application, not a hosted service.

## Implemented

For a requirement-by-requirement comparison with the original product specification, see [Feature status and missing work](docs/FEATURE_STATUS.md). It distinguishes implemented features, partial behavior, unverified integrations and deliberate non-goals, including what works with OpenAI off.

* Single/multi-game PGN import, explicit learner matching, duplicate detection and original provenance. Only newly added games enter new analysis jobs.
* Chess.com username import: completed public games, rapid by default, selectable time control, lookback or exact dates, and game limit; resumable archive downloads and automatic learner matching.
* Persistent background jobs, progress, cancellation/retry and startup recovery. Finished classifications survive cancellation and are reused for matching evidence/model versions.
* Two-pass local Stockfish analysis, MultiPV, explicit mate/centipawn scores and persistent compatible cache.
* Structured OpenAI classification, controlled skills, confidence handling and audits; optional, with no fake production classifier.
* Evidence-based priorities and basic diagnose/teach/drill/retain course units. Single-game evidence is marked exploratory.
* Cold board review with drag/drop, tap-to-move, legal-move dots/capture rings, promotion selection and backend grading.
* FSRS scheduling, one failed recall per session, continued retries and answer reveal.
* Curated repertoire variations, manual FEN exercises, optional LAN token and backup/restore.

The interface has **Review**, **Course**, **Import**, **Weaknesses**, **Repertoire**, and **Settings**. Review hides source, concepts, scores and answers until completion. See [development status](docs/DEVELOPMENT_PLAN.md) for remaining scope.

![Desktop review interface](docs/screenshots/review-desktop.png)

[Mobile review screenshot](docs/screenshots/review-mobile.png)

[Desktop username import](docs/screenshots/import-desktop.png) · [Mobile username import](docs/screenshots/import-mobile.png)

## Prerequisites

Python 3.12+, Node.js 22.12+ (Node 24 tested), and a native [Stockfish executable](https://stockfishchess.org/download/) compatible with your CPU. Extract the executable; do not configure its ZIP/directory. On Linux use your distribution's package; macOS users can also use Homebrew. An OpenAI key is needed only for optional classification.

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
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
LLM_ENABLED=false
```

To enable classification, supply your key and set LLM_ENABLED=true. Restart after editing configuration. Settings displays effective values without exposing secrets.

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

1. Open Import and enter your Chess.com username. Defaults fetch up to 100 rapid games from the current and preceding two calendar months. Change the range, time control or limit as needed, then click **Fetch & analyze games**. No Chess.com login/API key or OpenAI key is needed. Alternatively choose **PGN file** and identify your username(s); explicitly assign a side only when it is yours in every game.
2. Watch progress; invalid/ambiguous games are reported separately. Completed work survives interruptions.
3. Open Review. A meaningful error becomes practice; small preferences usually do not.
4. With OpenAI enabled, inspect Weaknesses/Course and their evidence. After adding a key, use Settings → Retry unclassified evidence.
5. Import curated PGN lines or add a manual position under Repertoire.

## Local network

Set SERVER_HOST=0.0.0.0, restart, and visit `http://HOST-LAN-IP:8000` on the same trusted network. Allow the port on the host's private firewall profile. Production frontend and API share one origin.

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

Set STOCKFISH_PATH for integration tests; missing native Stockfish produces explicit skips. Normal tests never call live OpenAI. Browser tests use a separate database under ignored data/. See [TESTING.md](docs/TESTING.md).

## Backup and privacy

```sh
python scripts/backup.py export backups/practice.zip
python scripts/backup.py restore backups/practice.zip --destination data/restored.sqlite3
```

Export uses SQLite's online backup API, including committed WAL state. Restore validates integrity/foreign keys and only writes to a **new** path. Stop the server, set DATABASE_PATH to the restored file and restart. Safe settings are included for reference; reapply them manually. API keys and LAN token values are excluded. Backups themselves contain private games.

Games, analysis, exercises, courses and review history stay on the host. When enabled, OpenAI receives meaningful mistake evidence: candidates/scores, verified lines, deterministic facts, opaque IDs and taxonomy. Original PGNs and player headers are omitted. Calls use store=False; provider data handling still applies. No telemetry, remote fonts or external board assets are used.

Username import contacts Chess.com's public API from the backend, sending the requested username/archive paths and configured User-Agent. It downloads completed games and never sends moves, credentials, your database or existing local games to Chess.com. Archive data may be delayed by provider caching. Repeat imports deduplicate against both previous downloads and PGN uploads. See [Chess.com import details](docs/CHESSCOM_IMPORT.md).

## Documentation

[Product](docs/PRODUCT.md) · [Architecture](docs/ARCHITECTURE.md) · [Analysis](docs/ANALYSIS_PIPELINE.md) · [Curriculum](docs/CURRICULUM_ENGINE.md) · [Data model](docs/DATA_MODEL.md) · [SRS](docs/SRS.md) · [Configuration](docs/CONFIGURATION.md) · [Testing](docs/TESTING.md) · [Plan](docs/DEVELOPMENT_PLAN.md) · [Decisions](docs/DECISIONS.md)

## Forking and licensing

Keep authority boundaries explicit, add deterministic fixtures for chess changes, update living documents and use Alembic revisions for schema changes. Never commit .env, private databases/PGNs, binaries or dependency folders. requirements.lock and frontend/package-lock.json pin tested dependencies.

Project source is GPL-3.0-or-later; see [LICENSE](LICENSE). Python-chess is GPL-licensed; Stockfish is GPLv3 and installed separately, not bundled in source. Preserve relevant license notices and source obligations when redistributing GPL components. Other libraries retain their own licenses.
