# Accounts and configuration

Username/password accounts require `ACCOUNTS_ENABLED=true`. The
default, `false`, selects local single-user mode without login.
Everyone who can reach that instance shares the reserved `local` workspace. Existing
named accounts remain stored and private; switching to local mode does not merge or
expose their games. Restart the server/container after changing modes. The optional
legacy `LAN_ACCESS_TOKEN` still applies in local mode if explicitly configured.

Cloudflare
Access and the existing reverse proxy remain independent outer access controls.
The app authenticates its own users; it does not trust Cloudflare email headers.

### Who can create an account

Sign-ups start closed, including on upgraded servers, so finding the address is not enough to get an account. Administrators
add members in **Settings → Account → Add member** with a username and a
temporary password, which the member replaces at first sign-in (the same forced
change as a password reset). A club that wants self-service can use **Open
sign-ups** in the same section; the sign-in page then offers **Create an
account**, and visitors who sign up are ordinary members, never administrators.
While sign-ups are closed the sign-in page tells visitors to ask whoever runs the
server, and `POST /api/auth/signup` answers 403. The switch is stored in the
`site_settings` table with the other [stored server settings](#stored-server-settings);
host operators can also run
`python -m trainer.accounts open-signups` or `close-signups`.

Signed-out visitors cannot add analysis load. Every route that runs Stockfish or
Maia needs a signed-in account; a shared game link only reads the saved review
and lists legal moves (see [Shared game links](#shared-game-links)). Members share
the host's `ENGINE_SLOTS`, with one analysis job per account at a time.

Find the signed-in username, **Sign out**, and **Sign out all devices** in
**Settings → Account** on desktop and mobile. Account controls do not occupy a
separate bar above navigation. Local mode has no account section.

All accounts, sessions, games, jobs, reviews and training history live in the
`DATABASE_PATH` SQLite file. Private tables have an indexed `user_id`.
Game fingerprints and exercise/classification identities deduplicate per account.
The immutable Stockfish position cache, the Maia prediction cache and the skill
taxonomy are shared internally, so members who import the same game reuse one
analysis. No API exposes arbitrary engine- or Maia-cache rows.

Audio choices are saved in the same account-owned `user_preferences` row as coach
and motion choices, including for the reserved local user. `/api/preferences/audio`
reads and replaces the sound settings without changing either of those independent
preferences. Defaults enable sound at 35% volume, with board and practice sounds
enabled and game-review feedback sounds disabled. Accounts without saved audio choices
get these defaults; saving them on one device applies to later account loads.

Request services and background workers receive an `AccountSession` factory bound
to one explicit user. ORM read/update/delete criteria apply to all private models,
including aggregates and guessed IDs. Flush validation assigns ownership and
rejects cross-account references. Raw SQL, private bulk inserts, bulk updates or
deletes by primary key, `ordered_values` changes to owners or references, and the
legacy `bulk_*` session methods are all refused in these sessions. Owned models have
no default owner: an account session stamps its own, and any other insert must name it. The account service alone uses administrative SQL for credentials
and sessions. Startup maintenance and the host job queue also use administrative
sessions, limited to reconciliation and scheduling metadata respectively; they
never pass those sessions into request handlers or domain job execution. New
private models must inherit `Owned`; tests must cover their API.

### Shared game links

A game review's address (`/games/<id>`) works for anyone who has it. Signed-out
visitors see that review alone, with a Sign in button in place of navigation, and
can step through moves but not try their own. Signed-in viewers from another account
can also explore variations, analyzed as their own account. Viewers read the game
through sessions bound to its owner (`game_view` in `routes/games.py`); the only
cross-account lookup is which account owns the ID. The owner's other games stay
private: viewers get `read_only: true` and no cross-game history, cannot start,
pause or refine the review, and never see the game in their own library. Only
`GET /api/games/<id>`, `GET /api/games/<id>/review` and
`POST /api/games/<id>/position` accept signed-out requests; each is declared with
`authz.shared_links.route` beside its route, which is the list the sign-in check
reads. `GET /api/games/<id>/export` reads shared games for signed-in viewers but
still needs a sign-in. Local single-user mode never opens another account's games.

Administrator-only endpoints (account administration, course files, server
settings) declare `dependencies=[authz.administrator(...)]`, so a handler cannot
forget the check; in local single-user mode the one user is the administrator.

One host-wide engine pool limits native processes through `ENGINE_SLOTS` (default
4); each process uses `STOCKFISH_THREADS` and `STOCKFISH_HASH_MB`. One application
serves every account. There are exactly `ENGINE_SLOTS` host analysis coordinators
and one fetch-only coordinator, independent of account count. An account can run
one analysis job at a time; different accounts share the bounded workers. Native
processes are created lazily when analysis is requested, not on signup.

Requests and jobs create short-lived account scopes instead of retaining an app or
threads per user. Per-account locks are released when active requests/jobs finish.
Startup resumes eligible saved jobs even before their owners log in. Shutdown
drains active work and closes the pooled engines. Use one Uvicorn worker per
database/service instance.

## Enable and migrate

Back up the existing database with `scripts/backup.py` and stop the server before
switching modes. Migrations retain existing data under reserved account `local`,
which cannot log in or be claimed through signup. Assign it explicitly:

```
python -m trainer.accounts claim-local YOUR_USERNAME
```

The command prompts for a password twice and makes that account the administrator.
It changes ownership identity in place, preserving every game and review. Run this
before first login. For a fresh installation use `create-admin YOUR_USERNAME`.
Neither command grants privileges to the first person who registers, and sign-ups
stay closed until an administrator opens them. To make an
account that already signed up an administrator, use `promote USERNAME` (see
[Administration and recovery](#administration-and-recovery)).

Configure `ACCOUNTS_ENABLED=true` and `SESSION_SECURE=true` behind HTTPS. The
proxy must preserve the public Host header; if it cannot, set
`PUBLIC_ORIGIN=https://your-chess-hostname`; the server's own LAN address keeps
working alongside it. Without HTTPS, sign-in still works when you open the server by a LAN address (a private IP, a single-label name or a `.lan`/`.local`-style name) from a device on that network; public names and outside visitors always get Secure cookies. `SESSION_SECURE=false` drops Secure cookies everywhere,
for local HTTP development only. Account mode does not use the legacy shared LAN token.
The container image always runs account mode and refuses to start in single-user mode;
that mode runs only from source. Do not expose it publicly. Do not switch a shared deployment
back to single-user mode: that mode intentionally opens the original `local` account.

Passwords use salted scrypt (N=131072, r=8, p=1). Hashing is memory-bounded by a
single authentication slot and rate-limited: failed attempts are counted per source
address and per username, and every attempt counts toward a host-wide limit. Behind
a reverse proxy, set `FORWARDED_ALLOW_IPS` to the proxy's address so each browser
keeps its own address. Random session cookies are HttpOnly,
SameSite=Lax and Secure by default; only token digests are stored. Sessions expire
after 30 days, survive application restarts, and are independent across devices.
Writes require an Origin matching the request's Host (or `PUBLIC_ORIGIN` when set)
and a session-bound CSRF header. Passwords
and session tokens are never returned in API responses or included in public settings.

## Administration and recovery

Everyone can change their own password in **Settings → Account → Password** by
entering the current one; their other devices are signed out and this one stays.

Administrators manage other accounts in **Settings → Account**, below their own
sign-in controls: open or close sign-ups, add a member, reset a password, disable or enable, make administrator, or
delete. A reset sets a temporary password and signs that account out; the
administrator passes it on, and at the next sign-in the account must choose its
own password before anything else works. Members never see this section and the `/api/auth/accounts` endpoints
refuse them. An administrator cannot reset, disable or delete their own account
there. Deleting asks for confirmation, removes every row the account owns (games,
reviews, jobs, training and Study history) and keeps shared engine analysis; it
waits while that account has analysis running, so disable the account first and
retry once the analysis stops. Disable instead to keep the account's history.

Host commands (passwords are entered interactively, never in command arguments):

```
python -m trainer.accounts promote USERNAME
python -m trainer.accounts reset-password USERNAME
python -m trainer.accounts disable USERNAME
python -m trainer.accounts enable USERNAME
python -m trainer.accounts open-signups
python -m trainer.accounts close-signups
```

`promote` makes an existing account an administrator from the host; an existing
administrator can instead use **Make administrator** in Settings → Account. It fails if the
account does not exist or is already an administrator, and its open sessions gain
the privilege on their next request. The other commands revoke existing sessions. `reset-password` sets a permanent
password (host recovery), unlike the temporary one an administrator sets in Settings. Disabling prevents further requests; stop/restart
the service if you also need to interrupt that account's already-running analysis.
Enabling requeues analysis that was interrupted while the account was disabled.

After an update the server upgrades the database when it starts and serves the
site only once that is done. A command run meanwhile stops with "The database is
busy"; run it again once the site loads. A command upgrades the database itself
only when no server has (a first setup, or a stopped server), and says so first.
`create-admin`, `claim-local` and `reset-password` ask for a password, so they need a
terminal: in Docker, run them with `docker exec -it`; without one they stop at once.

There is no email delivery.
The SQLite backup/restore tool includes all accounts and their data in
one snapshot. Treat backups as private: they include password hashes and sessions.
Once accounts exist, schema downgrade is refused; restore a pre-upgrade snapshot instead.

## Recent games

Save a Chess.com or Lichess username in Settings. The connection is stored on the
account, not in that browser. The server polls every saved connection on its own
(see [Automatic game analysis](GAME_ANALYSIS.md)); open pages only read sync and
queue status every 15 seconds. Games' compact **Update games** control requests an
immediate check, at most once per minute per connection. Multiple devices share
the same checkpoint/cooldown. A failed provider request leaves saved games
available and displays an error.

Each sync reads the 10 newest completed standard-chess games across all time
controls, whatever month they were played in, and only runs when the provider
reports a change. Accounts with no visits for 7 days stop being polled and see a
welcome-back notice on return. Every new game queues its own
analysis job. The Games library sorts by play time, with unknown dates last.
Chess.com's published API is cached; a check does not guarantee immediate
availability after a game.

Manual imports fetch older games; there is no analysis choice. Their games join
the same queue behind games the poller found. Opening a game whose review has not started,
failed or was paused starts it at the front of the queue. Interactive exploration analyzes the position
you visit. The HTTP import APIs ignore a legacy `analyze` field.

## Configuration

Settings in backend/trainer/config.py is the validated Pydantic boundary. Environment variables override root .env; defaults apply last. Relative paths resolve from the server working directory. Run from the repository root. Invalid recognized values fail startup with field-specific errors.

#### Stored server settings

Most settings below live in the database (`site_settings`), not the environment.
Administrators, or the single user of a local install, change them in **Settings
→ Advanced → Server** and apply them with **Restart server**. Only the settings the
server needs before it opens the database, or that guard who can reach it, stay
environment variables: `SERVER_HOST`, `SERVER_PORT`, `DATABASE_PATH`,
`COURSES_PATH`, `ACCOUNTS_ENABLED`, `SESSION_SECURE`, `PUBLIC_ORIGIN`,
`LAN_ACCESS_TOKEN`, `ALLOWED_HOSTS`, `STOCKFISH_PATH`, `HUMAN_MODEL_PATH`,
`HUMAN_MODEL_DEVICE` (the container entrypoint reads it), `PUZZLE_PACK_PATH` and
`CHESSCOM_USER_AGENT` (`ENV_ONLY` in `trainer/site_settings.py`).

Any other variable still works as a starting value: on each start, a stored
setting the table does not have yet is filled in from the environment, and from
then on the table wins, so changing that variable later has no effect. A saved
value that no longer validates is ignored with a warning and the default applies.
The restart button works when `python -m trainer` runs the server (as Docker
does): it stops Uvicorn gracefully and starts it again in the same process. A
server started with `uvicorn` directly says to restart it from the host. Tests and
tools that pass their own `Settings` to `create_app` skip the stored values.

Settings in the browser also edits account preferences, including Chess.com and
Lichess usernames, coach and motion. Existing exercise
policies and engine evidence keep their saved configuration. The optional LAN
token is a SecretStr excluded from public serialization; only its configured
status is returned.

### Active settings

| Variable | Default / bounds where useful |
|---|---|
| SERVER_HOST / SERVER_PORT | 127.0.0.1 / 8000 |
| DATABASE_PATH | data/trainer.sqlite3 |
| COURSES_PATH | unset; the club's Study course files live in a `courses` folder beside the database (`/data/courses` in Docker). See [course files](COURSE_FILES.md#club-courses) |
| STOCKFISH_PATH | stockfish |
| STOCKFISH_THREADS / STOCKFISH_HASH_MB / STOCKFISH_WORKERS | 1 / 64 MB / 1; workers 1..16 (reviews also cap at ENGINE_SLOTS) |
| SYNC_INTERVAL_SECONDS | 60; seconds from the start of one server polling round (change checks, then syncs for changed connections) to the next, 0 disables polling. A longer round starts the next one immediately. |
| SYNC_GAMES | 10 (1..1000); newest games a sync reads once a provider reports a change |
| SYNC_LICHESS_BATCH | 300 (1..300); Lichess players per change-check request |
| SYNC_AWAY_DAYS | 7 (1..365); days without a visit before polling pauses and a welcome back is shown |
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
| ALLOWED_HOSTS | empty; extra host names the local-mode API answers to. IP addresses, localhost, SERVER_HOST, single-label names and `.local`/`.localhost`/`.lan`/`.home`/`.home.arpa`/`.internal` names are always accepted |
| MAX_IMPORT_BYTES | 10000000 |
| CHESSCOM_TIMEOUT_SECONDS | 20 seconds per provider request |
| CHESSCOM_MAX_RESPONSE_BYTES | 25000000 decompressed bytes per response |
| PUZZLE_STARTER_PACK | true; serves the bundled CC0 Lichess starter pack |
| PUZZLE_PACK_PATH | unset; directory holding a Lichess-layout puzzles CSV and its hash-pinned manifest, verified at startup |
| PUZZLE_GENERATION | true; mine each analyzed game for puzzles at the end of its analysis job |
| PUZZLE_GENERATION_DEPTH / PUZZLE_GENERATION_TIME | 18 / 4 seconds per search (depth 1..40, time greater than 0 and at most 30) |
| PUZZLE_GENERATION_MAX_PLIES | 9 (3..9) most solution plies (five learner moves); longer lines abstain |
| PUZZLE_GENERATION_GAMES | 40 (1..500) unsearched games per backfill job queued from the Puzzles page |
| LICHESS_TIMEOUT_SECONDS (formerly PROVIDER_TIMEOUT_SECONDS) | 20 seconds per Lichess network read |
| LICHESS_MAX_RESPONSE_BYTES (formerly PROVIDER_MAX_RESPONSE_BYTES) | 25000000 decompressed bytes per Lichess export |
| LICHESS_MAX_SCAN_GAMES (formerly PROVIDER_MAX_SCAN_GAMES) | 10000 records per Lichess export; narrow date range when reached |
| CHESSCOM_USER_AGENT | FieldworkChessTrainer/0.1 (local personal chess training) |

See [.env.example](../.env.example) for a copyable starting point.

### Engine and grading

Search stops at the first reached depth/time/node bound. STOCKFISH_WORKERS controls parallel games within one import; each owns a native process. STOCKFISH_THREADS and hash memory apply per process. Interactive grading has a separate engine in addition to background workers. Four workers with one thread permit four simultaneous background searches plus interactive grading; concurrency does not change per-position limits.

Full-game reviews use STOCKFISH_WORKERS for parallel moves within the selected
game, and then for parallel refinement questions, capped by ENGINE_SLOTS. Results are saved in move order so comparisons with
the preceding move remain correct. Account mode additionally enforces the shared
host-wide engine pool. The default of one worker remains serial; hosts with spare
CPU capacity can increase it (up to 16, with ENGINE_SLOTS raised to match) without lowering the review's search limits.

Missing Stockfish produces an actionable status without preventing UI startup. New analysis and unlisted engine answers need the executable. Existing stored answers and saved-evidence classification remain usable.

For unlisted answers, the saved analysis limits/resources and binary identity are required. An incompatible executable produces an unavailable response without a recall failure. Rebuilding old exercises under a new engine is a future operation.

Policy and target-rating effects are documented in [analysis pipeline](GAME_ANALYSIS.md#analysis-pipeline) and [weakness priorities](INSIGHTS.md#weakness-priorities-and-archived-curriculum). The custom mode currently uses TOLERANCE_CP; it is not a plug-in policy editor.

### Local classification

Human move evidence is separate from rule classification and Stockfish. See
[human move evidence](REVIEW_INTELLIGENCE.md#human-move-evidence) for explicit setup, resource measurements,
offline use, cache identity and conservative interpretation of rating domains.

CLASSIFICATION_WORKERS limits local rule tasks; it starts no model requests or additional engines. Each bounded pool admits at most twice its worker count. Worker count alone does not invalidate results.

MAX_PLIES is the initial saved-line horizon. If the endpoint is unfinished, EXTENSION_PLIES permits bounded forward reading to a quiet endpoint; zero disables extension. TACTIC_PLIES separately bounds connected tactical events attributable to the initial move, and a quiet unrelated gap ends the episode early. Full saved lines are checked for legality. These settings inspect existing evidence without launching Stockfish. MIN_LOSS_CP and MIN_MATERIAL gate material findings; mate transitions remain explicit.

Settings can explicitly queue deeper evidence for at most PROBE_POSITIONS decisions. PROBE_QUERIES counts all searches per selected decision, including two refreshed root comparisons. Remaining searches extend unresolved tails and test specific legal defenses. Each uses PROBE_DEPTH/TIME, MultiPV 1 and STOCKFISH_WORKERS; deep node limits do not apply.

The task list, classifier parameters, engine binary and search limits participate in persisted job/cache identity. Completed native work is reused. Changing that configuration during a planned job requires a new job. Enrichment never rewrites original exercise answers or schedules.

No model key is read. Old OPENAI_* and LLM_* values are ignored, unused and never serialized. Local classification is available even without Stockfish when compatible saved evidence exists.

### Scheduling and imports

A saved FSRS interval strictly greater than RETIRE_AFTER_DAYS permanently retires an exercise. Startup reconciles existing qualifying states. Changing the threshold never reactivates retired cards. SLOW_ANSWER_SECONDS affects automatic Hard versus Good; raw timing remains stored independently. See [spaced repetition](STUDY.md#spaced-repetition).

Chess.com username, time class, calendar-month lookback or explicit dates, and new-game limit are selected per import and saved in SQLite. Defaults are rapid / 3 months / 100 new games. Date bounds include whole UTC completion days and override lookback. Duplicates and rejected games do not consume the new-game limit; repeated imports can backfill older unsaved games in the selected range. Retry old cancelled jobs separately.

Chess.com import requires internet access on the host and no account credentials. User-Agent may include contact details; never put secrets there. See [Chess.com transport](GAME_ANALYSIS.md#chesscom-transport).

### Local and LAN operation

Use one backend process. For LAN access, bind SERVER_HOST to the host's home-network IPv4 address and optionally configure LAN_ACCESS_TOKEN. Open http://HOST-LAN-IP:SERVER_PORT from the same trusted network. Binding 0.0.0.0 instead listens on every IPv4 interface. The token is a shared access gate and does not add transport encryption; do not expose the app directly to the public internet.

In local mode the API answers only requests whose Host is an IP address, `localhost`, a single-label name such as `nas`, SERVER_HOST, or a `.local`, `.localhost`, `.lan`, `.home`, `.home.arpa` or `.internal` name. List any other name in ALLOWED_HOSTS (comma-separated). This stops a public web page from reaching the server through DNS rebinding, which does not need port forwarding. Account mode instead requires each write's Origin to match the request's Host, or PUBLIC_ORIGIN when set; account cookies are bound to that host, so a rebinding page cannot use them.

On Windows, run scripts/allow-lan.ps1 with -LocalAddress in administrator PowerShell. It permits TCP 8000 at that address from LocalSubnet on Private networks only; pass -Port for another port. It does not change network profiles or router forwarding. Keep the host awake, avoid isolated Wi-Fi, and update binding/firewall if DHCP changes the address.

The Vite development proxy specifically targets 127.0.0.1:8000. Override SERVER_HOST and SERVER_PORT in the development backend terminal as shown in [README.md](../README.md#development-and-tests); a backend bound only to its LAN address will not answer that proxy.

### Archived settings

`COURSE_MAX_UNITS`, `LESSON_MAX_POSITIONS` and `LESSON_CHECK_PASS_FRACTION` are
ignored; old `.env` entries can be deleted. See
[archived compatibility](INSIGHTS.md#archived-compatibility).

### Shared hosting

`/api/health` and `/api/settings` distinguish an unchecked engine from a working
or unavailable one through `engine_status`. Availability is `null` until checked,
then `true` or `false` according to the latest actual engine operation. Health
requests do not start Stockfish or spend analysis CPU. Account mode checks on first
use; local mode checks at startup. A successful retry clears a previous failure.
The UI refreshes health on page navigation and allows retries even after a failure.
Administrator logs contain exception chains; shared health responses do not contain
raw exception details. There are no additional container variables for this.

- Accounts require `ACCOUNTS_ENABLED=true`. The default, false, selects the shared
  local workspace when running from source. The container image defaults to true and
  refuses to start with false.
- `PUBLIC_ORIGIN` is optional. Blank accepts writes whose Origin matches the request's
  Host; set the exact public origin only when a reverse proxy rewrites Host. The
  request's own Host is still accepted, so the LAN address keeps working.
- `SESSION_SECURE=true` protects account cookies. Plain HTTP sign-in works without it when you open the server by a LAN address (a private IP, a single-label name or a `.lan`/`.local`-style name) from a device on that network; public names and outside visitors always get Secure cookies. Disable only for
  local HTTP development.
- `FORWARDED_ALLOW_IPS` (read by Uvicorn; default `127.0.0.1`) lists the proxy addresses
  whose `X-Forwarded-For` header is trusted. Set it to your reverse proxy's address so
  sign-in rate limits apply per browser instead of to everyone behind the proxy.
- `ENGINE_SLOTS=4` caps native engine processes and concurrent analysis jobs across
  all accounts in shared mode. One additional coordinator handles fetch-only jobs.
  Each account runs at most one analysis job at a time. Idle accounts allocate no
  app instance or workers; the host worker count stays fixed as accounts grow.
- `DATABASE_PATH` names one SQLite file containing accounts and all chess data.

See [ADMINISTRATION.md](ADMINISTRATION.md) before enabling accounts for existing data and
[Unraid](INSTALL.md#unraid) for container storage, permissions and proxy configuration.

### Full-game review refinement

Optional extra investigation follows the deep baseline. Defaults are
`REVIEW_REFINEMENT_POSITIONS=8`, `REVIEW_REFINEMENT_QUERIES=4`,
`REVIEW_REFINEMENT_DEPTH=22`, `REVIEW_REFINEMENT_TIME=2`, and
`REVIEW_REFINEMENT_MULTIPV=4`. Set positions to zero to disable extra work.
See [targeted review investigation](REVIEW_INTELLIGENCE.md#targeted-review-investigation) for bounds, time/depth floors,
CPU budgets, cancellation, resume and benchmark limits. All five
settings have descriptions in the advanced Unraid template.
