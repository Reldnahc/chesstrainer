# Configuration

Settings in backend/trainer/config.py is the validated Pydantic boundary. Environment overrides root .env; defaults apply last. Relative paths resolve from the server working directory. Run from repository root. Invalid recognized values fail startup with field-specific errors. Secrets are SecretStr values excluded from public serialization.

| Variable | Default |
|---|---|
| SERVER_HOST / SERVER_PORT | 127.0.0.1 / 8000 |
| DATABASE_PATH | data/trainer.sqlite3 |
| STOCKFISH_PATH | stockfish |
| STOCKFISH_THREADS / STOCKFISH_HASH_MB / STOCKFISH_WORKERS | 1 / 64 / 1 |
| TRIAGE_DEPTH / TRIAGE_TIME / TRIAGE_NODES | 10 / 0.15 / unset |
| DEEP_DEPTH / DEEP_TIME / DEEP_NODES | 16 / 0.8 / unset |
| MULTIPV | 4 |
| TARGET_RATING | 1500 |
| ACCEPTANCE_MODE | practical |
| TOLERANCE_CP / PRACTICAL_TOLERANCE_CP | 50 / 100 |
| MISTAKE_THRESHOLD_CP | 150 |
| SLOW_ANSWER_SECONDS / DESIRED_RETENTION | 30 / 0.9 |
| MIN_INDEPENDENT_GAMES | 2 |
| CLASSIFICATION_WORKERS | 2 (1..4) |
| CLASSIFICATION_MAX_PLIES | 16 (4..32) |
| CLASSIFICATION_MIN_LOSS_CP | 150 (50..1000) |
| CLASSIFICATION_MIN_MATERIAL | 1 (1..9 material points) |
| CLASSIFICATION_PROBE_POSITIONS | 40 (1..500 per optional job) |
| CLASSIFICATION_PROBE_DEPTH / CLASSIFICATION_PROBE_TIME | 22 / 2.0 seconds (time capped at 10) |
| LAN_ACCESS_TOKEN | empty, optional shared bearer token |
| MAX_IMPORT_BYTES | 10000000 |
| CHESSCOM_TIMEOUT_SECONDS | 20 seconds per provider request |
| CHESSCOM_MAX_RESPONSE_BYTES | 25000000 decompressed bytes per response |
| CHESSCOM_USER_AGENT | FieldworkChessTrainer/0.1 (local personal chess training) |

Search stops at the first reached depth/time/node bound. Resource limits apply to each engine; interactive grading has a separate engine in addition to workers. Worker count is 1–4. No remote engine, GPU or cloud database is configured.

STOCKFISH_WORKERS now controls parallel game analysis **within one import**, not simultaneous whole jobs. Each worker has its own Stockfish process; STOCKFISH_THREADS is CPU threads per process. For example, 4 workers × 1 thread allows up to four simultaneous background searches, plus the separate interactive engine. Hash memory is per process. Workers preserve per-position search limits; concurrency is not deeper analysis.

CLASSIFICATION_WORKERS limits concurrent local rule tasks; it does not start model requests or additional engines. The bounded queue holds at most twice the worker count. Rule limits are versioned with evidence in cache keys. Changing worker count alone does not invalidate results. MAX_PLIES limits material/tactical witness inspection; full saved lines are checked for legality. MIN_LOSS_CP and MIN_MATERIAL gate material motifs, while mate transitions remain explicit.

Settings UI is read-only: edit .env and restart. Existing exercise grading policies and cached analyses retain their original configuration. Do not silently compare scores across incompatible engine settings.

Local classification is always available, including with no Stockfish executable when saved analyses exist. Missing engine status gives the configured path and corrective action without preventing UI startup. Unverifiable moves must not become failed recall. Old OPENAI_* and LLM_* environment values are ignored and never serialized or used; the application no longer reads a model API key.


Chess.com import needs an internet connection on the host, with no Chess.com credentials. Username, time-class, calendar-month lookback or explicit From/To dates, and latest-game limit are selected per import in the UI and persisted in SQLite. Defaults are rapid / 3 months / 100 games. Dates override lookback and include whole UTC completion days; either endpoint may be left blank. User-Agent may include contact details; no secrets belong there. See CHESSCOM_IMPORT.md for provider retry/cache behavior.

The import limit counts **new valid games**, excluding duplicates and rejected PGNs. Repeated imports can backfill previously unsaved older games within the selected range; set From date to restrict that history. New imports do not retry old cancelled jobs automatically.

Set SERVER_HOST to the host's home-network IPv4 address for trusted LAN and optionally LAN_ACCESS_TOKEN for a shared access gate. One process owns jobs/review serialization. Do not expose directly to public internet; token access alone does not add transport encryption.

For unlisted engine answers, saved analysis limits/resources are reused. If the executable identity differs, grading reports unavailable and asks for the original Stockfish path; existing stored answers remain usable. Rebuilding old exercises under a new engine is a future operation.

## Archived lesson policy

COURSE_MAX_UNITS defaults to 6 (1..12), plus an optional mixed unit. LESSON_MAX_POSITIONS defaults to 8 (2..20) as the candidate selection budget. Stages use up to 2 diagnostic, 3 teaching, 5 drill and 3 check examples. LESSON_CHECK_PASS_FRACTION defaults to 0.8 (greater than zero, at most 1), rounded up to a whole number of clean answers. These are pedagogical heuristics; changing the selection budget affects new sequences, while changing the pass fraction affects the next check completion. Existing sequences and SRS history are preserved.


## Windows phone access

For a single home-network interface, set `SERVER_HOST` to its LAN IPv4 address, restart, and use `http://<host LAN IPv4>:<SERVER_PORT>` on desktop and phone. Run `scripts/allow-lan.ps1 -LocalAddress <host LAN IPv4>` in administrator PowerShell to allow TCP 8000 to that address on Private networks from LocalSubnet only. Pass `-Port` for a different port. The helper does not change network profiles or router port forwarding. Keep the host awake and use non-isolated Wi-Fi. If DHCP changes the address, update the binding and firewall rule.

`RETIRE_AFTER_DAYS=100` controls automatic permanent review retirement. A saved FSRS interval strictly greater than this positive integer (1..36500) retires the exercise. Existing qualifying cards are reconciled on startup. Changing the value never reactivates already-retired cards. Settings displays the effective threshold.


The mobile Settings screen is read-only; engine, grading, classification and storage details expand on demand. Legacy course/lesson configuration fields remain for archived domain compatibility and do not enable lessons in the application.

Optional deeper classification jobs perform two root searches per selected position using CLASSIFICATION_PROBE_DEPTH/TIME, MultiPV 1 and STOCKFISH_WORKERS. They do not inherit deep node limits. Each job persists its capped selection, resumes cached work, and skips identical completed probes on later jobs. Enrichment is explicitly started in Settings and never changes saved exercise grading references or FSRS.
