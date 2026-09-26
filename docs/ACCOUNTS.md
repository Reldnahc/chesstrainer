# Accounts and one shared database

Self-service username/password accounts require `ACCOUNTS_ENABLED=true` and a
nonblank `PUBLIC_ORIGIN`. A blank or whitespace-only `PUBLIC_ORIGIN` selects local
single-user mode without login, even when `ACCOUNTS_ENABLED=true` in Docker.
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
The immutable Stockfish position cache and skill taxonomy are shared internally.
No API exposes arbitrary engine-cache rows.

Request services and background workers receive an `AccountSession` factory bound
to one explicit user. ORM read/update/delete criteria apply to all private models,
including aggregates and guessed IDs. Flush validation assigns ownership and
rejects cross-account references. Raw SQL and private bulk inserts are prohibited
in these sessions. The account service alone uses administrative SQL for credentials
and sessions. New private models must inherit `Owned`; tests must cover their API.

One host-wide engine pool limits native processes through `ENGINE_SLOTS` (default
4); each process uses `STOCKFISH_THREADS` and `STOCKFISH_HASH_MB`. Account job
coordinators share that pool. Processes are created lazily when analysis is
requested, not on signup. Use one Uvicorn worker per database/service instance.

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
Neither command grants privileges to the first person who registers.

Configure `ACCOUNTS_ENABLED=true`, `PUBLIC_ORIGIN=https://your-chess-hostname`, and
`SESSION_SECURE=true` behind HTTPS. The proxy must preserve the public Host header.
For direct local HTTP development only, use `SESSION_SECURE=false` and the exact
HTTP public origin. Account mode does not use the legacy shared LAN token.
Do not expose local single-user mode publicly. Do not switch a shared deployment
back to single-user mode: that mode intentionally opens the original `local` account.

Passwords use salted scrypt (N=131072, r=8, p=1). Hashing is memory-bounded by a
single authentication slot and rate-limited. Random session cookies are HttpOnly,
SameSite=Lax and Secure by default; only token digests are stored. Sessions expire
after 30 days, survive application restarts, and are independent across devices.
Writes require the configured Origin and a session-bound CSRF header. Passwords
and session tokens are never returned in API responses or included in public settings.

## Administration and recovery

Host commands (passwords are entered interactively, never in command arguments):

```
python -m trainer.accounts reset-password USERNAME
python -m trainer.accounts disable USERNAME
python -m trainer.accounts enable USERNAME
```

These revoke existing sessions. Disabling prevents further requests; stop/restart
the service if you also need to interrupt that account's already-running analysis.
There is no email delivery dependency or web admin dashboard in this version.
The existing SQLite backup/restore tool includes all accounts and their data in
one snapshot. Treat backups as private: they include password hashes and sessions.
Once accounts exist, schema downgrade is refused; restore a pre-upgrade snapshot instead.

## Recent games

Save a Chess.com username in Games or Settings. It is stored on the account, not
in that browser. While either page is visible it checks sync progress every 15
seconds and requests a provider refresh at most once per minute. Multiple devices
share the same checkpoint/cooldown. Hidden pages do not poll. A failed provider
request leaves saved games available and displays an error.

Automatic sync fetches at most the latest 50 completed standard-chess games in
the current/previous month, across all time controls. It does not backfill all
history, analyze games, create training cards, or change review schedules. The
Games library sorts by play time, with unknown dates last. Chess.com's published
API is cached; refresh does not guarantee immediate availability after a game.

Manual imports default to fetching only in the UI. Select **Also analyze these
games for training** to run the existing pipeline. Within any saved game, **Start
game review** runs the coach/report and **Find training mistakes** queues that
game for training, even if it was fetched earlier. Interactive exploration still
analyzes the position you visit. The HTTP import API retains its previous
`analyze=true` default for existing clients; the UI explicitly sends its selection.
