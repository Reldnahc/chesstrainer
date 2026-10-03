import Button from "./Button";
import { useEffect, useRef, useState } from "react";
import { api, read, type Schema } from "./api";
import ActionLink from "./ActionLink";
import { pagePaths } from "./navigation";
import ProviderUsernameField from "./ProviderUsernameField";
import Notice from "./Notice";

type Sync = Schema["SyncStatus"];
type Provider = Schema["GameProvider"];
type Queue = Schema["AnalysisQueue"];
const running = (value?: Sync) => !!value && ["queued", "running"].includes(value.status);
const path = (provider: string) => ({ path: { provider } });

function Connection({ provider, status, save, busy, onImportOlderGames }: {
  provider: Provider; status?: Sync; save: (provider: string, name: string) => Promise<boolean>; busy: boolean;
  onImportOlderGames?: (provider: string) => void;
}) {
  const [name, setName] = useState(status?.username || "");
  const edited = useRef(false);
  // Polling must not overwrite an unfinished username edit.
  useEffect(() => { if (!edited.current) setName(status?.username || ""); }, [status?.username]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (await save(provider.id, name)) {
      edited.current = false;
      setName(name.trim());
    }
  }
  const form = <form className="sync-form" onSubmit={submit}>
    <ProviderUsernameField providerName={provider.name} label="Username" accessibleLabel={`Remembered ${provider.name} username`}
      disabled={!status || busy} value={name} onChange={value => { edited.current = true; setName(value); }} placeholder={`Your ${provider.name} username`} />
    <Button type="submit" disabled={!status || busy}>Save username</Button>
  </form>;
  return <section className="panel game-sync" aria-label={`Recent ${provider.name} games`}>
    <h3>{provider.name}</h3>
    {status?.username ? <>
      <strong className="connection-username">{status.username}</strong>
      <details className="disclosure">
        <summary>Change {provider.name} connection</summary>
        {form}
        <p className="small">Clear the username to disconnect.</p>
      </details>
    </> : form}
    {status?.username && <Notice announcement="status" appearance="inline">{running(status) ? `Checking ${provider.name}…` : status.status === "completed" ? `Last sync: ${status.imported} new ${status.imported === 1 ? "game" : "games"}` : "Ready to check for new games"}</Notice>}
    {status?.error && <Notice announcement="alert" tone="error">{status.error}</Notice>}
    {onImportOlderGames && <div className="connection-actions"><Button variant="secondary" onClick={() => onImportOlderGames(provider.id)}>Import older games</Button></div>}
  </section>;
}

function queueSummary(queue: Queue) {
  const waiting = queue.requested + queue.fresh + queue.backfill;
  const parts = [queue.running ? `Analyzing ${queue.running.white} vs ${queue.running.black}.` : ""];
  if (waiting) parts.push(`${waiting} ${waiting === 1 ? "game" : "games"} waiting (${queue.requested + queue.fresh} recent, ${queue.backfill} older).`);
  if (!queue.running && !waiting) parts.push(queue.completed ? `All ${queue.completed} ${queue.completed === 1 ? "game" : "games"} analyzed.` : "No games to analyze yet.");
  if (queue.failed) parts.push(`${queue.failed} could not be analyzed; open the game to retry.`);
  return parts.filter(Boolean).join(" ");
}

// Every saved game is analyzed in the background; this reports the shared queue.
function AnalysisQueueStatus() {
  const [queue, setQueue] = useState<Queue | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      read(api.GET("/api/analysis/queue")).then(value => { if (active) setQueue(value); }).catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 15000);
    document.addEventListener("visibilitychange", load);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, []);
  return queue ? <Notice announcement="status" appearance="inline" className="small analysis-queue-status">{queueSummary(queue)}</Notice> : null;
}

