# Configuration

Settings in backend/trainer/config.py is the validated Pydantic boundary. Environment variables override root .env; defaults apply last. Relative paths resolve from the server working directory. Run from the repository root. Invalid recognized values fail startup with field-specific errors.

Host configuration is changed in the environment, followed by a backend restart.
Settings in the browser edits account preferences, including Chess.com and Lichess usernames,
coach and motion; it is not a container configuration editor. Existing exercise
policies and engine evidence keep their saved configuration. The optional LAN
token is a SecretStr excluded from public serialization; only its configured
status is returned.

## Active settings

| Variable | Default / bounds where useful |
|---|---|
| SERVER_HOST / SERVER_PORT | 127.0.0.1 / 8000 |
| DATABASE_PATH | data/trainer.sqlite3 |
| STOCKFISH_PATH | stockfish |
| STOCKFISH_THREADS / STOCKFISH_HASH_MB / STOCKFISH_WORKERS | 1 / 64 MB / 1; workers 1..4 |
| SYNC_INTERVAL_SECONDS | 20; seconds between server polling rounds (change checks, then syncs for changed connections), 0 disables polling |
| HUMAN_MODEL_ENABLED | true; inference only when explicitly installed/cached |
| HUMAN_MODEL_PATH | data/models/maia3-79m.pt; /data/models/maia3-79m.pt in Docker |
| HUMAN_MODEL_DEVICE | cpu; optional administrator-provided cuda runtime |
| HUMAN_MODEL_THREADS / HUMAN_MODEL_WORKERS | 2 / 1; bounds 1..16 / 1..4, host-wide |
| HUMAN_MODEL_TIMEOUT | 30 seconds (1..120), slot wait plus native request |
| TRIAGE_DEPTH / TRIAGE_TIME / TRIAGE_NODES | 10 / 0.15 seconds / unset |
| DEEP_DEPTH / DEEP_TIME / DEEP_NODES | 16 / 0.8 seconds / unset |
| MULTIPV | 4 |
| TARGET_RATING | 1500 (400..3000) |
| ACCEPTANCE_MODE | practical; also best_only, engine_tolerance, custom |
| TOLERANCE_CP / PRACTICAL_TOLERANCE_CP | 50 / 100 |
| MISTAKE_THRESHOLD_CP | 150 |
| SLOW_ANSWER_SECONDS / DESIRED_RETENTION | 30 / 0.9 |
| RETIRE_AFTER_DAYS | 100 (1..36500) |
| MIN_INDEPENDENT_GAMES | 2 (2..20) |
| CLASSIFICATION_WORKERS | 2 (1..4) |
| CLASSIFICATION_MAX_PLIES | 16 (4..32) |
| CLASSIFICATION_EXTENSION_PLIES | 16 (0..32) |
| CLASSIFICATION_TACTIC_PLIES | 8 (2..16) |
| CLASSIFICATION_MIN_LOSS_CP | 150 (50..1000) |
| CLASSIFICATION_MIN_MATERIAL | 1 (1..9 material points) |
| CLASSIFICATION_PROBE_POSITIONS | 40 (1..500 per optional job) |
| CLASSIFICATION_PROBE_DEPTH / CLASSIFICATION_PROBE_TIME | 22 / 2 seconds (depth 1..40, time greater than 0 and at most 10) |
| CLASSIFICATION_PROBE_QUERIES | 6 (2..12) |
| LAN_ACCESS_TOKEN | empty, optional shared bearer token |
| ALLOWED_HOSTS | empty; extra host names the local-mode API answers to. IP addresses, localhost, single-label names and `.local`/`.lan`/`.home`/`.home.arpa`/`.internal` names are always accepted |
| MAX_IMPORT_BYTES | 10000000 |
| CHESSCOM_TIMEOUT_SECONDS | 20 seconds per provider request |
| CHESSCOM_MAX_RESPONSE_BYTES | 25000000 decompressed bytes per response |
| PUZZLE_STARTER_PACK | true; serves the bundled CC0 Lichess starter pack |
| PUZZLE_PACK_PATH | unset; directory holding a Lichess-layout puzzles CSV and its hash-pinned manifest, verified at startup |
| PROVIDER_TIMEOUT_SECONDS | 20 seconds per Lichess network read |
| PROVIDER_MAX_RESPONSE_BYTES | 25000000 decompressed bytes per Lichess export |
| PROVIDER_MAX_SCAN_GAMES | 10000 records per Lichess export; narrow date range when reached |
| CHESSCOM_USER_AGENT | FieldworkChessTrainer/0.1 (local personal chess training) |

