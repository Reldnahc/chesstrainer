import Button from "./Button";
import { useEffect, useRef, useState } from "react";
import { api, read, type Job, type Schema } from "./api";
import ProviderUsernameField from "./ProviderUsernameField";
import { ImportAnalysisOption, ImportSubmitButton } from "./ImportControls";


export function ProviderImportForm({
  provider,
  onQueued,
  fail,
  rememberedUsername,
}: {
  provider: Schema["GameProvider"];
  onQueued: () => void;
  fail: (e: unknown) => void;
  rememberedUsername?: string;
}) {
  const [username, setUsername] = useState(rememberedUsername || "");
  const [loadingUsername, setLoadingUsername] = useState(rememberedUsername === undefined);
  const editedUsername = useRef(false);
  useEffect(() => {
    if (rememberedUsername !== undefined) {
      if (!editedUsername.current) setUsername(rememberedUsername);
      setLoadingUsername(false);
      return;
    }
    let active = true;
    read(api.GET("/api/providers/{provider}/sync", { params: { path: { provider: provider.id } } }))
      .then(value => { if (active && !editedUsername.current) setUsername(value.username); })
      .catch(error => { if (active) fail(error); })
      .finally(() => { if (active) setLoadingUsername(false); });
    return () => { active = false; };
  }, [provider.id, rememberedUsername, fail]);
  const [analyze, setAnalyze] = useState(false);
  const [timeClass, setTimeClass] =
    useState(provider.time_classes.includes("rapid") ? "rapid" : provider.time_classes[0]);
  const [months, setMonths] = useState(3);
  const [maxGames, setMaxGames] = useState(100);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await read(
        api.POST("/api/imports/provider/{provider}", {
          params: { path: { provider: provider.id } },
          body: {
            username: username.trim(),
            time_class: timeClass,
            analyze,
            months,
            max_games: maxGames,
            start_date: startDate || null,
            end_date: endDate || null,
          },
        }),
      );
      if (!mounted.current) return;
      setMessage(
        `Import queued for ${username.trim()}. ${analyze ? "Fetching and training analysis continue in the background." : "Games will appear in Games without engine analysis."}`,
      );
      onQueued();
    } catch (e) {
      if (mounted.current) fail(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <h3>Import from {provider.name}</h3>
      <p className="small import-intro">
        Bring in older games or a custom date range. This uses your saved username
        unless you enter a different one here. No login or API key needed.
      </p>
      <ProviderUsernameField
        providerName={provider.name}
        disabled={loadingUsername}
        value={username}
        onChange={value => { editedUsername.current = true; setUsername(value); }}
        required
        placeholder={`Your ${provider.name} username`}
        description="Your side is identified separately in every game."
      />
      <label>
        Time control
        <select
          aria-label="Time control"
          value={timeClass}
          onChange={(e) => setTimeClass(e.target.value as typeof timeClass)}
        >
          {provider.time_classes.map(value => <option key={value} value={value}>
            {value === "all" ? "All time controls" : value === "ultraBullet" ? "Ultra bullet" : value[0].toUpperCase() + value.slice(1)}
          </option>)}
        </select>
      </label>
      <div className="import-options">
        <label>
          Look back
          <select
            aria-label="Look back"
            disabled={!!(startDate || endDate)}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            <option value={1}>This month</option>
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
            <option value={0}>All available history</option>
          </select>
        </label>
        <label>
          Maximum new games
          <input
            type="number"
            min={1}
            max={1000}
            step={1}
            value={maxGames}
            onChange={(e) => setMaxGames(Number(e.target.value))}
            required
          />
        </label>
      </div>
      <ImportAnalysisOption analyze={analyze} onChange={setAnalyze} />
      <details className="import-extra">
        <summary>
          Custom date range{startDate || endDate ? " (active)" : ""}
        </summary>
        <div className="import-options">
          <label>
            From date
            <input
              aria-label="From date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            To date
            <input
              aria-label="To date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <p className="small">
          Dates replace Look back and include the whole day in UTC. Leave either
          blank for an open-ended range.
        </p>
        {(startDate || endDate) && (
          <Button
            type="button"
            variant="quiet"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear dates
          </Button>
        )}
      </details>
      <ImportSubmitButton analyze={analyze} busy={busy} busyLabel="Queuing import…"
        disabled={loadingUsername || !username.trim()} />
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      <details className="import-extra">
        <summary>How imports work</summary>
        <p className="small">
          Newest unsaved games first within your filters. Saved games do not use
          up the limit or get analyzed again. Includes rated and unrated
          standard chess; recently finished games may take time to appear.
        </p>
        <p className="small">
          Your host contacts {provider.name}'s public API. Analysis and mistake
          classification run locally.
        </p>
      </details>
    </form>
  );
}

