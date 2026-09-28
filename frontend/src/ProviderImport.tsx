import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { api, read, type Job, type Schema } from "./api";


export function ProviderImportForm({
  provider,
  onQueued,
  fail,
}: {
  provider: Schema["GameProvider"];
  onQueued: () => void;
  fail: (e: unknown) => void;
}) {
  const [username, setUsername] = useState("");
  const [loadingUsername, setLoadingUsername] = useState(true);
  useEffect(() => {
    let active = true;
    read(api.GET("/api/providers/{provider}/sync", { params: { path: { provider: provider.id } } }))
      .then(value => { if (active) setUsername(current => current || value.username); })
      .catch(error => { if (active) fail(error); })
      .finally(() => { if (active) setLoadingUsername(false); });
    return () => { active = false; };
  }, [provider.id, fail]);
  const [analyze, setAnalyze] = useState(false);
  const [timeClass, setTimeClass] =
    useState(provider.time_classes.includes("rapid") ? "rapid" : provider.time_classes[0]);
  const [months, setMonths] = useState(3);
  const [maxGames, setMaxGames] = useState(100);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
      setMessage(
        `Import queued for ${username.trim()}. ${analyze ? "Fetching and training analysis continue in the background." : "Games will appear in Games without engine analysis."}`,
      );
      onQueued();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={submit}>
      <h2>Import from {provider.name}</h2>
      <p className="small import-intro">
        Enter your username to bring in your completed games. No login or API
        key needed.
      </p>
      <label>
        {provider.name} username
        <input
          aria-label={`${provider.name} username`}
          disabled={loadingUsername}
          autoComplete="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          maxLength={50}
          pattern="[A-Za-z0-9_-]+"
          placeholder={`Your ${provider.name} username`}
        />
        <small>Your side is identified separately in every game.</small>
      </label>
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
      <label className="import-analysis-option">
        <input
          type="checkbox"
          checked={analyze}
          onChange={(e) => setAnalyze(e.target.checked)}
        />
        Also analyze these games for training
      </label>
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
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear dates
          </button>
        )}
      </details>
      <button className="primary" disabled={busy || loadingUsername || !username.trim()}>
        {busy ? "Queuing import…" : analyze ? "Fetch & analyze games" : "Fetch games"}
        <ArrowRight size={17} />
      </button>
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
}: {
  job: Job;
  reload: () => void;
  fail: (e: unknown) => void;
}) {
  const source = job.provider_import || job.chesscom;
  const fetchOnly = ["sync", "chesscom_fetch", "provider_fetch"].includes(job.kind);
  const fetching = source && !source.fetch_completed;
  return (
    <article className="job panel">
      <div className="row-between">
        <strong>
          {source
            ? `${source.provider_name} · ${source.username}`
            : job.kind === "sync"
              ? "Recent-game sync"
              : job.kind === "chesscom_fetch"
                ? "Fetch games"
                : job.kind === "training"
                  ? "Training analysis"
                  : job.kind === "game_review"
                    ? "Full-game review"
                    : job.kind === "enrichment"
                      ? "Deeper classification evidence"
                      : job.kind === "teaching"
                        ? "Archived lesson summaries"
                        : job.kind === "classification"
                          ? "Skill classification"
                          : "Game analysis"}
        </strong>
        <span className={`badge ${job.status}`}>{job.status}</span>
      </div>
      {source && (
        <>
          <p className="import-phase">
            {fetching
              ? "Fetching public game archives"
              : fetchOnly ? "Download complete" : "Download complete · local analysis"}
          </p>
          {fetching && (
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
          <button
            onClick={() =>
              read(
                api.POST("/api/jobs/{job_id}/cancel", {
                  params: { path: { job_id: job.id } },
                }),
              )
                .then(reload)
                .catch(fail)
            }
          >
            Cancel
          </button>
        )}
        {job.kind !== "teaching" &&
          ["failed", "cancelled"].includes(job.status) && (
            <button
              onClick={() =>
                read(
                  api.POST("/api/jobs/{job_id}/retry", {
                    params: { path: { job_id: job.id } },
                  }),
                )
                  .then(reload)
                  .catch(fail)
              }
            >
              Retry saved work
            </button>
          )}
      </div>
    </article>
  );
}
