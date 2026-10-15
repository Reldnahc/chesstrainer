import Button from "./Button";
import Banner from "./Banner";
import { RotateCw } from "lucide-react";
import { useRef, useState } from "react";
import { api, errorMessage, read, type Schema } from "./api";
import ActionLink from "./ActionLink";
import { pagePaths } from "./navigation";
import ProviderUsernameField from "./ProviderUsernameField";
import Notice from "./Notice";
import Reveal, { Swap } from "./Reveal";
import { useGameProviders, useServerDraft, type GameProvider } from "./gameProviders";
import { useLatest } from "./useLatest";
import { usePolling } from "./usePolling";
import { QueryResult } from "./useQuery";

type Sync = Schema["SyncStatus"];
type Queue = Schema["AnalysisQueue"];
const running = (value?: Sync) => !!value && ["queued", "running"].includes(value.status);
const path = (provider: string) => ({ path: { provider } });

function Connection({ provider, status, save, busy, onImportOlderGames }: {
  provider: GameProvider; status?: Sync; save: (provider: string, name: string) => Promise<boolean>; busy: boolean;
  onImportOlderGames?: (provider: string) => void;
}) {
  // Polling must not overwrite an unfinished username edit.
  const name = useServerDraft(status?.username);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (await save(provider.id, name.draft)) name.settle(name.draft.trim());
  }
  const form = <form className="sync-form" onSubmit={submit}>
    <ProviderUsernameField providerName={provider.name} label="Username" accessibleLabel={`Remembered ${provider.name} username`}
      disabled={!status || busy} value={name.draft} onChange={name.edit} placeholder={`Your ${provider.name} username`} />
    <Button type="submit" disabled={!status || busy}>Save username</Button>
  </form>;
  return <section className="panel game-sync" aria-label={`Recent ${provider.name} games`}>
    <h3>{provider.name}</h3>
    <Swap>{status?.username ? <div className="stack stack--tight" key="connected">
      <strong className="connection-username">{status.username}</strong>
      <details className="disclosure">
        <summary>Change {provider.name} connection</summary>
        {form}
        <p className="small">Clear the username to disconnect.</p>
      </details>
    </div> : <div key="form">{form}</div>}</Swap>
    <Reveal>{status?.username && <Notice announcement="status" appearance="inline">{running(status) ? `Checking ${provider.name}…` : status.status === "completed" ? `Last sync: ${status.imported} new ${status.imported === 1 ? "game" : "games"}` : "Ready to check for new games"}</Notice>}</Reveal>
    <Reveal>{status?.error && <Notice announcement="alert" tone="error">{status.error}</Notice>}</Reveal>
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
  usePolling(async (signal) => {
    const value = await read(api.GET("/api/analysis/queue", { signal }));
    if (!signal.aborted) setQueue(value);
  }, { intervalMs: 15000 });
  return <Reveal>{queue && <Notice announcement="status" appearance="inline" className="small analysis-queue-status">{queueSummary(queue)}</Notice>}</Reveal>;
}