export default function GameSync({ onChanged, compact = false, onStatusChange, onImportOlderGames }: {
  onChanged?: () => void; compact?: boolean;
  onStatusChange?: (status: Sync) => void;
  onImportOlderGames?: (provider: string) => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Sync>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const callback = useRef(onChanged);
  callback.current = onChanged;
  const statusCallback = useRef(onStatusChange);
  statusCallback.current = onStatusChange;
  const versions = useRef<Record<string, string>>({});
  const generation = useRef(0);
  const inFlight = useRef<number | null>(null);
  const inFlightRun = useRef<Promise<void> | null>(null);
  const edits = useRef<Record<string, number>>({});
  function update(value: Sync, token: number) {
    if (generation.current !== token) return;
    setStatuses(previous => ({ ...previous, [value.provider]: value }));
    statusCallback.current?.(value);
    const version = `${value.job_id}:${value.checked_at}:${value.imported}:${value.status}`;
    if (version !== versions.current[value.provider] && value.job_id) callback.current?.();
    versions.current[value.provider] = version;
  }
  async function check(items: Provider[], token: number, refresh: boolean, explicit = false) {
    if (inFlight.current === token) {
      // A background pass is running. Explicit requests run after it; ticks are dropped.
      if (!explicit || !inFlightRun.current) return;
      await inFlightRun.current;
      if (generation.current !== token) return;
    }
    inFlight.current = token;
    const run = (async () => {
      let firstError: unknown = null;
      try {
        for (const provider of items) {
          if (generation.current !== token) return;
          try {
            const revision = edits.current[provider.id];
            let value = await read(api.GET("/api/providers/{provider}/sync", { params: path(provider.id) }));
            if (generation.current !== token) return;
            if (edits.current[provider.id] !== revision) continue;
            update(value, token);
            if (refresh && value.username && !running(value)) {
              value = await read(api.POST("/api/providers/{provider}/sync", { params: path(provider.id) }));
              if (edits.current[provider.id] === revision) update(value, token);
            }
          } catch (e) {
            // Keep checking the other providers; report the first problem afterwards.
            firstError ??= e;
          }
        }
        if (firstError) throw firstError;
      } finally {
        if (inFlight.current === token) { inFlight.current = null; inFlightRun.current = null; }
      }
    })();
    inFlightRun.current = run;
    await run;
  }
  useEffect(() => {
    const token = ++generation.current;
    let items: Provider[] = [];
    const tick = () => {
      if (document.visibilityState === "hidden" || generation.current !== token) return;
      void check(items, token, false).catch(e => { if (generation.current === token) setError(e.message); });
    };
    read(api.GET("/api/game-providers")).then(async value => {
      if (generation.current !== token) return;
      items = value;
      setProviders(value);
      await check(value, token, false);
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
    try { await check(providers, token, true, true); }
    catch (e) { if (generation.current === token) setError((e as Error).message); }
    finally { if (generation.current === token) setBusy(false); }
  }
  async function save(provider: string, name: string) {
    const token = generation.current;
    setBusy(true); setError("");
    edits.current[provider] = (edits.current[provider] || 0) + 1;
    try {
      const saved = await read(api.PUT("/api/providers/{provider}/connection", { params: path(provider), body: { username: name.trim() } }));
      if (generation.current !== token) return false;
      // A poll started while the save was pending may still contain the old
      // username. Invalidate that read before publishing the saved connection.
      edits.current[provider] = (edits.current[provider] || 0) + 1;
      update(saved, token);
      if (saved.username) update(await read(api.POST("/api/providers/{provider}/sync", { params: path(provider) })), token);
      return generation.current === token;
    } catch (e) { if (generation.current === token) setError((e as Error).message); return false; }
    finally { if (generation.current === token) setBusy(false); }
  }
  const connected = Object.values(statuses).some(value => value.username);
  const checking = Object.values(statuses).some(running);
  const button = <Button variant="secondary" disabled={loading || busy || checking} onClick={refresh}>{busy || checking ? "Updating…" : "Update games"}</Button>;
  if (compact) return <div className="game-sync-compact">
    {!loading && !connected ? <ActionLink variant="secondary" href={pagePaths.Settings} title="Set up game imports in Settings">Update games</ActionLink> : button}
    {(error || Object.values(statuses).find(value => value.error)?.error) && <Notice announcement="alert" tone="error" appearance="inline" className="small">{error || Object.values(statuses).find(value => value.error)?.error}</Notice>}
  </div>;
  return <section aria-label="Connected game accounts">
    <div className="row-between connection-heading"><p className="small connection-description">Fieldwork checks for new games every minute and analyzes each one automatically, newest first. Older imported games are analyzed after your recent ones. Checks pause after a week without visiting.</p>{connected && button}</div>
    {connected && <AnalysisQueueStatus />}
    {loading && providers.length === 0 && <p role="status" className="small">Loading game connections…</p>}
    <div className="provider-connections">{providers.map(provider => <Connection key={provider.id} provider={provider} status={statuses[provider.id]} save={save} busy={busy} onImportOlderGames={onImportOlderGames} />)}</div>
    {error && <Notice announcement="alert" tone="error">{error}</Notice>}
  </section>;
}
