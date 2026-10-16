import Button from "./Button";
import Banner from "./Banner";
import { useEffect, useRef, useState } from "react";
import { api, read, type Job, type Schema } from "./api";
import ProviderUsernameField from "./ProviderUsernameField";
import { ImportSubmitButton } from "./ImportControls";
import Notice from "./Notice";
import Reveal from "./Reveal";
import { useServerDraft } from "./gameProviders";
import { QueryResult, useQuery } from "./useQuery";
import { plural, pluralWord } from "./format";

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
  // The field follows the remembered (or saved) username until the reader edits it.
  // A remembered username needs no fetch, so the field is ready as soon as one arrives.
  const fetchUsername = rememberedUsername === undefined;
  const saved = useQuery(
    signal =>
      read(
        api.GET("/api/providers/{provider}/sync", {
          signal,
          params: { path: { provider: provider.id } },
        }),
      ),
    [provider.id],
    { enabled: fetchUsername },
  );
  // A failed read leaves the field open to type a username; only a read in flight holds it.
  const loadingUsername =
    fetchUsername && saved.data === undefined && saved.pending && !saved.error;
  const name = useServerDraft(rememberedUsername ?? saved.data?.username);
  const username = name.draft;
  const [timeClass, setTimeClass] = useState(
    provider.time_classes.includes("rapid") ? "rapid" : provider.time_classes[0],
  );
  const [months, setMonths] = useState(3);
  const [maxGames, setMaxGames] = useState(100);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
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
            months,
            max_games: maxGames,
            start_date: startDate || null,
            end_date: endDate || null,
          },
        }),
      );
      if (!mounted.current) return;
      setMessage(
        `Import queued for ${username.trim()}. Older games are analyzed after your recent ones.`,
      );
      onQueued();
    } catch (e) {
      if (mounted.current) fail(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <form className="form-panel" aria-labelledby="import-form-title" onSubmit={submit}>
      <p className="small import-intro">
        Bring in older games or a custom date range. This uses your saved username unless you enter
        a different one here. No login or API key needed.
      </p>
      <div className="import-options">
        <ProviderUsernameField
          providerName={provider.name}
          disabled={loadingUsername}
          value={username}
          onChange={name.edit}
          required
          placeholder={`Your ${provider.name} username`}
          description="Your side is identified separately in every game."
        />
        <label>
          Time control
          <select
            aria-label="Time control"
            value={timeClass}
            onChange={e => setTimeClass(e.target.value as typeof timeClass)}
          >
            {provider.time_classes.map(value => (
              <option key={value} value={value}>
                {value === "all"
                  ? "All time controls"
                  : value === "ultraBullet"
                    ? "Ultra bullet"
                    : value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Reveal>
        {fetchUsername && saved.data === undefined && (
          <QueryResult query={saved} label="your saved username">
            {() => null}
          </QueryResult>
        )}
      </Reveal>
      <div className="import-options">
        <label>
          Look back
          <select
            aria-label="Look back"
            disabled={!!(startDate || endDate)}
            value={months}
            onChange={e => setMonths(Number(e.target.value))}
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
            onChange={e => setMaxGames(Number(e.target.value))}
            required
          />
        </label>
      </div>
      <details className="disclosure import-extra">
        <summary>Custom date range{startDate || endDate ? " (active)" : ""}</summary>
        <div className="import-options">
          <label>
            From date
            <input
              aria-label="From date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>
          <label>
            To date
            <input
              aria-label="To date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <p className="small">
          Dates replace Look back and include the whole day in UTC. Leave either blank for an
          open-ended range.
        </p>
        <Reveal>
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
        </Reveal>
      </details>
      <div className="import-form-actions">
        <ImportSubmitButton
          busy={busy}
          busyLabel="Queuing import…"
          disabled={loadingUsername || !username.trim()}
        />
      </div>
      {message && <Banner onDismiss={() => setMessage("")}>{message}</Banner>}
      <details className="disclosure import-extra">
        <summary>How imports work</summary>
        <p className="small">
          Newest unsaved games first within your filters. Saved games do not use up the limit or get
          analyzed again. Every imported game is analyzed in the background, after your new games.
          Includes rated and unrated standard chess; recently finished games may take time to
          appear.
        </p>
        <p className="small">
          Your host contacts {provider.name}'s public API. Analysis and mistake classification run
          locally.
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
  const source = job.provider_import;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function updateJob(action: "cancel" | "retry") {
    void read(
      api.POST(action === "cancel" ? "/api/jobs/{job_id}/cancel" : "/api/jobs/{job_id}/retry", {
        params: { path: { job_id: job.id } },
      }),
    )
      .then(() => {
        if (mounted.current) reload();
      })
      .catch(error => {
        if (mounted.current) fail(error);
      });
  }
  const fetchOnly = ["sync", "chesscom_fetch", "provider_fetch"].includes(job.kind);
  const fetching = source && !source.fetch_completed;
  const title = source
    ? `${source.provider_name} · ${source.username}`
    : job.kind === "sync"
      ? "Recent-game sync"
      : fetchOnly
        ? "Fetch games"
        : job.kind === "game_review"
          ? "Full-game review"
          : job.kind === "enrichment"
            ? "Deeper classification evidence"
            : job.kind === "puzzle_generation"
              ? "Puzzles from your games"
              : job.kind === "classification"
                ? "Skill classification"
                : "Game analysis";
  const summary = source
    ? `${source.games_imported} imported · ${plural(source.duplicates, "duplicate")}`
    : fetchOnly
      ? `${plural(job.games_processed, "game")} fetched`
      : job.kind === "game_review"
        ? `${plural(job.positions_triaged, "move")} reviewed`
        : job.kind === "enrichment"
          ? `${job.positions_triaged} / ${job.probe_total || 0} ${pluralWord(job.probe_total || 0, "position")} processed`
          : job.kind === "puzzle_generation"
            ? `${job.games_processed} / ${job.games_total} ${pluralWord(job.games_total, "game")} searched · ${plural(job.puzzles_found, "puzzle")}`
            : `${job.games_processed} / ${job.games_total} ${pluralWord(job.games_total, "game")} · ${plural(job.positions_triaged, "decision")}${job.puzzles_found ? ` · ${plural(job.puzzles_found, "puzzle")}` : ""}`;
  const badge = <span className={`badge ${job.status}`}>{job.status}</span>;
  const contents = (
    <>
      {source && (
        <>
          <p className="import-phase">
            {fetching
              ? ["queued", "running"].includes(job.status)
                ? "Fetching public game archives"
                : "Game download interrupted"
              : fetchOnly
                ? "Download complete"
                : "Download complete · local analysis"}
          </p>
          <Reveal>
            {fetching && ["queued", "running"].includes(job.status) && (
              <progress
                aria-label="Game download progress"
                value={source.archives_total ? source.archives_processed : undefined}
                max={Math.max(1, source.archives_total)}
              />
            )}
          </Reveal>
          <p>{plural(source.games_fetched, "game")} fetched</p>
          <p className="small">
            {source.games_imported} imported · {plural(source.duplicates, "duplicate")} ·{" "}
            {source.filtered} filtered · {source.rejected} rejected
          </p>
          <Reveal>
            {source.fetch_completed && source.games_imported === 0 && (
              <p>
                {source.duplicates > 0
                  ? fetchOnly
                    ? "No new games found. Saved games were skipped."
                    : "No new games found. Saved games were skipped; use Retry saved work on an earlier job to finish interrupted analysis."
                  : "No matching games imported. Check the username, range and time control."}
              </p>
            )}
          </Reveal>
          {source.errors.length > 0 && (
            <details className="disclosure">
              <summary>Import issues ({source.rejected})</summary>
              {source.errors.map((error, index) => (
                <Notice
                  announcement="passive"
                  tone="error"
                  appearance="inline"
                  className="small"
                  key={index}
                >
                  {error.game ? `Game ${error.game}: ` : ""}
                  {error.error}
                </Notice>
              ))}
            </details>
          )}
        </>
      )}
      {!fetching && !fetchOnly && job.kind !== "enrichment" && job.kind !== "game_review" && (
        <>
          <progress
            aria-label="Analysis progress"
            value={job.games_processed}
            max={Math.max(1, job.games_total)}
          />
          <p>
            {job.games_processed} / {job.games_total} {pluralWord(job.games_total, "game")} ·{" "}
            {plural(job.positions_triaged, "decision")}
          </p>
          <p className="small">
            {plural(job.deep_completed, "deep analysis", "deep analyses")} ·{" "}
            {plural(job.mistakes_identified, "practice-worthy moment")} ·{" "}
            {plural(job.classifications_completed, "position")} classified or left unclassified
          </p>
        </>
      )}
      {job.kind === "game_review" && (
        <p className="small">
          {plural(job.positions_triaged, "move")} reviewed across both players. Open Games for the
          coach and playable variations. Cancel and retry preserve completed moves.
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
            {job.positions_triaged} / {job.probe_total || 0} selected{" "}
            {pluralWord(job.probe_total || 0, "position")} processed
          </p>
          <p className="small">
            Extra evidence is used for classification. Review answers and schedules stay unchanged.
            Cancel and retry preserve completed work.
          </p>
        </>
      )}
      <Reveal>
        {job.error && (
          <Notice announcement="passive" tone="error" appearance="inline">
            {job.error}
          </Notice>
        )}
      </Reveal>
      {job.activity && (
        <p className="small">
          Parallel work: {plural(job.activity.games.active, "game worker")} ·{" "}
          {plural(job.activity.classifications.active, "classification worker")} ·{" "}
          {plural(
            job.activity.classifications.pending - job.activity.classifications.active,
            "classification task",
          )}{" "}
          waiting
        </p>
      )}
      {job.kind === "classification" && (
        <p className="small">
          Cancel keeps completed work. Retry reuses saved results for the same rules, configuration
          and evidence.
        </p>
      )}
      <div className="button-row">
        {["queued", "running"].includes(job.status) && (
          <Button onClick={() => updateJob("cancel")}>Cancel</Button>
        )}
        {["failed", "cancelled"].includes(job.status) && (
          <Button onClick={() => updateJob("retry")}>Retry saved work</Button>
        )}
      </div>
    </>
  );
  return (
    <article className={`job${compact ? " job-history" : " panel"}`}>
      {compact ? (
        <details className="disclosure">
          <summary className="job-summary">
            <span className="job-summary-content">
              <span className="job-summary-copy">
                <strong>{title}</strong>
                <span className="small">{summary}</span>
              </span>
              {badge}
              <span className="job-inspect small">View details</span>
            </span>
          </summary>
          <div className="job-details">{contents}</div>
        </details>
      ) : (
        <>
          <div className="row-between">
            <strong>{title}</strong>
            {badge}
          </div>
          {contents}
        </>
      )}
    </article>
  );
}