export default function GameSync({ onChanged, compact = false, setupLabel, onStatusChange, onImportOlderGames }: {
  onChanged?: () => void; compact?: boolean;
  /** Compact only: replaces "Update games" on the link to Settings shown when no account is connected. */
  setupLabel?: string;
  onStatusChange?: (status: Sync) => void;
  onImportOlderGames?: (provider: string) => void;
}) {
  const providers = useGameProviders();
  const [statuses, setStatuses] = useState<Record<string, Sync>>({});
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const callbacks = useLatest({ onChanged, onStatusChange });
  const versions = useRef<Record<string, string>>({});
  const edits = useRef<Record<string, number>>({});
  const refreshNext = useRef(false);
  function update(value: Sync) {
    setStatuses(previous => ({ ...previous, [value.provider]: value }));
    callbacks.current.onStatusChange?.(value);
    const previous = versions.current[value.provider];
    const version = `${value.job_id}:${value.checked_at}:${value.imported}:${value.status}`;
    versions.current[value.provider] = version;
    // The first status is the baseline; after it, only a finished check can change the library.
    if (previous !== undefined && version !== previous && value.job_id && !running(value)) callbacks.current.onChanged?.();
  }
  // One pass reads every provider's status; an explicit Update also asks each
  // connected provider to check now, after any background pass in flight.
  const polling = usePolling(async (signal) => {
    const refresh = refreshNext.current;
    refreshNext.current = false;
    let firstError: unknown = null;
    for (const provider of providers.data ?? []) {
      if (signal.aborted) return;
      try {
        const revision = edits.current[provider.id];
        let value = await read(api.GET("/api/providers/{provider}/sync", { params: path(provider.id), signal }));
        if (signal.aborted) return;
        if (edits.current[provider.id] !== revision) continue;
        update(value);
        if (refresh && value.username && !running(value)) {
          value = await read(api.POST("/api/providers/{provider}/sync", { params: path(provider.id), signal }));
          if (!signal.aborted && edits.current[provider.id] === revision) update(value);
        }
      } catch (e) {
        // Keep checking the other providers; report the first problem afterwards.
        firstError ??= e;
      }
    }
    if (signal.aborted) return;
    setChecked(true);
    if (firstError) {
      setError(errorMessage(firstError));
      throw firstError;
    }
  }, { intervalMs: 15000, enabled: !!providers.data });
  async function refresh() {
    setBusy(true);
    setError("");
    refreshNext.current = true;
    try { await polling.run(); }
    finally { setBusy(false); }
  }
  async function save(provider: string, name: string) {
    setBusy(true);
    setError("");
    edits.current[provider] = (edits.current[provider] || 0) + 1;
    try {
      const saved = await read(api.PUT("/api/providers/{provider}/connection", { params: path(provider), body: { username: name.trim() } }));
      // A poll started while the save was pending may still contain the old
      // username. Invalidate that read before publishing the saved connection.
      edits.current[provider] = (edits.current[provider] || 0) + 1;
      update(saved);
      if (saved.username) update(await read(api.POST("/api/providers/{provider}/sync", { params: path(provider) })));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const loading = !providers.error && !checked;
  const connected = Object.values(statuses).some(value => value.username);
  const checking = Object.values(statuses).some(running);
  const button = <Button variant="secondary" size={compact ? "compact" : undefined} disabled={loading || busy || checking} onClick={refresh}>{compact && <RotateCw size={16} aria-hidden="true" />}{busy || checking ? "Updating…" : "Update games"}</Button>;
  // A request's failure is a page banner, as in Settings; a provider's own sync
  // error is lasting state, so the compact control keeps it beside the button.
  const syncError = Object.values(statuses).find(value => value.error)?.error;
  if (compact) return <div className="game-sync-compact">
    {!loading && !connected ? <ActionLink variant="secondary" size="compact" href={pagePaths.Settings} title="Set up game imports in Settings">{setupLabel ?? <><RotateCw size={16} aria-hidden="true" />Update games</>}</ActionLink> : button}
    <Reveal>{syncError && <Notice announcement="alert" tone="error" appearance="inline" className="small">{syncError}</Notice>}</Reveal>
    {error && <Banner tone="error" onDismiss={() => setError("")}>{error}</Banner>}
    {providers.error && <Banner tone="error" action={<Button size="compact" onClick={providers.retry}>Try again</Button>}>Couldn’t load game connections.</Banner>}
  </div>;
  return <section className="game-connections" aria-label="Connected game accounts">
    <div className="row-between connection-heading"><p className="small connection-description">Fieldwork checks for new games every minute and analyzes each one automatically, newest first. Older imported games are analyzed after your recent ones. Checks pause after a week without visiting.</p>{connected && button}</div>
    {connected && <AnalysisQueueStatus />}
    <QueryResult query={providers} label="game connections">{items =>
      <div className="provider-connections">{items.map(provider => <Connection key={provider.id} provider={provider} status={statuses[provider.id]} save={save} busy={busy} onImportOlderGames={onImportOlderGames} />)}</div>}
    </QueryResult>
    {error && <Banner tone="error" onDismiss={() => setError("")}>{error}</Banner>}
  </section>;
}
