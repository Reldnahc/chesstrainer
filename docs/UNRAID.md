# Install Fieldwork on Unraid

Optional human-move evidence uses the existing container and app-data mount. The
advanced template fields set its model path and device; its on/off switch,
worker/thread budget and timeout are in Settings → Advanced → Server. Run
`python -m trainer.human_models.setup` in the container Console to explicitly
acquire the pinned weights; see [HUMAN_MODELS.md](HUMAN_MODELS.md) for
measured memory/image costs and offline operation.

Fieldwork is **one container** with the app, Stockfish and one SQLite database.
It needs no external database, Cloudflare or Compose. Everyone signs in with their
own account; the container refuses to start in no-login mode.

## Install

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

## Security

The template keeps a compromised app contained to its own data folder:

- It runs as UID 99 (nobody), never root, with every Linux capability dropped and
  `no-new-privileges`, so a bug in Fieldwork cannot become root in the container.
- The root filesystem is read-only. Only `/data` and a small in-memory `/tmp` are
  writable, so nothing can be planted in the app's code. `--pids-limit` stops a
  runaway or hostile process from exhausting the server.
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

## Behind an HTTPS proxy

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
[Accounts](ACCOUNTS.md#enable-and-migrate) for that and for account recovery.

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

The [Docker settings reference](DOCKER.md#settings) explains each variable, and
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

## Updates and backups

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
refuses to run while they exist), and retain a matching backup if downgrading. See [Docker installation](DOCKER.md) for other hosts or optional Compose.
