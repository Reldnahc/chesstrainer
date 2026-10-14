# Game imports and analysis

Every saved game is analyzed without the learner asking. There is no
"also analyze" choice on imports.

## One job per game

Each game has one `game_review` job (linked by `game_reviews.job_id`). It runs
the full-game review (baseline, refinement and human evidence; see
[GAME_REVIEW.md](GAME_REVIEW.md)) and then the training pass for the learner's
moves (see [Analysis pipeline](#analysis-pipeline)). Insights reads the review;
Weaknesses and practice read the training decisions. A training failure marks
the job failed, and retrying it reuses the cached review searches.

`trainer.game_analysis.queue_imported` runs after every sync, provider import and
PGN upload. Games a poller sync brought in get the fresh level; games from a
manual provider import or PGN upload, and any other saved game without a job, get
the backfill level. Queuing never lowers a queued job's level and never restarts a
completed, failed or cancelled job.

## Priority

`analysis_jobs.priority` orders the queue; lower runs sooner.

| Level | Value | Source |
| --- | --- | --- |
| Requested | 0 | The learner opened the game, which starts or resumes its review; also every non-game job. |
| Fresh | 10 | Found by the poller. |
| Backfill | 20 | **Import older games**, a PGN upload, or a saved game that never had a job. |

Within a level, the most recently played game runs first. One analysis job runs
per account at a time, so a requested game waits at most for the job already
running.

## Polling

The job runner's `sync-poller` thread runs a round every `SYNC_INTERVAL_SECONDS`
(default 60, measured from round start; 0 disables). A round longer than the
interval is followed by the next immediately, so rounds never overlap. A round first asks each provider which saved
connections changed, then queues a sync only for those. A sync reads the
`SYNC_GAMES` (10) newest completed games of all time controls, regardless of month, and imports the
ones not yet saved.

| Provider | Change check | Why it is safe every minute |
| --- | --- | --- |
| Chess.com | `GET` of each player's current-month archive with the saved `ETag` (`If-None-Match`); unchanged answers 304. 404 means no games this month. | Chess.com has no multi-player endpoint, but [serial access is unlimited](https://www.chess.com/news/view/published-data-api); only parallel requests can see 429. Archives carry `max-age=5`. |
| Lichess | One `POST /api/users` per `SYNC_LICHESS_BATCH` (300) players; per-speed game counts plus total play time form the signature. | Lichess asks for [one request at a time](https://lichess.org/page/api-tips) and a minute's pause after 429; a round is a single request for most hosts. |

All provider traffic, including change checks and syncs, is serial under the
runner's host-wide provider lock. A 429 starts that provider's one-minute
cooldown, during which rounds skip it. Markers live in
`provider_connections.poll_state`. Pages do not trigger provider requests on
their own; **Update games** still asks for an immediate sync, at most once per
minute per connection.

## Away accounts

Every authenticated request records `users.last_seen_at` (written at most every
10 minutes per account). Rounds skip accounts not seen for `SYNC_AWAY_DAYS` (7) days. The first
request after such a gap stores the previous visit in `users.away_since`; the app
shows a welcome-back notice (`GET /api/welcome-back`) saying checks resumed and
that missing older games can be brought in with **Import older games**. Dismissing
it (`POST /api/welcome-back/dismiss`) clears `away_since`. Polling resumes on the
next round; games played while away beyond the 10 newest need a manual import.

## Status

`GET /api/analysis/queue` reports the running game and how many requested, fresh
and backfill games are waiting, plus completed and failed totals. Settings shows
it under the connected accounts. `GET /api/jobs` leaves per-game jobs out so
imports stay visible.

## Analysis pipeline

[Provider imports](#game-provider-imports) and PGN uploads pass original PGNs to the importer below. Each newly saved game then gets its own review job, as described above.

### Import
Python-chess parses each UTF-8 PGN. Original uploads remain in game_imports; games retain normalized mainlines and learner color; import_games preserves repeated-upload provenance. Names must match exactly one player (case-insensitively), or the importer explicitly assigns the whole batch's side. Ambiguous/invalid games are reported and skipped without discarding subsequent valid games. Only standard chess is supported.

Fingerprints include selected identifying headers, initial FEN, mainline UCI moves and learner color. Comments do not create duplicates; separately dated/site-stamped games remain independent. This is practical deduplication, not universal cross-provider identity.

Imports retain all processed provenance links but queue only newly inserted games (`import_games.is_new`). Re-uploading saved games therefore does not revisit their Stockfish/local-classification pipeline. A duplicate-only PGN upload creates no job; a duplicate-only Chess.com fetch completes with zero analysis games. Retry the original job to finish interrupted older analysis/classification. Classification retries scan saved decisions and reuse compatible completed local rule results; progress can recount saved decisions without rerunning compatible local classification.

### Training analysis: two passes
For each learner decision, search the pre-move board normally and again with root_moves restricted to the actual move. Both scores use the learner's perspective at the same root. The actual-move score means the evaluation conditioned on playing that move, not a raw White-perspective child score.

Triage defaults: depth 10 OR 0.15 seconds, whichever comes first. Optional nodes add another bound. Mate transitions or loss >=70% of the mistake threshold trigger depth 16 OR 0.8 seconds with MultiPV 4 plus a restricted actual-move search. Only confirmed policy failures become meaningful mistakes. Time-limited engine scores remain estimates.

Every decision commits before classification. FEN, game/ply reconstruction, played SAN/UCI, engine result IDs, explicit losses and deterministic facts remain available. Candidates retain scores, reached depth and PV; each PV is legally replayed before saving. Facts distinguish geometric attacks from tactical proof: an attacked undefended piece is not automatically labeled hanging. Material values are 1/3/3/5/9. Phase is a simple documented heuristic.

### Full-game review intelligence

Game review has its own baseline: every move receives depth 16 / 0.8 s
Stockfish work with two candidates and a restricted played-move search. It does
not use the training triage pass above. The same per-game job then saves the
learner's training decisions from the review's own baseline searches, so its
decisions, practice exercises and Weaknesses evidence exist once the review
finishes ([Automatic game analysis](GAME_ANALYSIS.md)). Those decisions are marked
deep and run no triage. The only extra search is a restricted played-move search
when the played move was the review's second candidate, at the review's limits.
A training-only job for an unreviewed game (`POST /api/games/{game_id}/train`, which has no button in the app) still triages as above.
The review's progress counters describe only the review. Bounded [refinement](REVIEW_INTELLIGENCE.md#targeted-review-investigation) adds investigation to selected
positions without replacing or reducing that baseline.

An explicitly cached [human model](REVIEW_INTELLIGENCE.md#human-move-evidence) contributes policy facts in a
separate worker/cache. Practical difficulty, supported tactical/positional events,
clocks, game relationships and existing owned weakness evidence are
versioned derivations. They do not blend model values with Stockfish scores.
The client turns those facts into neutral dialogue claims before the selected
coach phrases them. [Review intelligence](REVIEW_INTELLIGENCE.md) links the
contracts; changing coach requires no analysis or saved-fact rewrite.

### Scores and policy
Score stores kind cp/mate, signed value and mate_given for positive terminal mate-zero. Values are root-decision-maker relative. CP loss is max(0,best-played). Mate is never flattened to an arbitrary CP number: losing a winning mate and newly allowing losing mate are separate flags. Winning mate lengths can be interchangeable; already forced-lost positions do not generate artificial mate-length exercises.

Policies snapshot version, mode and tolerances into exercises. best_only requires primary; engine_tolerance/custom use TOLERANCE_CP; practical uses PRACTICAL_TOLERANCE_CP. Default practical tolerance is 100 cp; significant failure is 150 cp. Between thresholds is inaccuracy, currently mapped to failed recall. Target rating affects weakness prioritization, not engine evaluation or these acceptance thresholds.

MultiPV supplies stored primary and accepted alternatives. Unlisted legal moves require local verification before judgment; engine unavailability returns 503 without recording failure. Saved manual answers use curated membership and bypass Stockfish; repertoire exercises are archived and unavailable for review.

### Identity/cache/lifecycle
Training keys preserve placement, turn, castling rights and legal en passant, ignoring clocks. Engine keys additionally include full FEN clocks, root board, full UCI history, engine identity, binary SHA256, threads/hash, depth/time/nodes, MultiPV, root restrictions and adapter version. Draw/repetition context is never discarded.

Each configured worker owns a serialized local native engine. A separate serialized engine handles interactive unknown answers. Defaults are one thread and 64 MB per engine; peak resources include workers plus interactive engine. Compatible cached results persist across restart. Crashes close the engine and fail the job while preserving completed decisions; retry starts a fresh process.

SQLite jobs persist queued/running/completed/failed/cancelled states and game/decision/deep/mistake/classification counters. One coordinator processes jobs in queue order, using STOCKFISH_WORKERS parallel game tasks within each analysis job and CLASSIFICATION_WORKERS parallel classification tasks. Startup returns running jobs to queued; replay skips committed decisions and reuses engine/rule caches. Atomic counters are recomputed as saved decisions are revisited. A game completes after its analysis and submitted classifications settle. Cancellation stops queued/new tasks and drains in-flight work before recording final status. One server process is required.

Local classification runs after meaningful engine evidence commits. It replays saved best/actual candidates and emits only supported motifs with witness moves/squares. Completed classified and unclassified runs are cached by evidence, rules, parameters and taxonomy. Failures are retryable; rejected identical runs are not automatically revived. See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md).

The local classification stage has a separate bounded queue so rule processing overlaps with engine work, including multiple decisions from one game. A full queue applies backpressure. No SQLAlchemy session is shared across threads, and rule computation runs outside the short application write lock. Classification-only jobs read saved decisions directly and launch no background Stockfish processes. Identical simultaneous engine cache requests share a fixed-size striped lock registry, avoiding redundant UCI searches without unbounded lock memory.

On-demand answers reuse the exercise analysis limits/resources and require the same binary hash/version. Incompatible executables cannot silently mix scores or create recall failures. Engine adapter cache version is 2.

Imports and classification backfills do not refresh courses. Backfills neither create exercises nor change enrollment/SRS. Legacy courses are archived and their product routes return 410. New game imports create ordinary review exercises from meaningful engine decisions.

### Review explanations

Each new legal review attempt is linked by ReviewSession.last_attempt_id. The explanation endpoint chooses the ExerciseAnswer candidate whose UCI matches that attempt; accepted alternatives use their own PV. Unknown legal game answers already receive compatible root-move analysis during grading. Explanation playback itself performs no extra engine search or model call. Every frame is replayed by python-chess from the source game decision, preserving its history; cached analysis must match the position. Captures (including en passant), castling, promotion, check and checkmate captions are deterministic. Material-change summaries describe the shown continuation, not a guarantee that every reply is forced. Mate claims use explicit learner-perspective Stockfish mate scores. Quiet positions may have no simple verified tactical explanation; show the continuation with that limitation. Manual-exercise mismatches identify saved-answer membership without claiming objective inferiority.

### Optional evidence enrichment

The v4 classifier's outcome checks inspect an initial 16 plies and extend forward by at most 16 saved plies when unfinished. They accept meaningful relative pawn/exchange outcomes. The selected endpoint must be quiet; a favorable earlier prefix cannot replace an unsettled endpoint. Absolute scores do not suppress material loss while already ahead. Pinned Lichess predicates recognize tactical motifs; the adapter preserves move/square witnesses and retained Fieldwork collection/native extensions. A motif is not an inferred cause of every evaluation drop. See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for exact gates.

POST /api/classifications/enrich queues at most CLASSIFICATION_PROBE_POSITIONS selected decisions (default 40). Concrete pending defensive questions rank first, then unknown outcomes and unclear mechanisms, retaining severity/recency order. A persisted classification_tasks list freezes the job budget. Existing engine workers refresh best/actual root searches, then use the remaining CLASSIFICATION_PROBE_QUERIES budget for unfinished tails and legal defensive hypotheses. Every native result is cached; supplement and query links commit together after the bounded work. Original decisions/exercise answers remain unchanged. Cancellation retains completed searches and links, retries resume the selected tasks, and later jobs skip identical completed probe keys. A changed binary or probe configuration cannot be silently stored under a previously planned key.

POST /api/classifications/retry processes saved evidence without Stockfish. Both labeled and abstained results are cached. Outcomes, witness roles/cues, previous-move context, endpoint diagnostics, defensive-query provenance and abstention reasons are stored in immutable response schema v3. API coverage counts distinct meaningful decisions rather than historical run totals. All work remains local.

## Game provider imports

Fieldwork imports public completed standard-chess games from Chess.com and Lichess without API keys. In **Settings → Games & imports**, choose **Import older games** on a provider card to set the username, time control, lookback/custom UTC dates, and maximum new games. The form follows the remembered username until you edit it; a one-time import never changes the connection. Imported games are always analyzed in the background, after games the poller found ([Automatic game analysis](GAME_ANALYSIS.md)). Existing games do not consume the manual import's new-game limit. **Import PGN** accepts a file or pasted text, with the active input shown explicitly.

Save each site's username on its connection card. Every `SYNC_INTERVAL_SECONDS` (default 60) the server asks each site what changed, then imports the 10 newest completed games for changed connections, whether or not the app is open, and queues analysis for each new game. Accounts away for 7 days are skipped until they return (see [Automatic game analysis](GAME_ANALYSIS.md#polling)). Games' **Update games** button requests an immediate check of all connected sites, at most once per minute per connection. Syncing itself never starts Stockfish. Connections belong to the signed-in account (or the single local workspace), survive restart, and can be disconnected by clearing the username.

### Provider boundary

`backend/trainer/game_providers/base.py` defines the request, normalized checkpoint batch, errors and `GameProviderClient` protocol. Providers own HTTP transport, provider-specific filters and normalization. They yield newest-first batches with stable keys and records containing PGN, variant, speed, completion timestamp, player names and, when the site says, whether the game was rated. The rated flag is saved on the game (a later import of an already saved game fills it in) and keeps unrated games out of [Insights](INSIGHTS.md). The shared `ingest.py` owns learner validation, PGN parsing, deduplication, progress, atomic checkpoints, cancellation and selection limits. Python-chess remains authoritative for PGN legality/history; importing provider data never substitutes remote evaluations for Stockfish.

To add a provider:

1. Implement the client protocol with bounded transport, cancellation and generator cleanup. Emit stable checkpoint keys, never offsets that can shift when new games arrive. Preserve source/ratings/clocks in PGN headers and annotations.
2. Register its ID, label and supported time controls in `PROVIDERS` and its factory in `client_factories()`.
3. Add injected HTTP fixtures covering legal games, invalid responses, resume, limits and ownership. The generic API, saved connections, Settings selector/forms and Update games require no provider-specific UI implementation.

Discovery is `GET /api/game-providers`; imports use `POST /api/imports/provider/{provider}`. Connections use `PUT /api/providers/{provider}/connection` and GET/POST `/api/providers/{provider}/sync`. `provider_import` on job responses carries progress and the provider's display name. The Chess.com-specific import/sync endpoints and job response field are compatibility aliases. The deprecated auth profile username write also updates the connection; clients read provider connections rather than that profile field.

All providers share the import/checkpoint tables (physically named `chesscom_imports` / `chesscom_archives` to preserve saved jobs), with a provider discriminator and an account-owned connections table in the same database. There is no second import subsystem or database.

### Lichess transport

Uses [Lichess's public game export API](https://lichess.org/api#tag/Games/operation/apiGamesUser), streamed as NDJSON with PGN and clocks, excluding ongoing games and remote evaluation annotations. Standard chess only; rapid, blitz, bullet, ultra bullet, classical and correspondence are supported. Export date filters follow Lichess's API date window; imported games must also satisfy the requested completion dates. Long-running correspondence games outside the export window may require a wider range.

A completed game is checkpointed atomically as it is saved. Retry reopens the bounded export and skips saved checkpoint IDs; it never assumes a moving page offset is stable. Streams close when the requested limit is reached, on cancellation, or on error. Saved games survive a failed/cancelled request. A 429 produces a retryable error instructing the user to wait at least a minute; a shared one-minute cooldown also prevents later queued jobs from immediately contacting Lichess again.

All provider traffic shares one host lock. Lichess limits default to `PROVIDER_TIMEOUT_SECONDS=20` per network read, `PROVIDER_MAX_RESPONSE_BYTES=25000000`, `PROVIDER_MAX_SCAN_GAMES=10000`, one megabyte per record and ten minutes per export. Narrow the date range if a cap is reached. Cancellation during a blocked read completes when that bounded read returns. Chess.com uses its own `CHESSCOM_*` transport settings.

Automated tests inject provider responses and make no live provider requests. This verifies Fieldwork's transport contract and integration, not the external services' uptime.

### New-account welcome

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

### Chess.com transport

Open **Settings → Games & imports**, choose **Import older games** on the Chess.com card and enter a player username. Defaults: rapid, last 3 calendar months (including the current UTC month), latest 100 unsaved matching games. Select blitz/bullet/daily/all, a longer range or all available history, and a maximum of 1–1000 new games. Rated and unrated completed standard-chess games are included; each game keeps Chess.com's `rated` flag, and re-importing a saved game fills that flag in, since games imported before it existed have none. Unrated games stay out of [Insights](INSIGHTS.md). Chess variants and ongoing games are excluded. No Chess.com login, API key or subscription integration is required.

#### Provider and authority

Use the [official read-only Published Data API](https://www.chess.com/news/view/published-data-api):

* `GET https://api.chess.com/pub/player/{username}/games/archives`
* `GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}`

The backend reads monthly JSON for its PGNs, completion times, rules and time-class metadata. Archives are searched newest first, and games are sorted by end time within each month. The supplied username is matched in provider player metadata and independently in parsed PGN headers. No side is silently inferred when those headers are ambiguous. Python-chess, Stockfish, policy and FSRS retain their existing authorities; provider accuracy scores are unused.

Chess.com may serve cached data; newly completed games need not appear immediately. The feature retrieves public completed history; it does not provide real-time synchronization or gameplay.

#### Local API and persistence

`POST /api/imports/chesscom` accepts:

```json
{"username":"your_username","time_class":"rapid","months":3,"max_games":100,"start_date":null,"end_date":null}
```

It returns HTTP 202 with a queued job ID. Identical active requests reuse the same job; submitting after completion refreshes provider data and deduplicates saved games. `months=0` selects all available history. `max_games` counts newly inserted games: duplicates and invalid PGNs do not consume it. The scan continues within the chosen range until that many new games are found or matching archives are exhausted. This can backfill older games never saved locally; use From date if you want only recently played games.

Optional **From date / To date** fields accept ISO dates, for example `start_date="2026-01-10"` and `end_date="2026-02-15"`. Setting either date overrides `months`; leaving one blank creates an open-ended range. Both endpoints include the entire day, based on the game's completion timestamp in UTC (not its start date). The backend prunes unrelated monthly archives, then filters individual games within the remaining archives. Reversed dates are rejected before queuing. Mode and maximum-game limits still apply. Clear both dates to restore the rolling lookback window.

The normal job worker downloads first, then queues a background review for each game introduced by this import ([Automatic game analysis](GAME_ANALYSIS.md)). `/api/jobs` includes a `chesscom` progress object: archives checked/available, fetched/imported/duplicate/filtered/rejected counts, fetch-completed flag and up to 50 diagnostic examples. Each new game's review then runs as its own `game_review` job. `games_fetched` counts PGNs examined by the importer, including duplicates/rejections; it can exceed the new-game limit. Filtering counts cover checked archive entries, not an account-wide total.

`chesscom_imports` stores query/progress fields relationally, keyed to `analysis_jobs`. `chesscom_archives` stores completed archive URLs/checkpoints. Original matching monthly PGNs accumulate in the linked `game_imports` row (the raw batch can include entries beyond the new-game limit). Processed games retain fingerprints/provenance links; `import_games.is_new` separates newly inserted games from duplicate provenance. Each archive import and its checkpoint commit atomically. On failure, cancellation or restart, saved games remain; retry skips completed archives. Once fetching finishes, an engine retry requires no provider requests. Start a fresh import to refresh a previously checked month after new games appear.

Chess.com supplies monthly archives, so a fresh import still downloads archive data containing old games. It does not rerun Stockfish or classify those duplicate games. There is no per-game delta endpoint, and manual imports use no conditional archive HTTP cache (only the poller's change check sends an `ETag`). A duplicate-only import completes without new analysis work. New PGN-file imports follow the same new-game analysis policy; a duplicate-only PGN upload creates no analysis job. To finish older cancelled/failed work, retry its original job separately.

#### Classification cancellation and reuse

Each completed local classification commits independently. Cancel stops new tasks and allows already-started engine/rule work to save. Retry the job from Import to finish its original scope, or use **Settings > Classify saved games** to scan saved meaningful decisions.

Classified and abstained responses are reused when saved evidence, rule version, parameters and taxonomy match. Missing or failed classifications are computed locally; an identical rejected result is not automatically revived. Worker-count changes do not invalidate results. A hard process failure before a transaction commits can require recomputing that unfinished unit. Retry progress may recount saved positions without repeating compatible engine/rule work.

Classification-only jobs launch no background engines and never call a model. Optional **Deepen unclear positions** is a separate, capped native Stockfish job with persisted tasks and cached searches; see [analysis pipeline](GAME_ANALYSIS.md#optional-evidence-enrichment).

PGN uploads and provider imports share one mutation lock to prevent concurrent duplicate insertion. All Chess.com traffic is serial within the one application process, even with multiple engine workers. No external workers are involved.

#### Failure behavior

Bounded 20-second request timeouts, up to three attempts on transport errors / 429 / selected 5xx responses, and cancellable backoff. Respect Retry-After; waits greater than 10 seconds end with an actionable retry-later message instead of retrying early. There is no infinite retry loop. 404/410, 403, redirects, malformed JSON and oversized responses have explicit messages. Usernames and archive URL paths are validated; arbitrary provider URLs/redirects are never followed.

No matching archives/games produces a completed import with zero games and an explanatory UI message. An engine failure preserves fetched PGNs for retry. Bad or mismatched PGNs are reported individually. Existing parsed decisions and engine caches prevent repeated analysis of already saved games.

#### Privacy and configuration

Only the requested username, archive paths and configured User-Agent go to Chess.com, from the host. No credentials, existing local games or database contents are transmitted. The import form starts from the Chess.com connection's saved username. Games, classification and learning data remain local.

`CHESSCOM_TIMEOUT_SECONDS=20`, `CHESSCOM_MAX_RESPONSE_BYTES=25000000` (decompressed bytes per HTTP response), and `CHESSCOM_USER_AGENT` are centralized host settings. Default User-Agent identifies Fieldwork; users may append contact information. Runtime HTTPX is explicitly declared and pinned in the dependency lock.

#### Verification

Deterministic MockTransport tests cover filters, both learner sides, username/URL validation, latest-game limits, cross-source duplicates, checkpoint resume/cancellation, provider errors/rate limits and a real Stockfish worker-to-review flow. Browser tests inject this provider boundary in a test-only app while using the actual application API, SQLite, production frontend and native engine. Normal automated tests never call Chess.com.
