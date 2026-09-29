import Button from "./Button";
import { useEffect, useRef, useState } from "react";
import { api, read, type Schema } from "./api";
import { navigate } from "./navigation";
import ProviderUsernameField from "./ProviderUsernameField";

type Connection = { id: string; name: string; username: string };

export default function Onboarding({ onComplete }: { onComplete: (user: Schema["Account"]) => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    let active = true;
    async function load() {
      const providers = await read(api.GET("/api/game-providers"));
      const values = await Promise.all(providers.map(async provider => {
        const saved = await read(api.GET("/api/providers/{provider}/sync", { params: { path: { provider: provider.id } } }));
        return { id: provider.id, name: provider.name, username: saved.username };
      }));
      if (active) { setConnections(values); setLoading(false); }
    }
    load().catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function next(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      for (const connection of connections) {
        await read(api.PUT("/api/providers/{provider}/connection", {
          params: { path: { provider: connection.id } }, body: { username: connection.username.trim() },
        }));
      }
      setStep(2);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const selected = connections.filter(connection => connection.username.trim());
  async function finish(openImports: boolean) {
    setBusy(true); setError("");
    try {
      const result = await read(api.POST("/api/auth/onboarding/complete"));
      if (openImports) navigate(`/settings?import=${encodeURIComponent(selected[0]?.id || "pgn")}`);
      onComplete(result.user);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <main className="account-entry onboarding">
    <section className="panel" aria-labelledby="onboarding-title">
      <p className="eyebrow">WELCOME TO FIELDWORK · {step} OF 2</p>
      <h1 id="onboarding-title" ref={heading} tabIndex={-1}>{step === 1 ? "Where do you play?" : "Bring in your first games"}</h1>
      {step === 1 ? <>
        <p>Add either username, both, or leave them blank. You can change them in Settings later.</p>
        <form onSubmit={next}>
          {connections.map(connection => <ProviderUsernameField key={connection.id}
            providerName={connection.name} label={`${connection.name} username (optional)`}
            value={connection.username} disabled={busy || loading}
            onChange={username => setConnections(values => values.map(value => value.id === connection.id ? { ...value, username } : value))} />)}
          {loading && <p role="status">Loading connections…</p>}
          <Button type="submit" variant="primary" disabled={busy || loading}>{busy ? "Saving…" : "Continue"}</Button>
        </form>
      </> : <>
        {selected.length ? <>
          <p>Your {selected.map(connection => connection.name).join(" and ")} usernames are saved.</p>
          <ol>
            <li>In <strong>Settings → Games & imports</strong>, choose <strong>Import older games</strong> for your site. Your username is already filled in.</li>
            <li>Choose a time control and date range, then select <strong>Import games</strong>.</li>
            <li>Open a game from <strong>Games</strong> to start its review. Use <strong>Update games</strong> there for your latest games.</li>
          </ol>
        </> : <>
          <p>No connected account needed. Import a PGN—the standard file format for chess games.</p>
          <ol>
            <li>Download or export a PGN from the site or chess app where you played.</li>
            <li>In <strong>Settings → Games & imports → Import PGN</strong>, choose a file or paste its PGN text.</li>
            <li>Enter the player name used in the game, or select your side, then import. Open it from <strong>Games</strong> to review.</li>
          </ol>
        </>}
        <p className="small">Importing saves your games without engine analysis. Review a game when you’re ready, or enable training analysis during import.</p>
        <div className="onboarding-actions">
          <Button variant="primary" disabled={busy} onClick={() => finish(true)}>{busy ? "Finishing…" : "Open imports"}</Button>
          <Button disabled={busy} onClick={() => finish(false)}>Finish for now</Button>
          <Button variant="quiet" disabled={busy} onClick={() => setStep(1)}>Back</Button>
        </div>
      </>}
      {error && <p role="alert" className="notice error">{error}{loading && <Button size="compact" variant="quiet" onClick={() => window.location.reload()}>Retry</Button>}</p>}
    </section>
  </main>;
}
