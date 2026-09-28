# Game provider imports

Fieldwork imports public completed standard-chess games from Chess.com and Lichess without API keys. In **Settings → Import games**, choose a provider, username, time control, lookback/custom UTC dates, and maximum new games. Fetching alone is the default; training analysis is optional. Existing games do not consume the manual import's new-game limit. PGN uploads remain available.

Save each site's username under **Connected accounts** to fetch its latest 50 completed games from the current and previous calendar month. Games' **Update games** button checks all connected sites. Visible-page checks run at most once per minute per connection; no engine analysis starts during sync. Connections belong to the signed-in account (or the single local workspace), survive restart, and can be disconnected by clearing the username. Existing Chess.com connections migrate automatically.

## Provider boundary

`backend/trainer/game_providers/base.py` defines the request, normalized checkpoint batch, errors and `GameProviderClient` protocol. Providers own HTTP transport, provider-specific filters and normalization. They yield newest-first batches with stable keys and records containing PGN, variant, speed, completion timestamp and player names. The shared `ingest.py` owns learner validation, PGN parsing, deduplication, progress, atomic checkpoints, cancellation and selection limits. Python-chess remains authoritative for PGN legality/history; importing provider data never substitutes remote evaluations for Stockfish.

To add a provider:

1. Implement the client protocol with bounded transport, cancellation and generator cleanup. Emit stable checkpoint keys, never offsets that can shift when new games arrive. Preserve source/ratings/clocks in PGN headers and annotations.
2. Register its ID, label and supported time controls in `PROVIDERS` and its factory in `client_factories()`.
3. Add injected HTTP fixtures covering legal games, invalid responses, resume, limits and ownership. The generic API, saved connections, Settings selector/forms and Update games require no provider-specific UI implementation.

Discovery is `GET /api/game-providers`; imports use `POST /api/imports/provider/{provider}`. Connections use `PUT /api/providers/{provider}/connection` and GET/POST `/api/providers/{provider}/sync`. `provider_import` on job responses carries progress and the provider's display name. The previous Chess.com import/sync endpoints and job response field remain compatibility aliases. The old auth profile username write also updates the new connection; new clients read provider connections rather than the deprecated profile field.

The existing import/checkpoint tables are reused (their physical names remain `chesscom_imports` / `chesscom_archives` to preserve saved jobs). A provider discriminator and account-owned connections table are added in the same database. No second import subsystem or database is introduced.

## Lichess transport

Uses [Lichess's public game export API](https://lichess.org/api#tag/Games/operation/apiGamesUser), streamed as NDJSON with PGN and clocks, excluding ongoing games and remote evaluation annotations. Standard chess only; rapid, blitz, bullet, ultra bullet, classical and correspondence are supported. Export date filters follow Lichess's API date window; imported games must also satisfy the requested completion dates. Long-running correspondence games outside the export window may require a wider range.

A completed game is checkpointed atomically as it is saved. Retry reopens the bounded export and skips saved checkpoint IDs; it never assumes a moving page offset is stable. Streams close when the requested limit is reached, on cancellation, or on error. Saved games survive a failed/cancelled request. A 429 produces a retryable error instructing the user to wait at least a minute; no immediate automated retry is made within the job.

All provider traffic shares one host lock. Lichess limits default to `PROVIDER_TIMEOUT_SECONDS=20` per network read, `PROVIDER_MAX_RESPONSE_BYTES=25000000`, `PROVIDER_MAX_SCAN_GAMES=10000`, one megabyte per record and ten minutes per export. Narrow the date range if a cap is reached. Cancellation during a blocked read completes when that bounded read returns. Chess.com's existing `CHESSCOM_*` transport settings remain unchanged. No new Docker configuration is required.

Automated tests inject provider responses and make no live provider requests. This verifies Fieldwork's transport contract and integration, not the external services' uptime.
