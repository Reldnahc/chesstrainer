# Unraid deployment with your existing reverse proxy

The image contains the FastAPI app, built React interface and Debian Trixie's Linux
Stockfish package (17 at the time of verification).
There is one persistent SQLite database, `/data/trainer.sqlite3`, containing all
accounts, sessions, games and progress. Neither a second database service nor a
replacement proxy is needed. Cloudflare Access stays outside the app; users sign
up and sign in to Fieldwork independently.

## Build and configure

From a checkout on Unraid, set these Compose variables in `.env` (never commit it):

```dotenv
PUBLIC_ORIGIN=https://chess.your-domain.example
APPDATA_PATH=/mnt/user/appdata/fieldwork
PUID=99
PGID=100
BIND_ADDRESS=127.0.0.1
APP_PORT=8000
ENGINE_SLOTS=4
STOCKFISH_THREADS=2
STOCKFISH_HASH_MB=128
STOCKFISH_WORKERS=2
```

Create the appdata folder owned by your configured UID/GID, then build:

```sh
mkdir -p /mnt/user/appdata/fieldwork
chown 99:100 /mnt/user/appdata/fieldwork
docker compose build
```

The build context excludes local databases, backups, binaries, dependencies and
secrets. The image runs without root and uses the pinned Python constraints and
frontend lockfile. It serves its corresponding application source download in the
existing footer; Stockfish is installed from Debian's package repository, with
its license at `/usr/share/doc/stockfish/copyright` and matching Debian source
packages available from that distribution.

## Bring over your existing account data

Stop the Windows app and create a consistent backup:

```powershell
.venv\Scripts\python.exe scripts/backup.py export backups/before-shared-hosting.zip
```

Restore that backup to a **new file**, using the existing restore command, then
copy the resulting `trainer.sqlite3` into your Unraid appdata folder. Do not copy
only a running SQLite main file without its WAL. Alternatively mount the backup
folder into a one-off container and use `python scripts/backup.py restore` there.

Before starting the service or letting friends register, claim your existing data:

```sh
docker compose run --rm fieldwork python -m trainer.accounts claim-local YOUR_USERNAME
docker compose up -d
```

The command prompts twice for your password, migrates the database and assigns
the retained local workspace to your administrator identity. It never overwrites
the original Windows database. If this is a fresh database without old data,
`create-admin YOUR_USERNAME` creates an administrator with an empty workspace.
Regular signup always creates an ordinary account with no access to existing data.

Moving from Windows Stockfish to Linux changes the engine binary hash. Existing
saved reviews and accepted training answers remain available; checking additional
answers against an old exercise's grading reference requires its original binary.
New games analyzed on Unraid use the Linux engine. **Find training mistakes**
reuses existing immutable decisions for games already analyzed; it does not
silently rewrite old grading evidence or reset their schedules. Rebuilding old
grading references for a different engine is not included in this deployment.

## Attach your proxy

Point your existing proxy at port **8000** and preserve the public `Host` header.
`PUBLIC_ORIGIN` must exactly match the HTTPS address used in the browser, with no
path. HTTPS terminates at your proxy; the internal upstream remains HTTP. Secure
session cookies and the explicit public origin work without trusting arbitrary
forwarded headers. Apply your Cloudflare Access policy to that hostname as usual.

The sample publishes only on the Unraid host's loopback interface. If your proxy
container cannot reach host loopback, attach both containers to your existing
Docker network and use `http://fieldwork:8000`, or set `BIND_ADDRESS` to the Unraid
LAN IP and point the proxy at that address. The proxy's container loopback is not
the Unraid host's loopback. Do not expose the origin through an additional router
port-forward that bypasses your existing access gate.

For Unraid's Docker UI, use image `fieldwork:local`, map `/data` to your appdata
folder, set the environment values shown in Compose, and run as the configured
UID:GID using `--user 99:100` in Extra Parameters. Merely setting PUID/PGID as
container environment variables does not change Linux ownership in this image.

`ENGINE_SLOTS × STOCKFISH_THREADS` is the maximum native search thread budget
across accounts, training and interactive review. Native hash memory is roughly
`ENGINE_SLOTS × STOCKFISH_HASH_MB`, plus process/Python overhead. Adjust those
settings to suit your CPU. Signup and recent-game sync run no Stockfish analysis.
Use only one app instance/Uvicorn worker against this database.

## Operations

```sh
docker compose logs --tail=100 fieldwork
docker compose exec fieldwork python -m trainer.accounts reset-password FRIEND
docker compose exec fieldwork python -m trainer.accounts disable FRIEND
docker compose exec fieldwork python scripts/backup.py export /data/backup-YYYY-MM-DD.zip
```

Copy backups off the appdata disk. A backup contains all accounts and sessions;
treat it as private. Stop the app before restoring into a new database path, then
switch files while stopped. Do not overwrite a live database. Upgrades are
`docker compose build` followed by `docker compose up -d`; the appdata mount
preserves accounts and progress. Back up before schema upgrades. See
[ACCOUNTS.md](ACCOUNTS.md) for session behavior and account recovery.
