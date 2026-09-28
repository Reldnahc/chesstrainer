import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, FileUp, Layers } from "lucide-react";
import {
  api,
  read,
  multipart,
  type Health,
  type Job,
  type PgnImportResult,
  type Schema,
} from "./api";
import { ChessComImportForm, ImportJob } from "./ChessComImport";
import GameSync from "./GameSync";
function PgnInput({
  file,
  setFile,
  text,
  setText,
}: {
  file: File | null;
  setFile: (file: File | null) => void;
  text: string;
  setText: (s: string) => void;
}) {
  return (
    <>
      <label className="upload-zone">
        <FileUp size={25} />
        <strong>{file?.name || "Choose a PGN file"}</strong>
        <span>One game or a collection · UTF-8</span>
        <input
          type="file"
          accept=".pgn,text/plain"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <details>
        <summary>Or paste PGN text</summary>
        <label>
          PGN
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={
              '[White "Your username"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 *'
            }
          />
        </label>
      </details>
    </>
  );
}
export default function ImportSettings({
  health,
  fail,
}: {
  health: Health | null;
  fail: (e: unknown) => void;
}) {
  const [source, setSource] = useState<"chesscom" | "pgn">("chesscom");
  const [file, setFile] = useState<File | null>(null),
    [text, setText] = useState("");
  const [names, setNames] = useState(""),
    [side, setSide] =
      useState<NonNullable<Schema["Body_upload_pgn_api_imports_post"]["side"]>>(
        "auto",
      );
  const [jobs, setJobs] = useState<Job[]>([]),
    [result, setResult] = useState<PgnImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [analyze, setAnalyze] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const reload = useCallback(
    () => read(api.GET("/api/jobs")).then(setJobs).catch(fail),
    [fail],
  );
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 2000);
    return () => clearInterval(timer);
  }, [reload]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setResult(
        await read(
          api.POST("/api/imports", {
            body: {
              file: file || new File([text], "pasted-games.pgn"),
              usernames: names,
              side,
              analyze,
            },
            bodySerializer: multipart,
          }),
        ),
      );
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-import" aria-labelledby="settings-import-title">
      <h2 id="settings-import-title">Import games</h2>
      <GameSync onChanged={reload} />
      {health?.engine_status === "unavailable" && (
        <div className="notice">{health.engine_error}</div>
      )}
      <div className="import-source" role="group" aria-label="Game source">
        <button
          aria-pressed={source === "chesscom"}
          onClick={() => setSource("chesscom")}
        >
          Chess.com username
        </button>
        <button
          aria-pressed={source === "pgn"}
          onClick={() => setSource("pgn")}
        >
          PGN file
        </button>
      </div>
      <div className="import-layout">
        <div className="import-form">
          {source === "chesscom" ? (
            <ChessComImportForm onQueued={reload} fail={fail} />
          ) : (
            <form className="panel form-panel" onSubmit={submit}>
              <h2>Import PGN</h2>
              <PgnInput {...{ file, setFile, text, setText }} />
              <label>
                Your username(s)
                <input
                  value={names}
                  onChange={(e) => setNames(e.target.value)}
                  placeholder="Match the White or Black PGN headers"
                  required={side === "auto"}
                />
                <small>
                  Separate multiple usernames with commas. Matching ignores
                  case.
                </small>
              </label>
              <label>
                Learner side
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as typeof side)}
                >
                  <option value="auto">Match my username in each game</option>
                  <option value="white">I played White in every game</option>
                  <option value="black">I played Black in every game</option>
                </select>
              </label>
              <label className="import-analysis-option">
                <input
                  type="checkbox"
                  checked={analyze}
                  onChange={(e) => setAnalyze(e.target.checked)}
                />
                Also analyze these games for training
              </label>
              <button
                className="primary"
                disabled={busy || (!file && !text.trim())}
              >
                {busy ? "Importing…" : "Import & analyze"}
                <ArrowRight size={17} />
              </button>
              {result && (
                <div role="status" className="notice">
                  <span>
                    {result.imported} imported · {result.duplicates}{" "}
                    duplicate(s).
                    {result.errors.map((e, i) => (
                      <p key={i}>
                        Game {e.game}: {e.error}
                      </p>
                    ))}
                  </span>
                </div>
              )}
            </form>
          )}
        </div>
        <section className="panel import-activity" aria-labelledby="import-activity-title">
          <h2 id="import-activity-title">Analysis activity</h2>
          {jobs.filter((job) => job.kind !== "teaching").length === 0 && (
            <div className="empty-state">
              <Layers />
              <h3>No analysis jobs yet</h3>
              <p>Your imports and their progress will appear here.</p>
            </div>
          )}
          {jobs
            .filter((job) => job.kind !== "teaching")
            .filter(
              (job, index) =>
                showHistory ||
                index < 3 ||
                ["queued", "running", "failed", "cancelled"].includes(
                  job.status,
                ),
            )
            .map((job) => (
              <ImportJob key={job.id} job={job} reload={reload} fail={fail} />
            ))}
          {jobs.filter((job) => job.kind !== "teaching").length > 3 && (
            <button
              className="secondary history-toggle"
              aria-expanded={showHistory}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Show recent activity" : "Show older activity"}
            </button>
          )}
        </section>
      </div>
    </section>
  );
}
