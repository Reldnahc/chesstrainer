# Install Fieldwork

The image includes an optional CPU human-model runtime. Weights are installed only
by the explicit host command in [human move evidence](REVIEW_INTELLIGENCE.md#human-move-evidence), then cached in
the `/data` mount. Stockfish-only review works before setup. No extra
container, database or GPU is required.

One container includes the web app and native Stockfish. Account, chess and
practice data lives in `/data/trainer.sqlite3`; optional reproducible model files
live in `/data/models`. No external database or engine service is required.
Unraid users can use the [template](#unraid) instead.

## Optional GPU for Maia

The image runs Maia on CPU and downloads nothing extra. To use an NVIDIA GPU,
install the NVIDIA Container Toolkit on the host, pass the GPU
(`docker run --gpus all ...`, or the commented `deploy` block in `compose.yaml`)
and set `HUMAN_MODEL_DEVICE=cuda`. The first start then downloads CUDA PyTorch
(about 3 GB to download, 6.4 GB on disk) into `/data/runtime` before the server starts, which can take a few
minutes and outlasts the health check's start period; later starts reuse it. See
[human move evidence](REVIEW_INTELLIGENCE.md#human-move-evidence).

## Run on your network

```sh
docker run -d --name fieldwork --restart unless-stopped --init \
  --read-only --tmpfs /tmp:rw,nosuid,nodev,size=256m --pids-limit 1024 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -p 18000:8000 -v fieldwork-data:/data \
  ghcr.io/reldnahc/chesstrainer:latest
docker exec -it fieldwork python -m trainer.accounts create-admin YOUR_USERNAME
```

Open `http://HOST-LAN-IP:18000` and sign in. The container always requires sign-in:
it refuses to start with `ACCOUNTS_ENABLED=false`, because the no-login workspace
lets anyone who can reach it use the app. That mode runs only from source, for
development. Plain HTTP sign-in works at the LAN address from devices on that
network; anything reachable from the internet belongs behind HTTPS (below). To restrict
access to the host computer, use `-p 127.0.0.1:18000:8000` instead. Multiline
commands use POSIX shell syntax; in PowerShell use one line.

The extra options are optional but recommended: the app writes only to `/data` and
`/tmp`, needs no Linux capabilities, and must never be given the Docker socket,
privileged mode or other host folders. See [Unraid security](#security)
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
optional. The LAN address keeps working over plain HTTP for devices on your network.

Writes are accepted only from the address the browser sent the request to, so the
proxy must preserve Host. If your proxy rewrites Host (some Cloudflare Tunnel
setups do), set `PUBLIC_ORIGIN` to the exact browser address; the LAN address keeps working too.

An install that used the old no-login default stops at startup after updating. Set
`ACCOUNTS_ENABLED=true` (or remove the variable), create an administrator, and move
the old workspace's games to an account with `claim-local`. See
[Accounts](ADMINISTRATION.md#enable-and-migrate) for that and for recovery.

## Settings

Only the settings that must exist before the database opens, or that guard
access, are container variables. Engine slots, threads, hash and workers, the
human-model switch, threads, workers and timeout, review refinement, and sync,
puzzle and import tuning are stored in the database and set in **Settings →
Advanced → Server**, which can also restart the container's server. The Unraid
template and `compose.yaml` no longer ship them; a matching environment variable
still works, but only seeds a setting the database does not have yet. See
[stored server settings](ADMINISTRATION.md#stored-server-settings).

| Variable | Image default | Meaning |
| --- | --- | --- |
| `ACCOUNTS_ENABLED` | `true` | Must stay `true` in the container; the no-login workspace runs only from source. |
| `PUBLIC_ORIGIN` | empty | Optional. Blank accepts writes from the address the browser used. Set the exact HTTP(S) browser address, including nonstandard port and no path, only when a proxy rewrites Host. |
| `SESSION_SECURE` | `true` | HTTPS-only account cookies, except plain HTTP at a LAN address from a LAN device. Set false only for local development. |
| `DATABASE_PATH` | `/data/trainer.sqlite3` | Persistent SQLite file; normally keep unchanged. |
| `COURSES_PATH` | empty | The club's Study course files. Blank uses `/data/courses`, beside the database; normally keep unchanged. |
| `STOCKFISH_PATH` | `/usr/games/stockfish` | Bundled engine binary; normally keep unchanged. |
| `SERVER_HOST` | `0.0.0.0` | Bind inside the container; Docker's published address controls host exposure. |
| `SERVER_PORT` | `8000` | Internal container port; the image health check follows it. Normally change the published host port instead. |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Proxy addresses trusted for `X-Forwarded-For`. Set to your reverse proxy so sign-in limits apply per visitor. |
| `PROVIDER_USER_AGENT` | Fieldwork identification | Optional identification for public Chess.com and Lichess API calls (`CHESSCOM_USER_AGENT` still works); no password needed. |
| `LAN_ACCESS_TOKEN` | empty | Source installs only: optional shared token for the no-login workspace. |
| `ALLOWED_HOSTS` | empty | Source installs only: extra host names the API answers to. LAN IP addresses, localhost, short names and `.local`/`.lan` names need no entry. |

In Settings → Advanced → Server, shared engine slots times threads per engine
bounds native search threads in account mode; slots times hash per engine estimates
search-table RAM, plus app/engine overhead.
CPU pinning determines where work can run; these settings determine how much work is
scheduled. Defaults do not auto-scale with pinning. Signup runs no analysis. Every
saved game is analyzed in the background, newest first; opening a game moves its
review to the front. For faster
reviews on a host with available CPUs, raise the engine workers there (up to 16) while
budgeting engine slots, threads and memory together. Use only one app instance/Uvicorn
worker per database.

See [human-model setup/resources](REVIEW_INTELLIGENCE.md#human-move-evidence) and
[targeted review budgets](REVIEW_INTELLIGENCE.md#targeted-review-investigation) for advanced limits, cache identity
and cancellation. Ordinary users choose their coach in Settings; administrators set
these limits in Settings → Advanced → Server.

## Optional Compose

Compose launches the same single container. Copy `compose.yaml` and run
`docker compose up -d`. Defaults use a named volume, host port 18000 and accounts with
sign-in. In an adjacent `.env` file, set `BIND_ADDRESS=127.0.0.1` for a host-based proxy. Never commit `.env` files.

`APP_PORT` sets the host port; `IMAGE_TAG` chooses a published tag. `APPDATA_PATH`
can replace the named volume with an absolute bind path, writable by `PUID:PGID`
(default 1000:1000). Compose applies those values to `user`; they are not image
entrypoint variables. Engine defaults match the image.

## Maintenance

Main-branch pushes and manual publishing first run the reusable correctness
workflow against the exact commit being released. Backend checks, frontend build
and browser tests, and the Docker installation smoke test must all pass before
the publishing job can log in to GHCR or push an image. Pull requests run the same
checks without publishing; other branch pushes start no run. Only the publishing job
receives package-write permission.
Every third-party action is pinned to a full commit hash, with its version in a
comment, so a moved tag cannot change what the release job runs; Dependabot
proposes updates weekly (`.github/dependabot.yml`).

`latest` tracks validated builds; a published full Git SHA pins a build. Recreate
the container with the same volume/settings after pulling an update, or use
`docker compose pull` then `docker compose up -d`. Back up before schema upgrades.
Removing a container preserves named volumes unless you explicitly delete them.
Read logs with `docker logs fieldwork`. Invalid configuration produces an explanatory
startup error; with `PUBLIC_ORIGIN` set, origin mismatch responses identify that address to open.
See [Unraid troubleshooting](#settings-and-troubleshooting).

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

## Unraid

Optional human-move evidence uses the same container and app-data mount. The
advanced template fields set its model path and device; its on/off switch,
worker/thread budget and timeout are in Settings → Advanced → Server. Run
`python -m trainer.human_models.setup` in the container Console to explicitly
acquire the pinned weights; see [human move evidence](REVIEW_INTELLIGENCE.md#human-move-evidence) for
memory/image costs and offline operation.

Fieldwork is **one container** with the app, Stockfish and one SQLite database.
It needs no external database, Cloudflare or Compose. Everyone signs in with their
own account; the container refuses to start in no-login mode.

### Install

1. Download [fieldwork.xml](../unraid/fieldwork.xml) from the revision you are installing.
   Copy it to `/boot/config/plugins/dockerMan/templates-user/my-fieldwork.xml`.
   Do not overwrite an existing customized template.
2. Keep it off your LAN (recommended): copy [isolate-lan.sh](../unraid/isolate-lan.sh)
   to the server and run `bash isolate-lan.sh` in the Unraid terminal. Add it to the
   **User Scripts** plugin set to **At Startup of Array**, because firewall rules
   are lost on reboot. See [Security](#security).
3. Open **Docker → Add Container**, select **fieldwork**, and choose **Web port**
   (default 18000) and **App data**. If you ran the script, set **Network Type** to
   `fieldwork`. Keep **Secure session cookies** (advanced) true: sign-in over plain
   `http://` already works at the server's LAN address from devices on your LAN.
4. Apply, then enable **Autostart** in the Docker list.
5. Create your administrator in the Unraid terminal. The command prompts for a password:

   ```sh
   docker exec -it fieldwork python -m trainer.accounts create-admin YOUR_USERNAME
   ```

6. Click the container icon → **WebUI** and sign in.

Every setting has a description. Engine slots, threads, hash and workers, the
human-model switch, threads, workers and timeout, and review refinement are not
template fields: after signing in as an administrator, set them in **Settings →
Advanced → Server** and apply them with **Restart server**. Templates saved before
this change may still list them; an old value seeds the setting only the first
time, so you can delete those fields.
This is a repository-supplied template, not a Community Applications listing.
It follows Unraid's [official example](https://github.com/unraid/unraid-community-apps-starter/blob/main/templates/example-app.xml)
and [documented template location](https://docs.unraid.net/community-applications/).

The template runs as UID 99/GID 100. Existing appdata must be writable by that user.
For a new folder, run in the Unraid terminal if necessary:

```sh
mkdir -p /mnt/user/appdata/fieldwork
chown 99:100 /mnt/user/appdata/fieldwork
```

For manual Add Container, use `ghcr.io/reldnahc/chesstrainer:latest`, the `fieldwork`
network (or Bridge), map host port 18000 to container port 8000, and map your appdata
folder to `/data`.
In Advanced View set WebUI to `http://[IP]:[PORT:8000]` and Extra Parameters to
`--init --user 99:100 --security-opt no-new-privileges:true --cap-drop ALL --read-only --tmpfs /tmp:rw,nosuid,nodev,size=256m --pids-limit 1024 --stop-timeout 90`.
Keep privileged mode off. PUID/PGID environment variables alone do not change this
image's user; the `--user` option does.

### Security

The template keeps a compromised app contained to its own data folder:

- It runs as UID 99 (nobody), never root, with every Linux capability dropped and
  `no-new-privileges`, so a bug in Fieldwork cannot become root in the container.
- The root filesystem is read-only. Only `/data` and a small in-memory `/tmp` are
  writable, so nothing can be planted in the app's code. `--pids-limit` stops a
  runaway or hostile process from exhausting the server. SQLite's temporary files
  go to `/data`, since compacting the database can need more room than `/tmp` has.
- **App data** is the only host folder it sees. Do not add other path mappings
  (especially `/mnt/user` or a share), never map `/var/run/docker.sock`, and keep
  **Privileged** off. Any of these would hand the server to whoever controls the app.
- Everyone must sign in. The no-login workspace would let anyone who reaches the
  port use the app, so it runs only from source, for development.

On the default Bridge network the container can open connections to your LAN,
including the Unraid web interface, SSH, SMB shares and other containers. Fieldwork
needs the internet (Chess.com, Lichess, model downloads) but nothing on your LAN.
[isolate-lan.sh](../unraid/isolate-lan.sh) creates the `fieldwork` network and
firewall rules that drop every new connection from it to the server and to private
addresses (except DNS to the server's own resolvers). Visitors and your reverse
proxy can still connect in, because replies are not new connections. Run
`bash isolate-lan.sh remove` to delete the rules. Keep a strong Unraid root password
either way.

Publish Fieldwork to the internet only through an HTTPS reverse proxy, never by
forwarding the container's port directly.

### Behind an HTTPS proxy

1. Configure your HTTPS proxy to forward to `http://UNRAID-IP:18000` (or your chosen
   host port), preserving the public Host header. The container serves HTTP.
2. Keep **Secure session cookies** true. Leave **Public origin** (advanced) blank
   unless your proxy rewrites the Host header.
3. Optionally change **WebUI** in Advanced View to your HTTPS address.
4. Apply and open the HTTPS address with the administrator you created. Sign-ups
   start closed: add members in Settings → Account with a temporary password, or
   open sign-ups there. Each account's saved games are analyzed in the background.

Cloudflare Access is optional and independent of the app login. If used, apply its
policy before exposing the proxy. Without Access, only people you add (or anyone,
once you open sign-ups) can get an account. Sign-ups never grant administrator privileges;
to make an account that already signed up an administrator, promote it instead:

```sh
docker exec fieldwork python -m trainer.accounts promote YOUR_USERNAME
```

An install that used the old no-login default stops at startup after updating, with
a log message saying so. Set **Account support** to true, create an administrator,
and move the old workspace's games to an account with `claim-local`; see
[Accounts](ADMINISTRATION.md#enable-and-migrate) for that and for account recovery.

### Optional GPU for Maia

Maia runs on the CPU by default and the image downloads nothing extra. To run it
on an NVIDIA GPU instead:

1. Install the **Nvidia Driver** plugin from Community Applications, reboot if it
   asks, and copy your GPU's UUID (`GPU-...`) from its settings page.
2. Edit the container. In Advanced View add `--runtime=nvidia` to the end of
   **Extra Parameters**.
3. Set **Human model device** to `cuda` and **NVIDIA visible devices** to the UUID
   (or `all`). Leave **NVIDIA driver capabilities** at `compute,utility`.
4. Apply. The first start downloads CUDA PyTorch 2.8.0 (about 3 GB, 6.4 GB on disk)
   into `App data/runtime/torch-2.8.0-cu128` before the app starts, so allow a few
   minutes; the log shows `Maia GPU: downloading CUDA PyTorch`. Later starts and
   image updates reuse it.

Set **Human model device** back to `cpu` to stop using the GPU; delete
`App data/runtime` to reclaim the space. The model file itself
(`python -m trainer.human_models.setup`) is the same for CPU and GPU. Switching
devices recomputes saved human-move evidence the next time each game is reviewed.

### Settings and troubleshooting

The [Docker settings reference](INSTALL.md#settings) explains each variable, and
Settings → Advanced → Server holds the engine and review limits with their CPU and
memory budgets. Defaults do not automatically scale with CPU pinning.

| Symptom | What to check |
| --- | --- |
| Container stops right after an update | The log says the container requires `ACCOUNTS_ENABLED=true`: set Account support to true and follow the no-login migration above. |
| Container exits with a Public origin error | Use a full HTTP(S) address without credentials, path, query or fragment, or leave it blank. The startup log explains the error. |
| Sign-in says accounts need HTTPS | Open the server by its LAN address (IP or local name) from a device on your network, or use HTTPS. Public names and outside visitors always need HTTPS. |
| Login says the address does not match | Make the proxy preserve Host, or set Public origin to the exact browser address. With Public origin set, open that address including scheme and port. |
| WebUI opens the wrong address | Use `http://[IP]:[PORT:8000]` on your LAN or your actual HTTPS origin behind a proxy. |
| Database cannot be written | Verify the `/data` mount and UID 99/GID 100 write permissions. Privileged mode is unnecessary. |
| Proxy returns 502 | Check container health and the upstream host port. A proxy container's loopback is not the Unraid host. Forward to the Unraid IP and host port, not the container's own address. |
| Imports fail after isolating the network | Check the container can resolve names; rerun `isolate-lan.sh` after changing the server's DNS servers. |
| Human insights unavailable with `cuda` | Confirm `--runtime=nvidia` in Extra Parameters, the GPU UUID in NVIDIA visible devices, and that the first-start download finished in the log. Set the device back to `cpu` to rule out the GPU. |

### Updates and backups

Use Unraid **Check for Updates / Update**, preserving appdata. Main-branch pushes
publish images; Unraid is not restarted automatically. Replace `latest` with a
published full Git SHA to pin a build. Back up before schema upgrades.

```sh
docker logs --tail=100 fieldwork
docker exec fieldwork python -m trainer.accounts promote FRIEND
docker exec -it fieldwork python -m trainer.accounts reset-password FRIEND
docker exec fieldwork python -m trainer.accounts disable FRIEND
docker exec fieldwork python scripts/backup.py export /data/backup.zip
```

Copy backups off the server; they contain private accounts and sessions. Stop the
app before restoring, never overwrite a live database, remove any leftover
`trainer.sqlite3-wal`/`-shm` files before restoring to the same name (the restore
refuses to run while they exist), and retain a matching backup if downgrading. See [Docker installation](INSTALL.md) for other hosts or optional Compose.
