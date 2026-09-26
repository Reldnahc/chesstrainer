# Unraid deployment with your existing reverse proxy

The image contains the FastAPI app, built React interface and Debian Trixie's Linux
Stockfish package (17 at the time of verification).
There is one persistent SQLite database, `/data/trainer.sqlite3`, containing all
accounts, sessions, games and progress. Neither a second database service nor a
replacement proxy is needed. Cloudflare Access stays outside the app; users sign
up and sign in to Fieldwork independently.

## Local or shared mode

- **Local only, no login:** leave `PUBLIC_ORIGIN` empty. Open the mapped LAN HTTP
  address (for example `http://YOUR-UNRAID-IP:18000` if host port 18000 maps to
  container port 8000). Everyone who can reach it shares one local workspace.
  No cookie configuration is needed because local mode does not use account sessions.
- **Separate accounts:** set `PUBLIC_ORIGIN=https://your-chess-hostname` and keep
  `ACCOUNTS_ENABLED=true` and `SESSION_SECURE=true`. Use that HTTPS address to sign in.

Restart after changing the origin. Blank/whitespace-only values override
`ACCOUNTS_ENABLED=true` and select local mode. Named accounts are not exposed or
merged into the local workspace when switching modes. Keep no-login mode on a
trusted local network. An explicitly configured `LAN_ACCESS_TOKEN` still gates it.
Unraid's **WebUI** field controls its Open WebUI shortcut separately: set it to your
LAN URL for local mode or your HTTPS hostname for account mode.

## Published image and configuration

Pushes to `main` (or a manual run of `.github/workflows/docker.yml`) build and
publish `ghcr.io/reldnahc/chesstrainer:latest` and a full commit-SHA tag through
GitHub Actions, using its built-in `GITHUB_TOKEN`. This matches the AI Jeopardy
speech services. No separate registry password secret is required. The workflow
publishes images; it does not connect to or restart Unraid.

For Compose, copy `compose.yaml` to Unraid and set these variables in `.env`
(never commit it). No source checkout or local image build is required:

```dotenv
IMAGE_TAG=latest
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

Create the appdata folder owned by your configured UID/GID, then pull:

```sh
mkdir -p /mnt/user/appdata/fieldwork
chown 99:100 /mnt/user/appdata/fieldwork
docker compose pull
```

The build context excludes local databases, backups, binaries, dependencies and
secrets. The image runs without root and uses the pinned Python constraints and
frontend lockfile. It serves its corresponding application source download in the
existing footer; Stockfish is installed from Debian's package repository, with
its license at `/usr/share/doc/stockfish/copyright` and matching Debian source
packages available from that distribution.

## Start with a fresh database

This deployment starts fresh; no Windows data migration is required.

```sh
docker compose run --rm fieldwork python -m trainer.accounts create-admin YOUR_USERNAME
docker compose up -d
```

The first command prompts for your administrator password. Friends can sign up
normally after passing your existing Cloudflare Access gate. Each account can
sign in on multiple devices and save its Chess.com username.

## Registry access

After the first successful publication, GitHub may create the package as private
even though the source repository is public. To allow Unraid to pull without
credentials, open the linked GitHub package settings and change package visibility
to **Public**. This is a one-time owner setting. If keeping the package private,
log Docker into `ghcr.io` on Unraid with a GitHub token with `read:packages` access;
keep that token out of Compose files and Git.

## Optional local build

For development, `docker build -t fieldwork:local .` still builds the same image
from a source checkout. The default Compose deployment uses the published image.

## Attach your proxy

Point your existing proxy at port **8000** and preserve the public `Host` header.
In account mode, `PUBLIC_ORIGIN` must exactly match the HTTPS address used in the browser, with no
path. HTTPS terminates at your proxy; the internal upstream remains HTTP. Secure
session cookies and the explicit public origin work without trusting arbitrary
forwarded headers. Apply your Cloudflare Access policy to that hostname as usual.

The sample publishes only on the Unraid host's loopback interface. If your proxy
container cannot reach host loopback, attach both containers to your existing
Docker network and use `http://fieldwork:8000`, or set `BIND_ADDRESS` to the Unraid
LAN IP and point the proxy at that address. The proxy's container loopback is not
the Unraid host's loopback. Do not expose the origin through an additional router
port-forward that bypasses your existing access gate.

For Unraid's Docker UI, use image `ghcr.io/reldnahc/chesstrainer:latest`, map `/data` to your appdata
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
`docker compose pull` followed by `docker compose up -d`; the appdata mount
preserves accounts and progress. Back up before schema upgrades. See
[ACCOUNTS.md](ACCOUNTS.md) for session behavior and account recovery.

To pin a known build, set `IMAGE_TAG` to its full Git commit SHA. Retained image
versions let you choose an earlier application build; restoring an older database
schema may also require its matching backup. In Unraid's Docker UI, use Check for
Updates / Update after a successful publish, as with the speech services.
