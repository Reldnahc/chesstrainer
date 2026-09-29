import Button from "./Button";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FileUp, Layers, X } from "lucide-react";
import {
  api,
  read,
  multipart,
  type Health,
  type Job,
  type PgnImportResult,
  type Schema,
} from "./api";
import { ProviderImportForm, ImportJob } from "./ProviderImport";
import GameSync from "./GameSync";
import SettingsSection from "./SettingsSection";
import EmptyState from "./EmptyState";
import ChoiceGroup from "./ChoiceGroup";
import { ImportAnalysisOption, ImportSubmitButton } from "./ImportControls";
import Notice from "./Notice";

type PgnMode = "file" | "text";
const isActive = (job: Job) => ["queued", "running"].includes(job.status);
const recentHistoryLimit = 3;

function PgnInput({
  file,
  setFile,
  text,
  setText,
  mode,
  setMode,
}: {
  file: File | null;
  setFile: (file: File | null) => void;
  text: string;
  setText: (s: string) => void;
  mode: PgnMode;
  setMode: (mode: PgnMode) => void;
}) {
  function selectMode(next: PgnMode) {
    if (next === mode) return;
    setMode(next);
    // Unmounting also clears the native selection, so returning to file mode
    // can select the same file again.
    setFile(null);
    setText("");
  }
  return <>
    <ChoiceGroup<PgnMode> label="PGN source" value={mode} onChange={selectMode} options={[
      { value: "file", label: "Choose a file" },
      { value: "text", label: "Paste PGN text" },
    ]} />
    {mode === "file" ? <label className="upload-zone">
      <FileUp size={25} />
      <strong>{file?.name || "Choose a PGN file"}</strong>
      <span>One game or a collection · UTF-8</span>
      <input aria-label="PGN file" type="file" accept=".pgn,text/plain" onChange={event => setFile(event.target.files?.[0] || null)} />
    </label> : <label>
      PGN
      <textarea value={text} onChange={event => setText(event.target.value)} rows={7}
        placeholder={'[White "Your username"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 *'} />
    </label>}
  </>;
}

