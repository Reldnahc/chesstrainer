# Accounts and one shared database

Self-service username/password accounts require `ACCOUNTS_ENABLED=true`. The
default, `false`, selects local single-user mode without login.
Everyone who can reach that instance shares the reserved `local` workspace. Existing
named accounts remain stored and private; clearing the origin does not merge or
expose their games. Restart the server/container after changing modes. The optional
legacy `LAN_ACCESS_TOKEN` still applies in local mode if explicitly configured.

Cloudflare
Access and the existing reverse proxy remain independent outer access controls.
The app authenticates its own users; it does not trust Cloudflare email headers.

Find the signed-in username, **Sign out**, and **Sign out all devices** in
**Settings → Account** on desktop and mobile. Account controls do not occupy a
separate bar above navigation. Local mode has no account section.

All accounts, sessions, games, jobs, reviews and training history live in the
existing `DATABASE_PATH` SQLite file. Private tables have an indexed `user_id`.
Game fingerprints and exercise/classification identities deduplicate per account.
The immutable Stockfish position cache, the Maia prediction cache and the skill
taxonomy are shared internally, so members who import the same game reuse one
analysis. No API exposes arbitrary engine- or Maia-cache rows.

Audio choices are saved in the same account-owned `user_preferences` row as coach
and motion choices, including for the reserved local user. `/api/preferences/audio`
reads and replaces the sound settings without changing either of those independent
preferences. Defaults enable sound at 35% volume, with board and practice sounds
enabled and game-review feedback sounds disabled. Existing accounts receive these
defaults when upgraded; saving them on one device applies to later account loads.

Request services and background workers receive an `AccountSession` factory bound
to one explicit user. ORM read/update/delete criteria apply to all private models,
including aggregates and guessed IDs. Flush validation assigns ownership and
rejects cross-account references. Raw SQL and private bulk inserts are prohibited
in these sessions. The account service alone uses administrative SQL for credentials
and sessions. Startup maintenance and the host job queue also use administrative
sessions, limited to reconciliation and scheduling metadata respectively; they
never pass those sessions into request handlers or domain job execution. New
private models must inherit `Owned`; tests must cover their API.

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
database/service instance; no new deployment variables or database migration are
required for this scheduling model.

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
Neither command grants privileges to the first person who registers. To make an
account that already signed up an administrator, use `promote USERNAME` (see
[Administration and recovery](#administration-and-recovery)).

Configure `ACCOUNTS_ENABLED=true` and `SESSION_SECURE=true` behind HTTPS. The
proxy must preserve the public Host header; if it cannot, set
`PUBLIC_ORIGIN=https://your-chess-hostname`. For direct local HTTP only, use
`SESSION_SECURE=false`; sign-in over plain HTTP otherwise explains this setting. Account mode does not use the legacy shared LAN token.
Do not expose local single-user mode publicly. Do not switch a shared deployment
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
sign-in controls: reset a password, disable or enable, make administrator, or
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
```

`promote` makes an existing account an administrator; it is the only way to grant
administrator privileges to an account created through signup. It fails if the
account does not exist or is already an administrator, and its open sessions gain
the privilege on their next request. The other commands revoke existing sessions. `reset-password` sets a permanent
password (host recovery), unlike the temporary one an administrator sets in Settings. Disabling prevents further requests; stop/restart
the service if you also need to interrupt that account's already-running analysis.
Enabling requeues analysis that was interrupted while the account was disabled.
There is no email delivery dependency in this version.
The existing SQLite backup/restore tool includes all accounts and their data in
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
the same queue behind games the poller found. Opening a game and choosing **Start game
review** moves its job to the front. **Find training mistakes** still queues
training alone for one game. Interactive exploration still analyzes the position
you visit. The HTTP import APIs ignore the former `analyze` field.
