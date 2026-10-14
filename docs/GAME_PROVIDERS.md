# Game provider imports

Fieldwork imports public completed standard-chess games from Chess.com and Lichess without API keys. In **Settings → Games & imports**, choose **Import older games** on a provider card to set the username, time control, lookback/custom UTC dates, and maximum new games. The form follows the remembered username until you edit it; a one-time import never changes the connection. Imported games are always analyzed in the background, after games the poller found ([Automatic game analysis](GAME_ANALYSIS.md)). Existing games do not consume the manual import's new-game limit. **Import PGN** accepts a file or pasted text, with the active input shown explicitly.

Save each site's username on its connection card. Every `SYNC_INTERVAL_SECONDS` (default 60) the server asks each site what changed, then imports the 10 newest completed games for changed connections, whether or not the app is open, and queues analysis for each new game. Accounts away for 7 days are skipped until they return (see [Automatic game analysis](GAME_ANALYSIS.md#polling)). Games' **Update games** button requests an immediate check of all connected sites, at most once per minute per connection. Syncing itself never starts Stockfish. Connections belong to the signed-in account (or the single local workspace), survive restart, and can be disconnected by clearing the username.

## Provider boundary

`backend/trainer/game_providers/base.py` defines the request, normalized checkpoint batch, errors and `GameProviderClient` protocol. Providers own HTTP transport, provider-specific filters and normalization. They yield newest-first batches with stable keys and records containing PGN, variant, speed, completion timestamp, player names and, when the site says, whether the game was rated. The rated flag is saved on the game (a later import of an already saved game fills it in) and keeps unrated games out of [Insights](INSIGHTS.md). The shared `ingest.py` owns learner validation, PGN parsing, deduplication, progress, atomic checkpoints, cancellation and selection limits. Python-chess remains authoritative for PGN legality/history; importing provider data never substitutes remote evaluations for Stockfish.

To add a provider:

1. Implement the client protocol with bounded transport, cancellation and generator cleanup. Emit stable checkpoint keys, never offsets that can shift when new games arrive. Preserve source/ratings/clocks in PGN headers and annotations.
2. Register its ID, label and supported time controls in `PROVIDERS` and its factory in `client_factories()`.
3. Add injected HTTP fixtures covering legal games, invalid responses, resume, limits and ownership. The generic API, saved connections, Settings selector/forms and Update games require no provider-specific UI implementation.

Discovery is `GET /api/game-providers`; imports use `POST /api/imports/provider/{provider}`. Connections use `PUT /api/providers/{provider}/connection` and GET/POST `/api/providers/{provider}/sync`. `provider_import` on job responses carries progress and the provider's display name. The Chess.com-specific import/sync endpoints and job response field are compatibility aliases. The deprecated auth profile username write also updates the connection; clients read provider connections rather than that profile field.

All providers share the import/checkpoint tables (physically named `chesscom_imports` / `chesscom_archives` to preserve saved jobs), with a provider discriminator and an account-owned connections table in the same database. There is no second import subsystem or database.

## Lichess transport

