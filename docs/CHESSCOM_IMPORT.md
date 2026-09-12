# Chess.com username import

Open **Import → Chess.com username** and enter a player username. Defaults: rapid, last 3 calendar months (including the current UTC month), latest 100 unsaved matching games. Select blitz/bullet/daily/all, a longer range or all available history, and a maximum of 1–1000 new games. Rated and unrated completed standard-chess games are included. Chess variants and ongoing games are excluded. No Chess.com login, API key, subscription integration or OpenAI access is required.

## Provider and authority

Use the [official read-only Published Data API](https://www.chess.com/news/view/published-data-api):

* `GET https://api.chess.com/pub/player/{username}/games/archives`
* `GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}`

The backend reads monthly JSON for its PGNs, completion times, rules and time-class metadata. Archives are searched newest first, and games are sorted by end time within each month. The supplied username is matched in provider player metadata and independently in parsed PGN headers. No side is silently inferred when those headers are ambiguous. Python-chess, Stockfish, policy and FSRS retain their existing authorities; provider accuracy scores are unused.

Chess.com may serve cached data; newly completed games need not appear immediately. The feature retrieves public completed history; it does not provide real-time synchronization or gameplay.

## Local API and persistence

`POST /api/imports/chesscom` accepts:

```json
{"username":"your_username","time_class":"rapid","months":3,"max_games":100,"start_date":null,"end_date":null}
```

It returns HTTP 202 with a queued job ID. Identical active requests reuse the same job; submitting after completion refreshes provider data and deduplicates saved games. `months=0` selects all available history. `max_games` now counts newly inserted games: duplicates and invalid PGNs do not consume it. The scan continues within the chosen range until that many new games are found or matching archives are exhausted. This can backfill older games never saved locally; use From date if you want only recently played games.

Optional **From date / To date** fields accept ISO dates, for example `start_date="2026-01-10"` and `end_date="2026-02-15"`. Setting either date overrides `months`; leaving one blank creates an open-ended range. Both endpoints include the entire day, based on the game's completion timestamp in UTC (not its start date). The backend prunes unrelated monthly archives, then filters individual games within the remaining archives. Reversed dates are rejected before queuing. Mode and maximum-game limits still apply. Clear both dates to restore the rolling lookback window.

The normal job worker downloads first, then analyzes only games introduced by this import. `/api/jobs` includes a `chesscom` progress object: archives checked/available, fetched/imported/duplicate/filtered/rejected counts, fetch-completed flag and up to 50 diagnostic examples. Analysis counters start after downloading. `games_fetched` counts PGNs examined by the importer, including duplicates/rejections; it can exceed the new-game limit. Filtering counts cover checked archive entries, not an account-wide total.

`chesscom_imports` stores query/progress fields relationally, keyed to `analysis_jobs`. `chesscom_archives` stores completed archive URLs/checkpoints. Original matching monthly PGNs accumulate in the linked `game_imports` row (the raw batch can include entries beyond the new-game limit). Processed games retain fingerprints/provenance links; `import_games.is_new` separates newly inserted games from duplicate provenance. Each archive import and its checkpoint commit atomically. On failure, cancellation or restart, saved games remain; retry skips completed archives. Once fetching finishes, an engine retry requires no provider requests. Start a fresh import to refresh a previously checked month after new games appear.

Chess.com supplies monthly archives, so a fresh import still downloads archive data containing old games. It does not rerun Stockfish or classify those duplicate games. There is no per-game delta endpoint or conditional archive HTTP cache in this implementation. A duplicate-only import is a completed no-op and does not rebuild the course. New PGN-file imports follow the same new-game analysis policy; a duplicate-only PGN upload creates no analysis job. To finish older cancelled/failed work, retry its original job separately.

## Classification cancellation and reuse

Each completed classification commits immediately. Cancel takes effect between decisions; an in-flight API request may finish and be saved first. **Retry saved work** or **Settings → Retry unclassified evidence** reuses successful cached responses, including low-confidence/unclassified results, when evidence, model, prompt/schema and taxonomy versions match. It sends requests for missing or failed results. Changing these inputs intentionally invalidates the cache. A hard process/network failure after the provider responds but before SQLite commits can require repeating that one request; cross-system exactly-once delivery is not guaranteed. Retry progress may recount saved positions locally, without repeating their engine/model work.

PGN uploads and provider imports share one mutation lock to prevent concurrent duplicate insertion. All Chess.com traffic is serial within the one application process, even with multiple engine workers. The feature does not add external workers or an account system.

## Failure behavior

Bounded 20-second request timeouts, up to three attempts on transport errors / 429 / selected 5xx responses, and cancellable backoff. Respect Retry-After; waits greater than 10 seconds end with an actionable retry-later message instead of retrying early. There is no infinite retry loop. 404/410, 403, redirects, malformed JSON and oversized responses have explicit messages. Usernames and archive URL paths are validated; arbitrary provider URLs/redirects are never followed.

No matching archives/games produces a completed import with zero games and an explanatory UI message. An engine failure preserves fetched PGNs for retry. Bad or mismatched PGNs are reported individually. Existing parsed decisions and engine caches prevent repeated analysis of already saved games.

## Privacy and configuration

Only the requested username, archive paths and configured User-Agent go to Chess.com, from the host. No browser credentials or OpenAI secret are transmitted. The browser remembers the last successfully queued username in local storage. Games and learning data remain local, subject to separately enabled OpenAI classification.

`CHESSCOM_TIMEOUT_SECONDS=20`, `CHESSCOM_MAX_RESPONSE_BYTES=25000000` (decompressed bytes per HTTP response), and `CHESSCOM_USER_AGENT` are centralized host settings. Default User-Agent identifies Fieldwork; users may append contact information. Runtime HTTPX is explicitly declared and pinned in the existing dependency lock.

## Verification

Deterministic MockTransport tests cover filters, both learner sides, username/URL validation, latest-game limits, cross-source duplicates, checkpoint resume/cancellation, provider errors/rate limits and a real Stockfish worker-to-review flow without OpenAI. Browser tests inject this provider boundary in a test-only app while using the actual application API, SQLite, production frontend and native engine. Normal automated tests never call Chess.com.

A separate live read-only smoke check used the provider's documented `erik` example: archive index succeeded, the October 2009 archive returned 42 games with PGNs/time classes, and python-chess parsed a game. No live example games were inserted into the application database.
