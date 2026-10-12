# Docker installation

The image includes an optional CPU human-model runtime. Weights are installed only
by the explicit host command in [HUMAN_MODELS.md](HUMAN_MODELS.md), then cached in
the existing `/data` mount. Stockfish-only review works before setup. No extra
container, database or GPU is required.

One container includes the web app and native Stockfish. Account, chess and
practice data lives in `/data/trainer.sqlite3`; optional reproducible model files
live in `/data/models`. No external database or engine service is required.
Unraid users can use the [template](UNRAID.md) instead.

## Optional GPU for Maia

The image runs Maia on CPU and downloads nothing extra. To use an NVIDIA GPU,
install the NVIDIA Container Toolkit on the host, pass the GPU
(`docker run --gpus all ...`, or the commented `deploy` block in `compose.yaml`)
and set `HUMAN_MODEL_DEVICE=cuda`. The first start then downloads CUDA PyTorch
(about 3 GB to download, 6.4 GB on disk) into `/data/runtime` before the server starts, which can take a few
minutes and outlasts the health check's start period; later starts reuse it. See
[HUMAN_MODELS.md](HUMAN_MODELS.md).

## Run on your network

```sh
docker run -d --name fieldwork --restart unless-stopped --init \
  --read-only --tmpfs /tmp:rw,nosuid,nodev,size=256m --pids-limit 1024 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -p 18000:8000 -v fieldwork-data:/data -e SESSION_SECURE=false \
  ghcr.io/reldnahc/chesstrainer:latest
docker exec -it fieldwork python -m trainer.accounts create-admin YOUR_USERNAME
```

Open `http://HOST-LAN-IP:18000` and sign in. The container always requires sign-in:
it refuses to start with `ACCOUNTS_ENABLED=false`, because the no-login workspace
lets anyone who can reach it use the app. That mode runs only from source, for
development. `SESSION_SECURE=false` lets sign-in work over plain HTTP on a trusted
LAN; anything reachable from the internet belongs behind HTTPS (below). To restrict
access to the host computer, use `-p 127.0.0.1:18000:8000` instead. Multiline
commands use POSIX shell syntax; in PowerShell use one line.

The extra options are optional but recommended: the app writes only to `/data` and
`/tmp`, needs no Linux capabilities, and must never be given the Docker socket,
privileged mode or other host folders. See [Unraid security](UNRAID.md#security)
for why, and for keeping a public install off your LAN.

The image runs as UID/GID 1000:1000. A fresh named volume inherits `/data` ownership.
For a bind mount, make its directory writable by that user, or select another with
`--user UID:GID`. PUID/PGID variables alone do not change the image's user.

## Shared HTTPS hosting

This example uses a fresh volume. Do not run two instances against one database.

```sh
docker run -d --name fieldwork-shared --restart unless-stopped --init \
  --read-only --tmpfs /tmp:rw,nosuid,nodev,size=256m --pids-limit 1024 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -p 127.0.0.1:18001:8000 -v fieldwork-shared-data:/data \
  ghcr.io/reldnahc/chesstrainer:latest
```

Configure a host-based HTTPS proxy to forward to `http://127.0.0.1:18001`, preserving
Host. For a containerized proxy, attach both containers to the same Docker network
and forward to `http://fieldwork-shared:8000`, or publish to a reachable LAN address.
Another container cannot reach the host through its own loopback address.
Set `FORWARDED_ALLOW_IPS` to the proxy's address (the proxy container's network
address, or `*` on a private Docker network) so the app sees each browser's address;
otherwise every visitor shares the proxy's address for sign-in rate limiting.

Open the configured HTTPS address and create an account. Each account has private
games and progress across devices. Secure cookies are on by default. Cloudflare is
optional. Intentional trusted-LAN HTTP accounts require `SESSION_SECURE=false`.

Writes are accepted only from the address the browser sent the request to, so the
proxy must preserve Host. If your proxy rewrites Host (some Cloudflare Tunnel
setups do), set `PUBLIC_ORIGIN` to the exact browser address instead.

