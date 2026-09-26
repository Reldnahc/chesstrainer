import { useState } from "react";
import { post, type Health } from "./api";
import PageTitle from "./PageTitle";
import GameSync from "./GameSync";
import { AccountSettings } from "./AccountGate";

export default function SettingsScreen({ health, fail }: { health: Health | null; fail: (e: unknown) => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"classify" | "deepen" | null>(null);
  async function classify(enrich = false) {
    setBusy(enrich ? "deepen" : "classify");
    setMessage("");
    try {
      await post(enrich ? "/classifications/enrich" : "/classifications/retry");
      setMessage(enrich
        ? "Additional analysis queued for unclear training positions. Follow progress in Import."
        : "Training labels queued. Follow progress in Import.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }
  return <>
    <PageTitle eyebrow="YOUR WORKSPACE" title="Settings" description="Your account, connected games and training." />
    <AccountSettings />
    <GameSync />
    <section className="panel settings-panel">
      <h2>Training</h2>
      <p>Refresh the patterns found in your saved games, or take another look at unclear training positions.</p>
      <div className="button-row">
        <button className="secondary" disabled={!!busy} onClick={() => classify()}>
          {busy === "classify" ? "Queuing…" : "Classify saved games"}
        </button>
        <button className="secondary" disabled={!!busy || !health?.engine_available} onClick={() => classify(true)}>
          {busy === "deepen" ? "Queuing…" : "Deepen unclear positions"}
        </button>
      </div>
      {message && <p className="setting-message" role="status">{message}</p>}
    </section>
    <p className="settings-source small">
      Fieldwork is open source. <a href="/assets/fieldwork-source.zip" download>Download source code</a> (GPL/AGPL).
    </p>
  </>;
}
