import Button, { IconButton } from "./Button";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FileUp, Layers, X } from "lucide-react";
import {
  api,
  read,
  errorMessage,
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
import { ImportSubmitButton } from "./ImportControls";
import Notice from "./Notice";
import Reveal, { RevealList, Swap } from "./Reveal";
import { useInterfaceMotion } from "./MotionProvider";
import { LoadingState, UnavailableState } from "./LoadState";
import { useGameProviders } from "./gameProviders";
import { usePolling } from "./usePolling";
import { useLatest } from "./useLatest";

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
    <Swap>{mode === "file" ? <label className="upload-zone" key="file">
      <FileUp size={25} />
      <strong>{file?.name || "Choose a PGN file"}</strong>
      <span>One game or a collection · UTF-8</span>
      <input aria-label="PGN file" type="file" accept=".pgn,text/plain" onChange={event => setFile(event.target.files?.[0] || null)} />
    </label> : <label key="text">
      PGN
      <textarea value={text} onChange={event => setText(event.target.value)} rows={7}
        placeholder={'[White "Your username"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 *'} />
    </label>}</Swap>
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
  const motion = useInterfaceMotion();
  const [closingSource, setClosingSource] = useState<string | null>(null);
  const closing = !!source && source === closingSource;
  const formRef = useRef<HTMLDivElement>(null);
  const expansionScrollY = useRef<number | null>(null);
  const sourceTrigger = useRef<HTMLElement | null>(null);
  function openSource(next: string) {
    sourceTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setClosingSource(null);
    selectSource(next);
  }
  function finishClose() {
    setClosingSource(null);
    selectSource(null);
  }
  function closeForm() {
    if (motion === "still") finishClose();
    else {
      // Navigating now would scroll the exit out of view before it can finish.
      const target = sourceTrigger.current?.isConnected ? sourceTrigger.current : document.getElementById("main-content");
      target?.focus({ preventScroll: true });
      setClosingSource(source);
    }
  }
  // A close is forgotten once another source opens, so reopening that source later is not a close.
  if (closingSource && source !== closingSource) setClosingSource(null);
  useEffect(() => {
    // An immediate reversal at zero height has no transitionend to wait for.
    if (closing && (motion === "still" || !formRef.current?.getAnimations().some(animation =>
      animation instanceof CSSTransition && animation.transitionProperty === "grid-template-rows"))) {
      setClosingSource(null);
      selectSource(null);
    }
  }, [source, closingSource, closing, motion, selectSource]);
  const providerQuery = useGameProviders();
  const providers = providerQuery.data ?? [];
  const [rememberedNames, setRememberedNames] = useState<Record<string, string>>({});
  const connectionChanged = useCallback((status: Schema["SyncStatus"]) => {
    setRememberedNames(previous => previous[status.provider] === status.username
      ? previous : { ...previous, [status.provider]: status.username });
  }, []);
  const selectedProvider = providers.find(provider => provider.id === source);
  useEffect(() => {
    if (closing || restoringScroll || !source || (source !== "pgn" && !selectedProvider)) return;
    formRef.current?.focus({ preventScroll: true });
    expansionScrollY.current = window.scrollY;
    if (!formRef.current?.getAnimations().length) {
      formRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
      expansionScrollY.current = null;
    }
    return () => { expansionScrollY.current = null; };
  }, [source, selectedProvider, restoringScroll, closing]);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [pgnMode, setPgnMode] = useState<PgnMode>("file");
  const [names, setNames] = useState("");
  const [side, setSide] = useState<NonNullable<Schema["Body_upload_pgn_api_imports_post"]["side"]>>("auto");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const jobsLoadedRef = useLatest(jobsLoaded);
  const [result, setResult] = useState<PgnImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  // Activity refreshes every two seconds while the tab is shown; an import, sync or
  // job command asks for a fresh read after any read already in flight.
  // Before activity has loaded, a failure is the section's own unavailable state;
  // after it, an outage is one page banner, and the next good read clears the way for another.
  const outage = useRef(false);
  const jobsPolling = usePolling(async (signal) => {
    try {
      const value = await read(api.GET("/api/jobs", { signal }));
      if (signal.aborted) return;
      outage.current = false;
      setJobsError("");
      setJobs(value);
      setJobsLoaded(true);
    } catch (error) {
      if (signal.aborted) throw error;
      setJobsError(errorMessage(error));
      if (jobsLoadedRef.current && !outage.current) fail(error);
      outage.current = true;
      throw error;
    }
  }, { intervalMs: 2000 });
  const reload = jobsPolling.run;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = pgnMode === "file" ? file : text.trim() ? new File([text], "pasted-games.pgn") : null;
    if (!input) return;
    setBusy(true);
    setResult(null);
    try {
      const value = await read(api.POST("/api/imports", {
        body: { file: input, usernames: names, side },
        bodySerializer: multipart,
      }));
      if (!mounted.current) return;
      setResult(value);
      await reload();
    } catch (error) {
      if (mounted.current) fail(error);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const activity = jobs.filter(job => job.kind !== "teaching");
  const activeJobs = activity.filter(isActive);
  const finishedJobs = activity.filter(job => !isActive(job));
  const hiddenHistoryCount = Math.max(0, finishedJobs.length - recentHistoryLimit);
  const visibleHistory = showHistory ? finishedJobs : finishedJobs.slice(0, recentHistoryLimit);

  return <div className="settings-import">
    <SettingsSection id="settings-imports" title="Import games">
      <GameSync onChanged={reload} onStatusChange={connectionChanged} onImportOlderGames={openSource} />
      {/* The launcher and its form stay together, so the closed form reserves no gap. */}
      <div className="pgn-import">
        <div className="pgn-import-launcher">
          <div><h3>Have a PGN file?</h3><p className="small">Import a game or a collection from any chess site.</p></div>
          <Button variant="secondary" onClick={() => openSource("pgn")}><FileUp size={17} />Import PGN</Button>
        </div>
        <div className="import-form" ref={formRef} tabIndex={source ? -1 : undefined}
          aria-labelledby={source ? "import-form-title" : undefined} aria-hidden={!source || undefined}
          data-open={!!source && !closing || undefined} data-closing={closing || undefined} inert={!source || closing}
          onTransitionEnd={event => {
            if (event.target !== event.currentTarget || event.propertyName !== "grid-template-rows") return;
            if (closing) finishClose();
            else if (!restoringScroll && expansionScrollY.current === window.scrollY && document.activeElement === event.currentTarget) {
              // Use the expanded bounds, and never override a reader who scrolled meanwhile.
              event.currentTarget.scrollIntoView({ block: "nearest", behavior: "instant" });
              expansionScrollY.current = null;
            }
          }}>
          <div className="import-form-clip">
            {source && <div className="import-form-reveal"><div className="import-form-body">
              <div className="import-form-heading">
                <h3 id="import-form-title">{source === "pgn" ? "Import PGN" : selectedProvider ? `Import from ${selectedProvider.name}` : "Import games"}</h3>
                <IconButton variant="quiet" aria-label="Close import form" title="Close import form" onClick={closeForm}><X size={18} aria-hidden="true" /></IconButton>
              </div>
              <Reveal>{health?.engine_status === "unavailable" && <Notice announcement="passive">{health.engine_error}</Notice>}</Reveal>
              {source !== "pgn" ? (
                selectedProvider
                  ? <ProviderImportForm key={source} provider={selectedProvider} rememberedUsername={rememberedNames[source]} onQueued={reload} fail={fail} />
                  : !providerQuery.data && !providerQuery.error ? <LoadingState>Loading game providers…</LoadingState>
                    : !providerQuery.data ? <UnavailableState actions={<Button variant="secondary" onClick={providerQuery.retry}>Try again</Button>}>Couldn’t load game providers.</UnavailableState>
                    : <UnavailableState>That game provider is unavailable. Choose an import action above.</UnavailableState>
              ) : <form className="form-panel" aria-labelledby="import-form-title" onSubmit={submit}>
                <PgnInput file={file} setFile={setFile} text={text} setText={setText} mode={pgnMode} setMode={setPgnMode} />
                <div className="import-options">
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
                </div>
                <div className="import-form-actions">
                  <ImportSubmitButton busy={busy} busyLabel="Importing…"
                    disabled={pgnMode === "file" ? !file : !text.trim()} />
                </div>
                <Reveal>{result && <Notice announcement="status">
                  <p>{result.imported} imported · {result.duplicates} duplicate(s).</p>
                  {result.errors.map((error, index) => <p key={index}>Game {error.game}: {error.error}</p>)}
                </Notice>}</Reveal>
              </form>}
            </div></div>}
          </div>
        </div>
      </div>
    </SettingsSection>
    <SettingsSection id="settings-activity" title="Import & analysis activity" className="import-activity">
      {!jobsLoaded && (jobsError
        ? <UnavailableState actions={<Button variant="secondary" onClick={reload}>Try again</Button>}>Couldn’t load import activity.</UnavailableState>
        : <LoadingState>Loading import activity…</LoadingState>)}
      <Reveal>{jobsLoaded && activity.length === 0 && <EmptyState presentation="compact" title="No activity yet" icon={<Layers />}>Imports and analysis progress will appear here.</EmptyState>}</Reveal>
      <RevealList settled={jobsLoaded} className="import-job-row">{activeJobs.map(job => <ImportJob key={job.id} job={job} reload={reload} fail={fail} />)}</RevealList>
      <RevealList settled={jobsLoaded} className="import-job-row">{visibleHistory.map(job => <ImportJob key={job.id} job={job} reload={reload} fail={fail} compact />)}</RevealList>
      <Reveal>{hiddenHistoryCount > 0 && <Button variant="secondary" className="history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>
        {showHistory ? "Show recent activity" : `Show older activity (${hiddenHistoryCount})`}
      </Button>}</Reveal>
    </SettingsSection>
  </div>;
}