An install that used the old no-login default stops at startup after updating. Set
`ACCOUNTS_ENABLED=true` (or remove the variable), create an administrator, and move
the old workspace's games to an account with `claim-local`. See
[Accounts](ACCOUNTS.md#enable-and-migrate) for that and for recovery.

## Settings

| Variable | Image default | Meaning |
| --- | --- | --- |
| `ACCOUNTS_ENABLED` | `true` | Must stay `true` in the container; the no-login workspace runs only from source. |
| `PUBLIC_ORIGIN` | empty | Optional. Blank accepts writes from the address the browser used. Set the exact HTTP(S) browser address, including nonstandard port and no path, only when a proxy rewrites Host. |
| `SESSION_SECURE` | `true` | HTTPS-only account cookies. Set false to sign in over plain HTTP on a trusted LAN. |
| `ENGINE_SLOTS` | `4` | Account mode's shared limit on simultaneous Stockfish engines and host analysis jobs. One additional worker fetches games without analysis. Worker count is independent of account count; busy requests/jobs wait. |
| `STOCKFISH_THREADS` | `1` | Search threads per engine working on the same position. |
| `STOCKFISH_HASH_MB` | `64` | RAM in MB per engine for temporary search-position tables, not disk storage. |
| `STOCKFISH_WORKERS` | `1` | Concurrent games per training import, or moves within a game review (1–16). Reviews are also capped by `ENGINE_SLOTS`; account mode obeys the shared host-wide pool. |
| `HUMAN_MODEL_ENABLED` | `true` | Permits human-policy inference when the explicitly installed checkpoint exists. Missing weights keep review Stockfish-only, with no download. |
| `HUMAN_MODEL_WORKERS` / `HUMAN_MODEL_THREADS` | `1` / `2` | Host-wide resident Maia workers and CPU threads per worker. Model RAM multiplies with workers; independent of Stockfish slots. |
| `REVIEW_REFINEMENT_POSITIONS` / `REVIEW_REFINEMENT_QUERIES` | `8` / `4` | Maximum positions and additional questions per position after the unchanged full-game baseline. Zero positions disables this extra work. |
| `DATABASE_PATH` | `/data/trainer.sqlite3` | Persistent SQLite file; normally keep unchanged. |
| `COURSES_PATH` | empty | The club's Study course files. Blank uses `/data/courses`, beside the database; normally keep unchanged. |
| `STOCKFISH_PATH` | `/usr/games/stockfish` | Bundled engine binary; normally keep unchanged. |
| `SERVER_HOST` | `0.0.0.0` | Bind inside the container; Docker's published address controls host exposure. |
| `SERVER_PORT` | `8000` | Internal container port; the image health check follows it. Normally change the published host port instead. |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Proxy addresses trusted for `X-Forwarded-For`. Set to your reverse proxy so sign-in limits apply per visitor. |
| `CHESSCOM_USER_AGENT` | Fieldwork identification | Optional identification for public Chess.com API calls; no Chess.com password needed. |
| `LAN_ACCESS_TOKEN` | empty | Source installs only: optional shared token for the no-login workspace. |
| `ALLOWED_HOSTS` | empty | Source installs only: extra host names the API answers to. LAN IP addresses, localhost, short names and `.local`/`.lan` names need no entry. |

In account mode, slots times threads bounds native search threads; slots times hash
MB estimates search-table RAM, plus app/engine overhead.
CPU pinning determines where work can run; these settings determine how much work is
scheduled. Defaults do not auto-scale with pinning. Signup runs no analysis. Every
saved game is analyzed in the background, newest first; opening a game moves its
review to the front. For faster
reviews on a host with available CPUs, raise `STOCKFISH_WORKERS` (up to 16) while
budgeting engine slots, threads and memory together. Use only one app instance/Uvicorn
worker per database.

See [human-model setup/resources](HUMAN_MODELS.md) and
[targeted review budgets](REVIEW_REFINEMENT.md) for advanced limits, cache identity
and cancellation. Ordinary users choose their coach in Settings; infrastructure
controls stay in host configuration.

## Optional Compose

Compose launches the same single container. Copy `compose.yaml` and run
`docker compose up -d`. Defaults use a named volume, host port 18000 and accounts with
sign-in. In an adjacent `.env` file, set `SESSION_SECURE=false` for plain-HTTP LAN use
or `BIND_ADDRESS=127.0.0.1` for a host-based proxy. Never commit `.env` files.

`APP_PORT` sets the host port; `IMAGE_TAG` chooses a published tag. `APPDATA_PATH`
can replace the named volume with an absolute bind path, writable by `PUID:PGID`
(default 1000:1000). Compose applies those values to `user`; they are not image
entrypoint variables. Engine defaults match the image.

## Maintenance

Main-branch pushes and manual publishing first run the reusable correctness
workflow against the exact commit being released. Backend checks, frontend build
and browser tests, and the Docker installation smoke test must all pass before
the publishing job can log in to GHCR or push an image. Other branch pushes and
pull requests run the same checks without publishing. Only the publishing job
receives package-write permission.

`latest` tracks validated builds; a published full Git SHA pins a build. Recreate
the container with the same volume/settings after pulling an update, or use
`docker compose pull` then `docker compose up -d`. Back up before schema upgrades.
Removing a container preserves named volumes unless you explicitly delete them.
Read logs with `docker logs fieldwork`. Invalid configuration produces an explanatory
startup error; with `PUBLIC_ORIGIN` set, origin mismatch responses identify that address to open.
See [Unraid troubleshooting](UNRAID.md#settings-and-troubleshooting).

Build from source with `docker build -t fieldwork:local .`. The image contains its
corresponding source download and license notices. Stockfish is installed from Debian;
its license is at `/usr/share/doc/stockfish/copyright` in the image.

Maintainers can run `python scripts/smoke_install.py --image fieldwork:local` after
building. It creates disposable containers and anonymous volumes, checks that no-login
mode refuses to start, a fresh account install, restart persistence and Stockfish under
the read-only hardening, then cleans them up.
The account check simulates a TLS-terminating proxy through HTTP headers and verifies
secure-cookie flags; it does not provision or test a real TLS certificate. CI runs
this check on builds as well.