See [.env.example](../.env.example) for a copyable starting point.

## Engine and grading

Search stops at the first reached depth/time/node bound. STOCKFISH_WORKERS controls parallel games within one import; each owns a native process. STOCKFISH_THREADS and hash memory apply per process. Interactive grading has a separate engine in addition to background workers. Four workers with one thread permit four simultaneous background searches plus interactive grading; concurrency does not change per-position limits.

Full-game reviews use STOCKFISH_WORKERS for parallel moves within the selected
game, and then for parallel refinement questions, capped by ENGINE_SLOTS. Results are saved in move order so comparisons with
the preceding move remain correct. Account mode additionally enforces the shared
host-wide engine pool. The default of one worker remains serial; hosts with spare
CPU capacity can increase it to 2–4 without lowering the review's search limits.

Missing Stockfish produces an actionable status without preventing UI startup. New analysis and unlisted engine answers need the executable. Existing stored answers and saved-evidence classification remain usable.

For unlisted answers, the saved analysis limits/resources and binary identity are required. An incompatible executable produces an unavailable response without a recall failure. Rebuilding old exercises under a new engine is a future operation.

Policy and target-rating effects are documented in [ANALYSIS_PIPELINE.md](ANALYSIS_PIPELINE.md) and [CURRICULUM_ENGINE.md](CURRICULUM_ENGINE.md). The custom mode currently uses TOLERANCE_CP; it is not a plug-in policy editor.

## Local classification

Human move evidence is separate from rule classification and Stockfish. See
[HUMAN_MODELS.md](HUMAN_MODELS.md) for explicit setup, resource measurements,
offline use, cache identity and conservative interpretation of rating domains.

CLASSIFICATION_WORKERS limits local rule tasks; it starts no model requests or additional engines. Each bounded pool admits at most twice its worker count. Worker count alone does not invalidate results.

MAX_PLIES is the initial saved-line horizon. If the endpoint is unfinished, EXTENSION_PLIES permits bounded forward reading to a quiet endpoint; zero disables extension. TACTIC_PLIES separately bounds connected tactical events attributable to the initial move, and a quiet unrelated gap ends the episode early. Full saved lines are checked for legality. These settings inspect existing evidence without launching Stockfish. MIN_LOSS_CP and MIN_MATERIAL gate material findings; mate transitions remain explicit.

Settings can explicitly queue deeper evidence for at most PROBE_POSITIONS decisions. PROBE_QUERIES counts all searches per selected decision, including two refreshed root comparisons. Remaining searches extend unresolved tails and test specific legal defenses. Each uses PROBE_DEPTH/TIME, MultiPV 1 and STOCKFISH_WORKERS; deep node limits do not apply.

The task list, classifier parameters, engine binary and search limits participate in persisted job/cache identity. Completed native work is reused. Changing that configuration during a planned job requires a new job. Enrichment never rewrites original exercise answers or schedules.

No model key is read. Old OPENAI_* and LLM_* values are ignored, unused and never serialized. Local classification is available even without Stockfish when compatible saved evidence exists.

## Scheduling and imports

A saved FSRS interval strictly greater than RETIRE_AFTER_DAYS permanently retires an exercise. Startup reconciles existing qualifying states. Changing the threshold never reactivates retired cards. SLOW_ANSWER_SECONDS affects automatic Hard versus Good; raw timing remains stored independently. See [SRS.md](SRS.md).

Chess.com username, time class, calendar-month lookback or explicit dates, and new-game limit are selected per import and saved in SQLite. Defaults are rapid / 3 months / 100 new games. Date bounds include whole UTC completion days and override lookback. Duplicates and rejected games do not consume the new-game limit; repeated imports can backfill older unsaved games in the selected range. Retry old cancelled jobs separately.

Chess.com import requires internet access on the host and no account credentials. User-Agent may include contact details; never put secrets there. See [CHESSCOM_IMPORT.md](CHESSCOM_IMPORT.md).

