import { useEffect, useRef, useState } from "react";
import { api, read, type Schema } from "./api";
import Link from "./Link";
import { pagePaths } from "./navigation";

type Sync = Schema["SyncStatus"];
type Provider = Schema["GameProvider"];
const running = (value?: Sync) => !!value && ["queued", "running"].includes(value.status);
const path = (provider: string) => ({ path: { provider } });

function Connection({ provider, status, save, busy }: {
  provider: Provider; status?: Sync; save: (provider: string, name: string) => Promise<void>; busy: boolean;
}) {
  const [name, setName] = useState(status?.username || "");
  // Polling must not overwrite an unfinished username edit.
  useEffect(() => { setName(status?.username || ""); }, [status?.username]);
  return <section className="panel game-sync" aria-label={`Recent ${provider.name} games`}>
    <h3>{provider.name}</h3>
    {status?.username && <strong>{status.username}</strong>}
    <details open={status?.username ? undefined : true}>
      <summary>{status?.username ? `Change ${provider.name} connection` : `Connect your ${provider.name} games`}</summary>
      <form className="sync-form" onSubmit={event => { event.preventDefault(); void save(provider.id, name); }}>
        <label>Remembered {provider.name} username
          <input disabled={!status || busy} value={name} onChange={event => setName(event.target.value)} maxLength={50} pattern="[A-Za-z0-9_-]*" autoComplete="off" placeholder={`Your ${provider.name} username`} />
        </label>
        <button disabled={!status || busy}>Save username</button>
      </form>
      <p className="small">Clear the username to disconnect.</p>
    </details>
    {status?.username && <p role="status">{running(status) ? `Checking ${provider.name}…` : status.status === "completed" ? `Last sync: ${status.imported} new ${status.imported === 1 ? "game" : "games"}` : "Ready to check for new games"}</p>}
    {status?.error && <p role="alert" className="notice error">{status.error}</p>}
  </section>;
}

export default function GameSync({ onChanged, compact = false }: { onChanged?: () => void; compact?: boolean }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Sync>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const callback = useRef(onChanged);
  callback.current = onChanged;
  const versions = useRef<Record<string, string>>({});
  const generation = useRef(0);
  const inFlight = useRef<number | null>(null);
  const edits = useRef<Record<string, number>>({});
  function update(value: Sync, token: number) {
    if (generation.current !== token) return;
    setStatuses(previous => ({ ...previous, [value.provider]: value }));
    const version = `${value.job_id}:${value.checked_at}:${value.imported}:${value.status}`;
    if (version !== versions.current[value.provider] && value.job_id) callback.current?.();
    versions.current[value.provider] = version;
  }
  async function check(items: Provider[], token: number, refresh: boolean) {
    if (inFlight.current === token) return;
    inFlight.current = token;
    try {
      for (const provider of items) {
        if (generation.current !== token) return;
        const revision = edits.current[provider.id];
        let value = await read(api.GET("/api/providers/{provider}/sync", { params: path(provider.id) }));
        if (generation.current !== token) return;
        if (edits.current[provider.id] !== revision) continue;
        update(value, token);
        if (refresh && value.username && !running(value)) {
          value = await read(api.POST("/api/providers/{provider}/sync", { params: path(provider.id) }));
          if (edits.current[provider.id] === revision) update(value, token);
        }
      }
    } finally { if (inFlight.current === token) inFlight.current = null; }
  }
  useEffect(() => {
    const token = ++generation.current;
    let items: Provider[] = [];
    const tick = () => {
      if (document.visibilityState === "hidden" || generation.current !== token) return;
      void check(items, token, true).catch(e => { if (generation.current === token) setError(e.message); });
    };
    read(api.GET("/api/game-providers")).then(async value => {
      if (generation.current !== token) return;
      items = value;
      setProviders(value);
      await check(value, token, document.visibilityState !== "hidden");
    }).catch(e => { if (generation.current === token) setError(e.message); })
      .finally(() => { if (generation.current === token) setLoading(false); });
    const timer = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      generation.current++;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  async function refresh() {
    const token = generation.current;
    setBusy(true); setError("");
    try { await check(providers, token, true); }
    catch (e) { if (generation.current === token) setError((e as Error).message); }
    finally { if (generation.current === token) setBusy(false); }
  }
  async function save(provider: string, name: string) {
    const token = generation.current;
    setBusy(true); setError("");
    edits.current[provider] = (edits.current[provider] || 0) + 1;
    try {
      const saved = await read(api.PUT("/api/providers/{provider}/connection", { params: path(provider), body: { username: name.trim() } }));
      if (generation.current !== token) return;
      update(saved, token);
      if (saved.username) update(await read(api.POST("/api/providers/{provider}/sync", { params: path(provider) })), token);
    } catch (e) { if (generation.current === token) setError((e as Error).message); }
    finally { if (generation.current === token) setBusy(false); }
  }
  const connected = Object.values(statuses).some(value => value.username);
  const checking = Object.values(statuses).some(running);
  const button = <button className="secondary" disabled={loading || busy || checking} onClick={refresh}>{busy || checking ? "Updating…" : "Update games"}</button>;
  if (compact) return <div className="game-sync-compact">
    {!loading && !connected ? <Link className="button-link secondary" href={pagePaths.Settings} title="Set up game imports in Settings">Update games</Link> : button}
    {(error || Object.values(statuses).find(value => value.error)?.error) && <span role="alert" className="small">{error || Object.values(statuses).find(value => value.error)?.error}</span>}
  </div>;
  return <section aria-label="Connected game accounts">
    <div className="row-between"><h2>Connected accounts</h2>{connected && button}</div>
    <p className="small">Your latest 50 completed games per site from the last two months. Checks run while this page is visible, at most once a minute. Fetching games does not run engine analysis.</p>
    <div className="provider-connections">{providers.map(provider => <Connection key={provider.id} provider={provider} status={statuses[provider.id]} save={save} busy={busy} />)}</div>
    {error && <p role="alert" className="notice error">{error}</p>}
  </section>;
}