Uses [Lichess's public game export API](https://lichess.org/api#tag/Games/operation/apiGamesUser), streamed as NDJSON with PGN and clocks, excluding ongoing games and remote evaluation annotations. Standard chess only; rapid, blitz, bullet, ultra bullet, classical and correspondence are supported. Export date filters follow Lichess's API date window; imported games must also satisfy the requested completion dates. Long-running correspondence games outside the export window may require a wider range.

A completed game is checkpointed atomically as it is saved. Retry reopens the bounded export and skips saved checkpoint IDs; it never assumes a moving page offset is stable. Streams close when the requested limit is reached, on cancellation, or on error. Saved games survive a failed/cancelled request. A 429 produces a retryable error instructing the user to wait at least a minute; a shared one-minute cooldown also prevents later queued jobs from immediately contacting Lichess again.

All provider traffic shares one host lock. Lichess limits default to `PROVIDER_TIMEOUT_SECONDS=20` per network read, `PROVIDER_MAX_RESPONSE_BYTES=25000000`, `PROVIDER_MAX_SCAN_GAMES=10000`, one megabyte per record and ten minutes per export. Narrow the date range if a cap is reached. Cancellation during a blocked read completes when that bounded read returns. Chess.com uses its own `CHESSCOM_*` transport settings.

Automated tests inject provider responses and make no live provider requests. This verifies Fieldwork's transport contract and integration, not the external services' uptime.

## New-account welcome

New hosted accounts see a two-step welcome before entering the application: optional
provider usernames, then either provider-fetch guidance or PGN instructions when no
username was supplied. It saves connections through the ordinary provider API and
does not start import or engine jobs during onboarding. Open imports goes directly
to the appropriate Settings form; Finish for now retains the original destination.

`users.onboarding_completed` is false for new accounts and marked true only after
successful completion. The authenticated, CSRF-protected completion endpoint is
idempotent and changes only the current account. Existing users are grandfathered
as complete during migration. Local-only installations have no onboarding gate.
Reloading an unfinished flow restores saved usernames; completed users bypass it
on every device. Connections remain editable later in Settings.

## Chess.com transport

Open **Settings → Games & imports**, choose **Import older games** on the Chess.com card and enter a player username. Defaults: rapid, last 3 calendar months (including the current UTC month), latest 100 unsaved matching games. Select blitz/bullet/daily/all, a longer range or all available history, and a maximum of 1–1000 new games. Rated and unrated completed standard-chess games are included; each game keeps Chess.com's `rated` flag, and re-importing a saved game fills that flag in, since games imported before it existed have none. Unrated games stay out of [Insights](INSIGHTS.md). Chess variants and ongoing games are excluded. No Chess.com login, API key or subscription integration is required.

### Provider and authority

Use the [official read-only Published Data API](https://www.chess.com/news/view/published-data-api):

* `GET https://api.chess.com/pub/player/{username}/games/archives`
* `GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}`

The backend reads monthly JSON for its PGNs, completion times, rules and time-class metadata. Archives are searched newest first, and games are sorted by end time within each month. The supplied username is matched in provider player metadata and independently in parsed PGN headers. No side is silently inferred when those headers are ambiguous. Python-chess, Stockfish, policy and FSRS retain their existing authorities; provider accuracy scores are unused.

Chess.com may serve cached data; newly completed games need not appear immediately. The feature retrieves public completed history; it does not provide real-time synchronization or gameplay.

### Local API and persistence

`POST /api/imports/chesscom` accepts:

```json
{"username":"your_username","time_class":"rapid","months":3,"max_games":100,"start_date":null,"end_date":null}
```

It returns HTTP 202 with a queued job ID. Identical active requests reuse the same job; submitting after completion refreshes provider data and deduplicates saved games. `months=0` selects all available history. `max_games` counts newly inserted games: duplicates and invalid PGNs do not consume it. The scan continues within the chosen range until that many new games are found or matching archives are exhausted. This can backfill older games never saved locally; use From date if you want only recently played games.

Optional **From date / To date** fields accept ISO dates, for example `start_date="2026-01-10"` and `end_date="2026-02-15"`. Setting either date overrides `months`; leaving one blank creates an open-ended range. Both endpoints include the entire day, based on the game's completion timestamp in UTC (not its start date). The backend prunes unrelated monthly archives, then filters individual games within the remaining archives. Reversed dates are rejected before queuing. Mode and maximum-game limits still apply. Clear both dates to restore the rolling lookback window.

The normal job worker downloads first, then queues a background review for each game introduced by this import ([Automatic game analysis](GAME_ANALYSIS.md)). `/api/jobs` includes a `chesscom` progress object: archives checked/available, fetched/imported/duplicate/filtered/rejected counts, fetch-completed flag and up to 50 diagnostic examples. Each new game's review then runs as its own `game_review` job. `games_fetched` counts PGNs examined by the importer, including duplicates/rejections; it can exceed the new-game limit. Filtering counts cover checked archive entries, not an account-wide total.

`chesscom_imports` stores query/progress fields relationally, keyed to `analysis_jobs`. `chesscom_archives` stores completed archive URLs/checkpoints. Original matching monthly PGNs accumulate in the linked `game_imports` row (the raw batch can include entries beyond the new-game limit). Processed games retain fingerprints/provenance links; `import_games.is_new` separates newly inserted games from duplicate provenance. Each archive import and its checkpoint commit atomically. On failure, cancellation or restart, saved games remain; retry skips completed archives. Once fetching finishes, an engine retry requires no provider requests. Start a fresh import to refresh a previously checked month after new games appear.

Chess.com supplies monthly archives, so a fresh import still downloads archive data containing old games. It does not rerun Stockfish or classify those duplicate games. There is no per-game delta endpoint, and manual imports use no conditional archive HTTP cache (only the poller's change check sends an `ETag`). A duplicate-only import completes without new analysis work. New PGN-file imports follow the same new-game analysis policy; a duplicate-only PGN upload creates no analysis job. To finish older cancelled/failed work, retry its original job separately.

### Classification cancellation and reuse

Each completed local classification commits independently. Cancel stops new tasks and allows already-started engine/rule work to save. Retry the job from Import to finish its original scope, or use **Settings > Classify saved games** to scan saved meaningful decisions.

Classified and abstained responses are reused when saved evidence, rule version, parameters and taxonomy match. Missing or failed classifications are computed locally; an identical rejected result is not automatically revived. Worker-count changes do not invalidate results. A hard process failure before a transaction commits can require recomputing that unfinished unit. Retry progress may recount saved positions without repeating compatible engine/rule work.

Classification-only jobs launch no background engines and never call a model. Optional **Deepen unclear positions** is a separate, capped native Stockfish job with persisted tasks and cached searches; see [analysis pipeline](GAME_ANALYSIS.md#optional-evidence-enrichment).

PGN uploads and provider imports share one mutation lock to prevent concurrent duplicate insertion. All Chess.com traffic is serial within the one application process, even with multiple engine workers. No external workers are involved.

### Failure behavior

Bounded 20-second request timeouts, up to three attempts on transport errors / 429 / selected 5xx responses, and cancellable backoff. Respect Retry-After; waits greater than 10 seconds end with an actionable retry-later message instead of retrying early. There is no infinite retry loop. 404/410, 403, redirects, malformed JSON and oversized responses have explicit messages. Usernames and archive URL paths are validated; arbitrary provider URLs/redirects are never followed.

No matching archives/games produces a completed import with zero games and an explanatory UI message. An engine failure preserves fetched PGNs for retry. Bad or mismatched PGNs are reported individually. Existing parsed decisions and engine caches prevent repeated analysis of already saved games.

### Privacy and configuration

Only the requested username, archive paths and configured User-Agent go to Chess.com, from the host. No credentials, existing local games or database contents are transmitted. The import form starts from the Chess.com connection's saved username. Games, classification and learning data remain local.

`CHESSCOM_TIMEOUT_SECONDS=20`, `CHESSCOM_MAX_RESPONSE_BYTES=25000000` (decompressed bytes per HTTP response), and `CHESSCOM_USER_AGENT` are centralized host settings. Default User-Agent identifies Fieldwork; users may append contact information. Runtime HTTPX is explicitly declared and pinned in the dependency lock.

### Verification

Deterministic MockTransport tests cover filters, both learner sides, username/URL validation, latest-game limits, cross-source duplicates, checkpoint resume/cancellation, provider errors/rate limits and a real Stockfish worker-to-review flow. Browser tests inject this provider boundary in a test-only app while using the actual application API, SQLite, production frontend and native engine. Normal automated tests never call Chess.com.
