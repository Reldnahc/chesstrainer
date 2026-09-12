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
| OPENAI_API_KEY | empty, backend only |
| OPENAI_MODEL | gpt-4.1-mini |
| LLM_ENABLED | false |
| LLM_WORKERS | 2 (range 1–16) |
| TARGET_RATING | 1500 |
| ACCEPTANCE_MODE | practical |
| TOLERANCE_CP / PRACTICAL_TOLERANCE_CP | 50 / 100 |
| MISTAKE_THRESHOLD_CP | 150 |
| SLOW_ANSWER_SECONDS / DESIRED_RETENTION | 30 / 0.9 |
| MIN_INDEPENDENT_GAMES / CLASSIFICATION_CONFIDENCE | 2 / 0.7 |
| LAN_ACCESS_TOKEN | empty, optional shared bearer token |
| MAX_IMPORT_BYTES | 10000000 |
| CHESSCOM_TIMEOUT_SECONDS | 20 seconds per provider request |
| CHESSCOM_MAX_RESPONSE_BYTES | 25000000 decompressed bytes per response |
| CHESSCOM_USER_AGENT | FieldworkChessTrainer/0.1 (local personal chess training) |

Search stops at the first reached depth/time/node bound. Resource limits apply to each engine; interactive grading has a separate engine in addition to workers. Worker count is 1–4. No remote engine, GPU or cloud database is configured.

STOCKFISH_WORKERS now controls parallel game analysis **within one import**, not simultaneous whole jobs. Each worker has its own Stockfish process; STOCKFISH_THREADS is CPU threads per process. For example, 4 workers × 1 thread allows up to four simultaneous background searches, plus the separate interactive engine. Hash memory is per process. Workers preserve per-position search limits; concurrency is not deeper analysis.

LLM_WORKERS independently limits simultaneous classification tasks/requests. The queue holds at most twice that number including active tasks, preventing unbounded pending API work. Provider rate limits still apply; the SDK retains its existing bounded timeout/retry behavior. Raising concurrency changes the spending rate, not which evidence is selected; retries can still affect total cost. Cache keys exclude worker counts, so changing concurrency does not invalidate saved classifications or engine results. Settings and import activity show effective limits and running work.

Settings UI is read-only: edit .env and restart. Existing exercise grading policies and cached analyses retain their original configuration. Do not silently compare scores across incompatible engine settings.

No key/disabled LLM is a supported mode: classification reports unavailable while engines and practice work. Missing engine status gives the configured path and corrective action without preventing UI startup. Unverifiable moves must not become failed recall.

For GPT-5.6 Terra, set `OPENAI_MODEL=gpt-5.6-terra` and `LLM_ENABLED=true`, then restart. `OPENAI_API_KEY` may be inherited from the host's Windows environment; it need not be copied into `.env`. Environment variables override `.env` values. A configured/enabled status confirms that the adapter initialized, not that a paid API request succeeded. Completed imports are not automatically reclassified on restart: use **Settings → Retry unclassified evidence** to process saved mistakes. New analysis jobs classify meaningful evidence when enabled.

Chess.com import needs an internet connection on the host, with no Chess.com credentials. Username, time-class, calendar-month lookback or explicit From/To dates, and latest-game limit are selected per import in the UI and persisted in SQLite. Defaults are rapid / 3 months / 100 games. Dates override lookback and include whole UTC completion days; either endpoint may be left blank. User-Agent may include contact details; no secrets belong there. See CHESSCOM_IMPORT.md for provider retry/cache behavior.

The import limit counts **new valid games**, excluding duplicates and rejected PGNs. Repeated imports can backfill previously unsaved older games within the selected range; set From date to restrict that history. New imports do not retry old cancelled jobs automatically.

Set SERVER_HOST=0.0.0.0 for trusted LAN and optionally LAN_ACCESS_TOKEN for a shared access gate. One process owns jobs/review serialization. Do not expose directly to public internet; token access alone does not add transport encryption.

For unlisted engine answers, saved analysis limits/resources are reused. If the executable identity differs, grading reports unavailable and asks for the original Stockfish path; existing stored answers remain usable. Rebuilding old exercises under a new engine is a future operation.
