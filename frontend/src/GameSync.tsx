import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountGate";
import { api, read, type Schema } from "./api";

type Sync = Schema["SyncStatus"];

export default function GameSync({ onChanged }: { onChanged?: () => void }) {
  const account = useAccount();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Sync | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const callback = useRef(onChanged);
  callback.current = onChanged;
  const previous = useRef("");
  const active = useRef(true);
  function update(value: Sync) {
    if (!active.current) return;
    setStatus(value);
    const version = `${value.checked_at}:${value.imported}:${value.status}`;
    if (version !== previous.current && value.job_id) callback.current?.();
    previous.current = version;
  }
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      update(await read(api.POST("/api/sync")));
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!account) return;
    active.current = true;
    let checking = false;
    async function tick() {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const current = await read(api.GET("/api/sync"));
        if (!active.current) return;
        update(current);
        if (current.username && !["queued", "running"].includes(current.status))
          update(await read(api.POST("/api/sync")));
      } catch (e) {
        if (active.current) setError((e as Error).message);
      } finally {
        checking = false;
      }
    }
    read(api.GET("/api/sync"))
      .then((value) => {
        if (!active.current) return;
        setName(value.username);
        update(value);
        if (value.username) void tick();
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        if (active.current) setLoadingProfile(false);
      });
    const timer = window.setInterval(tick, 15000);
    const visible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [account?.id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await read(
        api.POST("/api/auth/profile", {
          body: { chesscom_username: name.trim() },
        }),
      );
      if (name.trim()) update(await read(api.POST("/api/sync")));
      else update(await read(api.GET("/api/sync")));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!account) return null;
  const running = status && ["queued", "running"].includes(status.status);
  return (
    <section className="panel game-sync" aria-label="Recent Chess.com games">
      <h2>Recent Chess.com games</h2>
      {status?.username && (
        <div className="row-between">
          <strong>{status.username}</strong>
          <button disabled={busy || !!running} onClick={refresh}>
            Check for new games
          </button>
        </div>
      )}
      <details open={status?.username ? undefined : true}>
        <summary>
          {status?.username
            ? "Change Chess.com connection"
            : "Connect your Chess.com games"}
        </summary>
        <form onSubmit={save} className="sync-form">
          <label>
            Remembered Chess.com username
            <input
              disabled={loadingProfile}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              pattern="[A-Za-z0-9_-]*"
              autoComplete="off"
              placeholder="Your Chess.com username"
            />
          </label>
          <button disabled={busy || loadingProfile}>Save username</button>
        </form>
        <p className="small">
          Your latest 50 completed games from the last two months. Fetching
          games does not run engine analysis.
        </p>
        <p className="small">
          Checks run while this page is visible, at most once a minute. Clear
          the username to disconnect.
        </p>
      </details>
      {status?.username && (
        <p role="status">
          {running
            ? "Checking Chess.com…"
            : status.status === "completed"
              ? `Last sync: ${status.imported} new ${status.imported === 1 ? "game" : "games"}`
              : "Ready to check for new games"}
          {status.checked_at && (
            <span className="small">
              {" "}
              · {new Date(status.checked_at).toLocaleTimeString()}
            </span>
          )}
        </p>
      )}
      <p className="small">
        New games appear automatically when Chess.com publishes them. Analysis
        starts when you request it.
      </p>
      {(error || status?.error) && (
        <p role="alert" className="notice error">
          {error || status?.error}
        </p>
      )}
    </section>
  );
}
