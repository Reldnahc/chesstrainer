import { RotateCcw } from "lucide-react";
import type { CoachPerformanceSnapshot } from "../performanceDiagnostics";

type Props = {
  natural: boolean;
  onNatural: (value: boolean) => void;
  diagnostic: boolean;
  onDiagnostic: (value: boolean) => void;
  seed: string;
  onSeed: (value: string) => void;
  appliedSeed?: number;
  onRestart: () => void;
  snapshot: CoachPerformanceSnapshot | null;
};

function remaining(at: number, deadline: number | null) {
  return deadline === null ? "—" : `${Math.max(0, Math.round(deadline - at))} ms`;
}

function MotionDiagnostics({ snapshot }: { snapshot: CoachPerformanceSnapshot | null }) {
  const diagnostics = snapshot?.diagnostics;
  const next = snapshot?.nextAt ?? null;
  return (
    <section
      className="studio-motion-diagnostics"
      aria-label="Motion diagnostics"
      data-identity={snapshot?.identity ?? ""}
      data-expression={snapshot?.expression ?? ""}
      data-phase={snapshot?.phase ?? ""}
      data-face={snapshot?.face ?? ""}
      data-paused={snapshot?.paused ?? ""}
      data-active={snapshot?.active.map(({ gesture }) => gesture.id).join(" ") ?? ""}
      data-next-ms={snapshot && next !== null ? Math.max(0, Math.round(next - snapshot.at)) : ""}
    >
      {snapshot ? (
        <>
          <p className="studio-motion-source">Selected portrait · {snapshot.identity} · {snapshot.expression}</p>
          <dl className="studio-motion-summary">
            <div><dt>Lifecycle</dt><dd>{snapshot.phase} · {snapshot.face}</dd></div>
            <div><dt>Playback</dt><dd>{snapshot.paused ?? "running"}</dd></div>
            <div><dt>Next event</dt><dd>{remaining(snapshot.at, next)}</dd></div>
            <div><dt>Eye deadline</dt><dd>{remaining(snapshot.at, diagnostics?.blinkDueAt ?? null)}</dd></div>
          </dl>
          <p className="studio-motion-active">
            <strong>Active</strong>{" "}
            {snapshot.active.length ? snapshot.active.map(({ gesture }) => (
              <span key={gesture.id}>
                {gesture.id} <small>({gesture.tracks.map(({ channel }) => channel).join(", ")})</small>
              </span>
            )) : "No active gesture"}
          </p>
          <p className="studio-motion-history">
            <strong>Recent</strong>{" "}
            {diagnostics?.recent.length ? diagnostics.recent.join(" → ") : "No automatic gestures yet"}
          </p>
          <details className="studio-motion-details">
            <summary>Scheduling details{diagnostics?.issues.length ? ` · ${diagnostics.issues.length} issues` : ""}</summary>
            <div className="studio-motion-tables">
              <div>
                <h3>Gesture cooldowns</h3>
                {diagnostics ? (
                  <dl>{diagnostics.cooldowns.map(({ id, readyAt }) => (
                    <div key={id}><dt>{id}</dt><dd>{readyAt <= snapshot.at ? "Ready" : remaining(snapshot.at, readyAt)}</dd></div>
                  ))}</dl>
                ) : <p>No scheduler frame while paused.</p>}
              </div>
              <div>
                <h3>Skipped candidates</h3>
                {diagnostics?.rejected.length ? (
                  <dl>{diagnostics.rejected.map(({ id, reason }) => (
                    <div key={id}><dt>{id}</dt><dd>{reason}</dd></div>
                  ))}</dl>
                ) : <p>No candidates rejected in this frame.</p>}
              </div>
            </div>
            {!!diagnostics?.issues.length && (
              <ul className="studio-motion-issues">
                {diagnostics.issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )}
            <p className="studio-motion-caption">Times are relative to the last scheduler event, not a live countdown.</p>
          </details>
        </>
      ) : <p>Waiting for the selected portrait.</p>}
    </section>
  );
}

export default function IdlePlayback({
  natural, onNatural, diagnostic, onDiagnostic, seed, onSeed, appliedSeed,
  onRestart, snapshot,
}: Props) {
  const value = Number(seed);
  const validSeed = seed.trim() !== "" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
  return (
    <section className="studio-playback" aria-label="Natural idle controls">
      <div className="studio-playback-controls">
        <label className="studio-toggle">
          <input type="checkbox" checked={natural} onChange={(event) => onNatural(event.target.checked)} />
          Natural idle playback
        </label>
        <label className="studio-toggle">
          <input type="checkbox" checked={diagnostic} onChange={(event) => onDiagnostic(event.target.checked)} />
          Show motion diagnostics
        </label>
      </div>
      {diagnostic && (
        <>
          <div className="studio-seed-controls">
            <label>
              Playback seed
              <input type="number" min="0" max="4294967295" step="1" value={seed}
                onChange={(event) => onSeed(event.target.value)} />
            </label>
            <button disabled={!validSeed} onClick={onRestart}
              title="Apply this seed and restart enabled idle previews without replaying the reaction.">
              <RotateCcw size={14} /> Restart idle sequence
            </button>
            <span>{appliedSeed === undefined ? "Random playback" : `Seed ${appliedSeed}`}</span>
          </div>
          <MotionDiagnostics snapshot={snapshot} />
        </>
      )}
    </section>
  );
}