## Local and LAN operation

Use one backend process. For LAN access, bind SERVER_HOST to the host's home-network IPv4 address and optionally configure LAN_ACCESS_TOKEN. Open http://HOST-LAN-IP:SERVER_PORT from the same trusted network. Binding 0.0.0.0 instead listens on every IPv4 interface. The token is a shared access gate and does not add transport encryption; do not expose the app directly to the public internet.

In local mode the API answers only requests whose Host is an IP address, `localhost`, a single-label name such as `nas`, or a `.local`, `.lan`, `.home`, `.home.arpa` or `.internal` name. List any other name in ALLOWED_HOSTS (comma-separated). This stops a public web page from reaching the server through DNS rebinding, which does not need port forwarding. Account mode is protected by the exact PUBLIC_ORIGIN instead.

On Windows, run scripts/allow-lan.ps1 with -LocalAddress in administrator PowerShell. It permits TCP 8000 at that address from LocalSubnet on Private networks only; pass -Port for another port. It does not change network profiles or router forwarding. Keep the host awake, avoid isolated Wi-Fi, and update binding/firewall if DHCP changes the address.

The Vite development proxy specifically targets 127.0.0.1:8000. Override SERVER_HOST and SERVER_PORT in the development backend terminal as shown in [README.md](../README.md#development-and-tests); a backend bound only to its LAN address will not answer that proxy.

## Archived settings

`COURSE_MAX_UNITS`, `LESSON_MAX_POSITIONS` and `LESSON_CHECK_PASS_FRACTION`
have been removed along with unused course generation and lesson progression.
Old `.env` entries are ignored; they can be deleted. No active Docker/Unraid setting
changes. Historical data, migrations and teaching audits remain available; see
[archived compatibility](CURRICULUM_ENGINE.md#archived-compatibility). These settings
do not configure the separate authored Study lessons.

## Shared hosting

`/api/health` and `/api/settings` distinguish an unchecked engine from a working
or unavailable one through `engine_status`. Availability is `null` until checked,
then `true` or `false` according to the latest actual engine operation. Health
requests do not start Stockfish or spend analysis CPU. Account mode checks on first
use; local mode checks at startup. A successful retry clears a previous failure.
The UI refreshes health on page navigation and allows retries even after a failure.
Administrator logs contain exception chains; shared health responses do not contain
raw exception details. There are no additional container variables for this.

- Accounts require both `ACCOUNTS_ENABLED=true` and a nonblank `PUBLIC_ORIGIN`.
  Docker defaults the flag to true; blank origin still selects the shared local workspace.
- `PUBLIC_ORIGIN` is the exact public HTTPS origin used for authenticated writes.
- `SESSION_SECURE=true` protects account cookies; disable only for local HTTP development.
- `FORWARDED_ALLOW_IPS` (read by Uvicorn; default `127.0.0.1`) lists the proxy addresses
  whose `X-Forwarded-For` header is trusted. Set it to your reverse proxy's address so
  sign-in rate limits apply per browser instead of to everyone behind the proxy.
- `ENGINE_SLOTS=4` caps native engine processes and concurrent analysis jobs across
  all accounts in shared mode. One additional coordinator handles fetch-only jobs.
  Each account runs at most one analysis job at a time. Idle accounts allocate no
  app instance or workers; the host worker count stays fixed as accounts grow.
- `DATABASE_PATH` still names one SQLite file containing accounts and all chess data.

See [ACCOUNTS.md](ACCOUNTS.md) before enabling accounts for existing data and
[UNRAID.md](UNRAID.md) for container storage, permissions and proxy configuration.

## Full-game review refinement

Optional extra investigation follows the unchanged deep baseline. Defaults are
`REVIEW_REFINEMENT_POSITIONS=8`, `REVIEW_REFINEMENT_QUERIES=4`,
`REVIEW_REFINEMENT_DEPTH=22`, `REVIEW_REFINEMENT_TIME=2`, and
`REVIEW_REFINEMENT_MULTIPV=4`. Set positions to zero to disable extra work.
See [REVIEW_REFINEMENT.md](REVIEW_REFINEMENT.md) for bounds, time/depth floors,
CPU budgets, cancellation, resume and measured quality examples. All five
settings have descriptions in the advanced Unraid template.