export function ImportJob({
  job,
  reload,
  fail,
  compact = false,
}: {
  job: Job;
  reload: () => void;
  fail: (e: unknown) => void;
  compact?: boolean;
}) {
  const source = job.provider_import || job.chesscom;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  function updateJob(action: "cancel" | "retry") {
    void read(api.POST(action === "cancel" ? "/api/jobs/{job_id}/cancel" : "/api/jobs/{job_id}/retry", {
      params: { path: { job_id: job.id } },
    }))
      .then(() => { if (mounted.current) reload(); })
      .catch(error => { if (mounted.current) fail(error); });
  }
  const fetchOnly = ["sync", "chesscom_fetch", "provider_fetch"].includes(job.kind);
  const fetching = source && !source.fetch_completed;
  const title = source ? `${source.provider_name} · ${source.username}`
    : job.kind === "sync" ? "Recent-game sync"
      : fetchOnly ? "Fetch games"
        : job.kind === "training" ? "Training analysis"
          : job.kind === "game_review" ? "Full-game review"
            : job.kind === "enrichment" ? "Deeper classification evidence"
              : job.kind === "teaching" ? "Archived lesson summaries"
                : job.kind === "classification" ? "Skill classification" : "Game analysis";
  const summary = source ? `${source.games_imported} imported · ${source.duplicates} duplicates`
    : fetchOnly ? `${job.games_processed} games fetched`
      : job.kind === "game_review" ? `${job.positions_triaged} moves reviewed`
        : job.kind === "enrichment" ? `${job.positions_triaged} / ${job.probe_total || 0} positions processed`
          : `${job.games_processed} / ${job.games_total} games · ${job.positions_triaged} decisions`;
  const badge = <span className={`badge ${job.status}`}>{job.status}</span>;
  const contents = <>
      {source && (
        <>
          <p className="import-phase">
            {fetching
              ? ["queued", "running"].includes(job.status) ? "Fetching public game archives" : "Game download interrupted"
              : fetchOnly ? "Download complete" : "Download complete · local analysis"}
          </p>
          {fetching && ["queued", "running"].includes(job.status) && (
            <progress
              aria-label="Game download progress"
              value={source.archives_total ? source.archives_processed : undefined}
              max={Math.max(1, source.archives_total)}
            />
          )}
          <p>
            {source.games_fetched} {source.games_fetched === 1 ? "game" : "games"} fetched
          </p>
          <p className="small">
            {source.games_imported} imported · {source.duplicates} duplicates ·{" "}
            {source.filtered} filtered · {source.rejected} rejected
          </p>
          {source.fetch_completed && source.games_imported === 0 && (
            <p>
              {source.duplicates > 0
                ? fetchOnly ? "No new games found. Saved games were skipped." : "No new games found. Saved games were skipped; use Retry saved work on an earlier job to finish interrupted analysis."
                : "No matching games imported. Check the username, range and time control."}
            </p>
          )}
          {source.errors.length > 0 && (
            <details>
              <summary>Import issues ({source.rejected})</summary>
              {source.errors.map((error, index) => (
                <p className="small" key={index}>
                  {error.game ? `Game ${error.game}: ` : ""}
                  {error.error}
                </p>
              ))}
            </details>
          )}
        </>
      )}
      {job.kind === "teaching" && (
        <>
          <progress
            aria-label="Teaching progress"
            value={job.games_processed}
            max={Math.max(1, job.games_total)}
          />
          <p>
            {job.games_processed} / {job.games_total} units processed
          </p>
          <p className="small">
            {job.classifications_completed} historical summaries. Generation has
            been removed.
          </p>
        </>
      )}
      {!fetching && !fetchOnly &&
        job.kind !== "teaching" &&
        job.kind !== "enrichment" &&
        job.kind !== "game_review" && (
          <>
            <progress
              aria-label="Analysis progress"
              value={job.games_processed}
              max={Math.max(1, job.games_total)}
            />
            <p>
              {job.games_processed} / {job.games_total}{" "}
              {job.kind === "teaching" ? "units" : "games"} ·{" "}
              {job.positions_triaged} decisions
            </p>
            <p className="small">
              {job.deep_completed} deep analyses · {job.mistakes_identified}{" "}
              practice-worthy moments · {job.classifications_completed}{" "}
              positions classified or left unclassified
            </p>
          </>
        )}
      {job.kind === "game_review" && (
        <p className="small">
          {job.positions_triaged} moves reviewed across both players. Open Games
          for the coach and playable variations. Cancel and retry preserve
          completed moves.
        </p>
      )}
      {job.kind === "enrichment" && (
        <>
          <progress
            aria-label="Deeper evidence progress"
            value={job.positions_triaged}
            max={Math.max(1, job.probe_total || 0)}
          />
          <p>
            {job.positions_triaged} / {job.probe_total || 0} selected positions
            processed
          </p>
          <p className="small">
            Extra evidence is used for classification. Review answers and
            schedules stay unchanged. Cancel and retry preserve completed work.
          </p>
        </>
      )}
      {job.error && <p className="error-text">{job.error}</p>}
      {job.activity && (
        <p className="small">
          Parallel work: {job.activity.games.active} game workers ·{" "}
          {job.activity.classifications.active} classification workers ·{" "}
          {job.activity.classifications.pending -
            job.activity.classifications.active}{" "}
          classification tasks waiting
        </p>
      )}
      {job.kind === "classification" && (
        <p className="small">
          Cancel keeps completed work. Retry reuses saved results for the same
          rules, configuration and evidence.
        </p>
      )}
      <div className="button-row">
        {["queued", "running"].includes(job.status) && (
          <Button onClick={() => updateJob("cancel")}>
            Cancel
          </Button>
        )}
        {job.kind !== "teaching" &&
          ["failed", "cancelled"].includes(job.status) && (
            <Button onClick={() => updateJob("retry")}>
              Retry saved work
            </Button>
          )}
      </div>
    </>;
  return (
    <article className={`job${compact ? " job-history" : " panel"}`}>
      {compact ? <details>
        <summary className="job-summary">
          <span className="job-summary-copy"><strong>{title}</strong><span className="small">{summary}</span></span>
          {badge}
          <span className="job-inspect small">View details</span>
        </summary>
        <div className="job-details">{contents}</div>
      </details> : <>
        <div className="row-between"><strong>{title}</strong>{badge}</div>
        {contents}
      </>}
    </article>
  );
}
