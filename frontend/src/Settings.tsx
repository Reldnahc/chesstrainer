import { useEffect, useState } from "react";
import { api, post, type WorkspaceSettings } from "./api";
import { CoverageSummary } from "./Weaknesses";
import PageTitle from "./PageTitle";
import GameSync from "./GameSync";
export default function SettingsScreen({
  fail,
}: {
  fail: (e: unknown) => void;
}) {
  const [data, setData] = useState<WorkspaceSettings | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<WorkspaceSettings>("/settings").then(setData).catch(fail);
  }, [fail]);
  async function classify(enrich = false) {
    setBusy(true);
    try {
      await post(enrich ? "/classifications/enrich" : "/classifications/retry");
      setMessage(
        enrich
          ? `Extra Stockfish evidence queued for up to ${data!.classification_probe_positions} unclear positions. Watch progress in Import.`
          : "Local classification queued. Watch progress in Import. Saved results are reused.",
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="LOCAL CONFIGURATION"
        title="Settings"
        description="Your engine, practice preferences and local workspace."
      />
      <GameSync />
      {data && (
        <div className="settings-grid">
          <section className="panel settings-panel">
            <h2>Chess analysis</h2>
            <p className="setting-summary">
              <span
                className={`status-dot ${data.engine_available ? "" : "unavailable"}`}
              />
              {data.engine_available
                ? data.engine_version
                : "Engine unavailable"}
            </p>
            {data.engine_error && (
              <p className="error-text">{data.engine_error}</p>
            )}
            <details>
              <summary>Engine configuration</summary>
              <dl>
                <dt>Engine path</dt>
                <dd className="mono">{data.stockfish_path}</dd>
                <dt>Resources</dt>
                <dd>
                  {data.stockfish_workers} workers / {data.stockfish_threads}{" "}
                  threads / {data.stockfish_hash_mb} MB hash each
                </dd>
                <dt>Triage / deeper limits</dt>
                <dd>
                  {data.triage_time}s / {data.deep_time}s
                </dd>
                <dt>Candidate lines</dt>
                <dd>{data.multipv}</dd>
              </dl>
            </details>
          </section>
          <section className="panel settings-panel">
            <h2>Training policy</h2>
            <dl className="setting-overview">
              <dt>Target rapid rating</dt>
              <dd>{data.target_rating}</dd>
              <dt>Answer policy</dt>
              <dd>{data.acceptance_mode}</dd>
              <dt>Retire positions after</dt>
              <dd>Over {data.retire_after_days} days between reviews</dd>
            </dl>
            <details>
              <summary>Grading & scheduling</summary>
              <dl>
                <dt>Practical tolerance</dt>
                <dd>{data.practical_tolerance_cp} centipawns</dd>
                <dt>Slow answer threshold</dt>
                <dd>{data.slow_answer_seconds} seconds</dd>
                <dt>FSRS retention target</dt>
                <dd>{Math.round(data.desired_retention * 100)}%</dd>
              </dl>
              <p className="small muted">
                Existing exercises retain their answer policy. Successful
                recalls build longer intervals until a position retires.
              </p>
            </details>
          </section>
          <section className="panel settings-panel">
            <h2>Local mistake classification</h2>
            <p>
              Patterns verified from engine lines and chess rules, on your
              computer.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => classify()}
            >
              {busy ? "Queuing classification..." : "Classify saved games"}
            </button>
            <button
              className="secondary"
              disabled={busy || !data.engine_available}
              onClick={() => classify(true)}
            >
              Deepen unclear positions
            </button>
            <p className="small">
              Optional: up to {data.classification_probe_positions} positions
              and {data.classification_probe_queries} searches per position, at
              most {data.classification_probe_time}s each. Resolves unfinished
              lines and checks specific defenses. Completed work is reused.
            </p>
            {data.coverage && <CoverageSummary data={data.coverage} />}{" "}
            {message && (
              <p className="setting-message" role="status">
                {message}
              </p>
            )}
            <details>
              <summary>Classification details</summary>
              <dl>
                <dt>Rule version</dt>
                <dd>{data.classification_version}</dd>
                <dt>Workers</dt>
                <dd>{data.classification_workers}</dd>
                <dt>Saved runs</dt>
                <dd>{data.classification_runs}</dd>
                <dt>Historical abstentions</dt>
                <dd>{data.classification_abstained}</dd>
                <dt>Failed / rejected</dt>
                <dd>
                  {data.classification_failed} / {data.classification_rejected}
                </dd>
              </dl>
              <p className="small">
                Unclear causes stay unclassified. Supported labels include mate
                transitions, material consequences and specific tactical
                patterns.
              </p>
            </details>
          </section>
          <section className="panel settings-panel">
            <h2>Workspace</h2>
            <p className="small">
              <a href="/assets/fieldwork-source.zip" download>
                Download source code
              </a>{" "}
              (GPL/AGPL, including the Lichess tactical tagger).
            </p>
            <p>Games, reviews and progress are saved on your host computer.</p>
            <details>
              <summary>Storage & connection</summary>
              <dl>
                <dt>Database</dt>
                <dd className="mono">{data.database_path}</dd>
                <dt>LAN token</dt>
                <dd>
                  {data.lan_token_configured ? "Required" : "Not configured"}
                </dd>
              </dl>
              <p className="small">
                Back up with{" "}
                <code>python scripts/backup.py export backup.zip</code>. Secrets
                are excluded.
              </p>
              <p className="small">
                Open the host's LAN address from devices on the same network. Do
                not expose the app directly to the public internet.
              </p>
            </details>
            <details>
              <summary>How to change settings</summary>
              <p className="small">
                Edit .env on the host computer, then restart the backend. These
                settings are read-only here.
              </p>
            </details>
          </section>
        </div>
      )}
    </>
  );
}
