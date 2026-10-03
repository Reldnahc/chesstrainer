# Install Fieldwork on Unraid

Optional human-move evidence uses the existing container and app-data mount. The
advanced template fields describe its model path, worker/thread budget and
timeout. Run `python -m trainer.human_models.setup` in the container Console to
explicitly acquire the pinned weights; see [HUMAN_MODELS.md](HUMAN_MODELS.md) for
measured memory/image costs and offline operation.

Fieldwork is **one container** with the app, Stockfish and one SQLite database.
Local use requires no external database, reverse proxy, Cloudflare or Compose.

## Install

1. Download [fieldwork.xml](../unraid/fieldwork.xml) from the revision you are installing.
   Copy it to `/boot/config/plugins/dockerMan/templates-user/my-fieldwork.xml`.
   Do not overwrite an existing customized template.
2. Open **Docker → Add Container**, select **fieldwork**, and choose **Web port**
   (default 18000) and **App data**. Leave **Public origin** blank for local use.
3. Apply, then enable **Autostart** in the Docker list.
4. Click the container icon → **WebUI**. It opens your LAN address and selected port.
   There is no login. Everyone who can reach it shares one local workspace.

Every setting has a description. Engine tuning is under advanced settings.
This is a repository-supplied template, not a Community Applications listing.
It follows Unraid's [official example](https://github.com/unraid/unraid-community-apps-starter/blob/main/templates/example-app.xml)
and [documented template location](https://docs.unraid.net/community-applications/).

The template runs as UID 99/GID 100. Existing appdata must be writable by that user.
For a new folder, run in the Unraid terminal if necessary:

```sh
mkdir -p /mnt/user/appdata/fieldwork
chown 99:100 /mnt/user/appdata/fieldwork
```

For manual Add Container, use `ghcr.io/reldnahc/chesstrainer:latest`, Bridge networking,
map host port 18000 to container port 8000, and map your appdata folder to `/data`.
In Advanced View set WebUI to `http://[IP]:[PORT:8000]` and Extra Parameters to
`--init --user 99:100 --security-opt no-new-privileges:true --cap-drop ALL --stop-timeout 90`.
Keep privileged mode off. PUID/PGID environment variables alone do not change this
image's user; the `--user` option does.

## Separate accounts behind HTTPS

1. Configure your HTTPS proxy to forward to `http://UNRAID-IP:18000` (or your chosen
   host port), preserving the public Host header. The container serves HTTP.
2. Set **Public origin** to the exact browser address, such as `https://chess.example.com`,
   without a path. Keep **Account support** and **Secure session cookies** true.
3. Change **WebUI** in Advanced View to that same HTTPS address. This shortcut is
   separate and cannot automatically follow the environment variable.
4. Apply and open the HTTPS address. Users can sign up and use their account on
   multiple devices. Recent-game fetching does not run analysis.

Cloudflare Access is optional and independent of the app login. If used, apply its
policy before exposing the proxy. Do not expose local no-login mode publicly.
Create an administrator from the Unraid terminal when needed:

```sh
docker exec -it fieldwork python -m trainer.accounts create-admin YOUR_USERNAME
```

The command prompts for a password. Signup never grants administrator privileges.
Restart after switching modes. Clearing Public origin opens only the reserved local
workspace, not named accounts; it does not merge their games. See [Accounts](ACCOUNTS.md)
for transferring existing local history and account recovery.

## Optional GPU for Maia

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

## Settings and troubleshooting

The [Docker settings reference](DOCKER.md#settings) explains each variable, defaults
and CPU/memory budgets. Defaults do not automatically scale with CPU pinning.

| Symptom | What to check |
| --- | --- |
| Container exits with a Public origin error | Use a full HTTP(S) address without credentials, path, query or fragment, or leave it blank. The startup log explains the error. |
| HTTP account configuration rejected | Use HTTPS, explicitly set Secure session cookies false for trusted-LAN HTTP accounts, or clear Public origin for no-login mode. |
| Login says the address does not match | Open the configured origin, including scheme and port. Update WebUI too. |
| WebUI opens the wrong address | Use `http://[IP]:[PORT:8000]` for local mode or your actual HTTPS origin for accounts. |
| Database cannot be written | Verify the `/data` mount and UID 99/GID 100 write permissions. Privileged mode is unnecessary. |
| Proxy returns 502 | Check container health and the upstream host port. A proxy container's loopback is not the Unraid host. |
| Human insights unavailable with `cuda` | Confirm `--runtime=nvidia` in Extra Parameters, the GPU UUID in NVIDIA visible devices, and that the first-start download finished in the log. Set the device back to `cpu` to rule out the GPU. |

## Updates and backups

Use Unraid **Check for Updates / Update**, preserving appdata. Main-branch pushes
publish images; Unraid is not restarted automatically. Replace `latest` with a
published full Git SHA to pin a build. Back up before schema upgrades.

```sh
docker logs --tail=100 fieldwork
docker exec -it fieldwork python -m trainer.accounts reset-password FRIEND
docker exec fieldwork python -m trainer.accounts disable FRIEND
docker exec fieldwork python scripts/backup.py export /data/backup.zip
```

Copy backups off the server; they contain private accounts and sessions. Stop the
app before restoring, never overwrite a live database, remove any leftover
`trainer.sqlite3-wal`/`-shm` files before restoring to the same name (the restore
refuses to run while they exist), and retain a matching backup if downgrading. See [Docker installation](DOCKER.md) for other hosts or optional Compose.