export default function ImportSettings({
  health,
  fail,
  importSource: source,
  onImportSourceChange: selectSource,
  restoringScroll = false,
}: {
  health: Health | null;
  fail: (e: unknown) => void;
  importSource: string | null;
  onImportSourceChange: (source: string | null) => void;
  restoringScroll?: boolean;
}) {
  const [providers, setProviders] = useState<Schema["GameProvider"][]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [rememberedNames, setRememberedNames] = useState<Record<string, string>>({});
  const connectionChanged = useCallback((status: Schema["SyncStatus"]) => {
    setRememberedNames(previous => previous[status.provider] === status.username
      ? previous : { ...previous, [status.provider]: status.username });
  }, []);
  useEffect(() => {
    let active = true;
    read(api.GET("/api/game-providers"))
      .then(value => { if (active) setProviders(value); })
      .catch(error => { if (active) fail(error); })
      .finally(() => { if (active) setLoadingProviders(false); });
    return () => { active = false; };
  }, [fail]);
  const selectedProvider = providers.find(provider => provider.id === source);
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (restoringScroll || !source || (source !== "pgn" && !selectedProvider)) return;
    formRef.current?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ block: "nearest" });
  }, [source, selectedProvider, restoringScroll]);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [pgnMode, setPgnMode] = useState<PgnMode>("file");
  const [names, setNames] = useState("");
  const [side, setSide] = useState<NonNullable<Schema["Body_upload_pgn_api_imports_post"]["side"]>>("auto");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [result, setResult] = useState<PgnImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [analyze, setAnalyze] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const jobsInFlight = useRef<number | null>(null);
  const reload = useCallback(async () => {
    const token = generation.current;
    if (!mounted.current || jobsInFlight.current === token) return;
    jobsInFlight.current = token;
    try {
      const value = await read(api.GET("/api/jobs"));
      if (mounted.current && generation.current === token) setJobs(value);
    } catch (error) {
      if (mounted.current && generation.current === token) fail(error);
    } finally {
      if (jobsInFlight.current === token) jobsInFlight.current = null;
    }
  }, [fail]);
  useEffect(() => {
    mounted.current = true;
    generation.current++;
    reload();
    const timer = setInterval(reload, 2000);
    return () => {
      mounted.current = false;
      generation.current++;
      clearInterval(timer);
    };
  }, [reload]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = pgnMode === "file" ? file : text.trim() ? new File([text], "pasted-games.pgn") : null;
    if (!input) return;
    const token = generation.current;
    setBusy(true);
    setResult(null);
    try {
      const value = await read(api.POST("/api/imports", {
        body: { file: input, usernames: names, side, analyze },
        bodySerializer: multipart,
      }));
      if (!mounted.current || generation.current !== token) return;
      setResult(value);
      await reload();
    } catch (error) {
      if (mounted.current && generation.current === token) fail(error);
    } finally {
      if (mounted.current && generation.current === token) setBusy(false);
    }
  }
  const activity = jobs.filter(job => job.kind !== "teaching");
  const activeJobs = activity.filter(isActive);
  const finishedJobs = activity.filter(job => !isActive(job));
  const hiddenHistoryCount = Math.max(0, finishedJobs.length - recentHistoryLimit);
  const visibleHistory = showHistory ? finishedJobs : finishedJobs.slice(0, recentHistoryLimit);

  return <div className="settings-import">
    <SettingsSection id="settings-imports" title="Import games">
      <GameSync onChanged={reload} onStatusChange={connectionChanged} onImportOlderGames={selectSource} />
      <div className="pgn-import-launcher">
        <div><h3>Have a PGN file?</h3><p className="small">Import a game or a collection from any chess site.</p></div>
        <Button variant="secondary" onClick={() => selectSource("pgn")}><FileUp size={17} />Import PGN</Button>
      </div>
      {source && <div className="import-form" ref={formRef} tabIndex={-1}>
        <div className="import-form-toolbar"><Button variant="quiet" onClick={() => selectSource(null)}><X size={16} />Close import form</Button></div>
        {health?.engine_status === "unavailable" && <Notice announcement="passive">{health.engine_error}</Notice>}
        {source !== "pgn" ? (
          selectedProvider
            ? <ProviderImportForm key={source} provider={selectedProvider} rememberedUsername={rememberedNames[source]} onQueued={reload} fail={fail} />
            : <p role="status">{loadingProviders ? "Loading game providers…" : "That game provider is unavailable. Choose an import action above."}</p>
        ) : <form className="panel form-panel" onSubmit={submit}>
          <h3>Import PGN</h3>
          <PgnInput file={file} setFile={setFile} text={text} setText={setText} mode={pgnMode} setMode={setPgnMode} />
          <label>
            Your username(s)
            <input value={names} onChange={event => setNames(event.target.value)} placeholder="Match the White or Black PGN headers" required={side === "auto"} />
            <small>Separate multiple usernames with commas. Matching ignores case.</small>
          </label>
          <label>
            Learner side
            <select value={side} onChange={event => setSide(event.target.value as typeof side)}>
              <option value="auto">Match my username in each game</option>
              <option value="white">I played White in every game</option>
              <option value="black">I played Black in every game</option>
            </select>
          </label>
          <ImportAnalysisOption analyze={analyze} onChange={setAnalyze} />
          <ImportSubmitButton analyze={analyze} busy={busy} busyLabel="Importing…"
            disabled={pgnMode === "file" ? !file : !text.trim()} />
          {result && <Notice announcement="status">
            <p>{result.imported} imported · {result.duplicates} duplicate(s).</p>
            {result.errors.map((error, index) => <p key={index}>Game {error.game}: {error.error}</p>)}
          </Notice>}
        </form>}
      </div>}
    </SettingsSection>
    <SettingsSection id="settings-activity" title="Import & analysis activity" className="import-activity">
      {activity.length === 0 && <EmptyState presentation="compact" title="No activity yet" icon={<Layers />}>Imports and analysis progress will appear here.</EmptyState>}
      {activeJobs.map(job => <ImportJob key={job.id} job={job} reload={reload} fail={fail} />)}
      {visibleHistory.map(job => <ImportJob key={job.id} job={job} reload={reload} fail={fail} compact />)}
      {hiddenHistoryCount > 0 && <Button variant="secondary" className="history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>
        {showHistory ? "Show recent activity" : `Show older activity (${hiddenHistoryCount})`}
      </Button>}
    </SettingsSection>
  </div>;
}
