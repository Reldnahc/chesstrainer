import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { post, type Job } from './api';
import { useAccount } from './AccountGate';

export function ChessComImportForm({onQueued, fail}: {onQueued: () => void; fail: (e: unknown) => void}) {
  const account = useAccount();
  const [username, setUsername] = useState(() => account?.chesscom_username || (!account ? localStorage.getItem('chesscom-username') : '') || '');
  const [analyze, setAnalyze] = useState(false);
  const [timeClass, setTimeClass] = useState('rapid');
  const [months, setMonths] = useState(3);
  const [maxGames, setMaxGames] = useState(100);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await post('/imports/chesscom', {username: username.trim(), time_class: timeClass, analyze, months, max_games: maxGames, start_date: startDate || null, end_date: endDate || null});
      if (!account) localStorage.setItem('chesscom-username', username.trim());
      setMessage(`Import queued for ${username.trim()}. ${analyze ? "Fetching and training analysis continue in the background." : "Games will appear in Games without engine analysis."}`);
      onQueued();
    } catch (e) {fail(e);} finally {setBusy(false);}
  }

  return <form className="panel form-panel" onSubmit={submit}>
    <h2>Import from Chess.com</h2>
    <p className="small import-intro">Enter your username to bring in your completed games. No login or API key needed.</p>
    <label>Chess.com username<input aria-label="Chess.com username" autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} required maxLength={50} pattern="[A-Za-z0-9_-]+" placeholder="Your Chess.com username"/>
      <small>Your side is identified separately in every game.</small></label>
    <label>Time control<select aria-label="Time control" value={timeClass} onChange={e => setTimeClass(e.target.value)}>
      <option value="rapid">Rapid</option><option value="blitz">Blitz</option><option value="bullet">Bullet</option><option value="daily">Daily</option><option value="all">All time controls</option>
    </select></label>
    <div className="import-options">
      <label>Look back<select aria-label="Look back" disabled={!!(startDate || endDate)} value={months} onChange={e => setMonths(Number(e.target.value))}>
        <option value={1}>This month</option><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option><option value={24}>Last 24 months</option><option value={0}>All available history</option>
      </select></label>
      <label>Maximum new games<input type="number" min={1} max={1000} step={1} value={maxGames} onChange={e => setMaxGames(Number(e.target.value))} required/></label>
    </div>
    <label><input type="checkbox" checked={analyze} onChange={e => setAnalyze(e.target.checked)} />Also analyze these games for training</label>
    <details className="import-extra"><summary>Custom date range{startDate || endDate ? ' (active)' : ''}</summary>
      <div className="import-options">
        <label>From date<input aria-label="From date" type="date" value={startDate} max={endDate || undefined} onChange={e => setStartDate(e.target.value)}/></label>
        <label>To date<input aria-label="To date" type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)}/></label>
      </div><p className="small">Dates replace Look back and include the whole day in UTC. Leave either blank for an open-ended range.</p>
      {(startDate || endDate) && <button type="button" className="text-button" onClick={() => {setStartDate(''); setEndDate('');}}>Clear dates</button>}
    </details>
    <button className="primary" disabled={busy || !username.trim()}>{busy ? 'Queuing import…' : 'Fetch & analyze games'}<ArrowRight size={17}/></button>
    {message && <div role="status" className="notice">{message}</div>}
    <details className="import-extra"><summary>How imports work</summary><p className="small">Newest unsaved games first within your filters. Saved games do not use up the limit or get analyzed again. Includes rated and unrated standard chess; recently finished games may take time to appear.</p><p className="small">Your host contacts Chess.com's public API. Analysis and mistake classification run locally.</p></details>
  </form>;
}

export function ImportJob({job, reload, fail}: {job: Job; reload: () => void; fail: (e: unknown) => void}) {
  const source = job.chesscom;
  const fetching = source && !source.fetch_completed;
  return <article className="job panel">
    <div className="row-between"><strong>{source ? `Chess.com · ${source.username}` : job.kind === 'sync' ? 'Recent-game sync' : job.kind === 'chesscom_fetch' ? 'Fetch games' : job.kind === 'training' ? 'Training analysis' : job.kind === 'game_review' ? 'Full-game review' : job.kind === 'enrichment' ? 'Deeper classification evidence' : job.kind === 'teaching' ? 'Archived lesson summaries' : job.kind === 'classification' ? 'Skill classification' : 'Game analysis'}</strong><span className={`badge ${job.status}`}>{job.status}</span></div>
    {source && <>
      <p className="import-phase">{fetching ? 'Fetching public game archives' : 'Download complete · local analysis'}</p>
      {fetching && <progress aria-label="Archive download progress" value={source.archives_processed} max={Math.max(1, source.archives_total)}/>}
      <p>{source.archives_processed} / {source.archives_total} archives checked · {source.games_fetched} games fetched</p>
      <p className="small">{source.games_imported} imported · {source.duplicates} duplicates · {source.filtered} filtered · {source.rejected} rejected</p>
      {source.fetch_completed && job.games_total === 0 && <p>{source.duplicates > 0 ? 'No new games found. Saved games were skipped; use Retry saved work on an earlier job to finish interrupted analysis.' : 'No matching games imported. Check the username, range and time control.'}</p>}
      {source.errors.length > 0 && <details><summary>Import issues ({source.rejected})</summary>{source.errors.map((error, index) => <p className="small" key={index}>{error.game ? `Game ${error.game}: ` : ''}{error.error}</p>)}</details>}
    </>}
    {job.kind === 'teaching' && <><progress aria-label="Teaching progress" value={job.games_processed} max={Math.max(1, job.games_total)}/><p>{job.games_processed} / {job.games_total} units processed</p><p className="small">{job.classifications_completed} historical summaries. Generation has been removed.</p></>}
    {!fetching && job.kind !== 'teaching' && job.kind !== 'enrichment' && job.kind !== 'game_review' && <><progress aria-label="Analysis progress" value={job.games_processed} max={Math.max(1, job.games_total)}/><p>{job.games_processed} / {job.games_total} {job.kind === 'teaching' ? 'units' : 'games'} · {job.positions_triaged} decisions</p><p className="small">{job.deep_completed} deep analyses · {job.mistakes_identified} practice-worthy moments · {job.classifications_completed} positions classified or left unclassified</p></>}
    {job.kind === 'game_review' && <p className="small">{job.positions_triaged} moves reviewed across both players. Open Games for the coach and playable variations. Cancel and retry preserve completed moves.</p>}
    {job.kind === 'enrichment' && <><progress aria-label="Deeper evidence progress" value={job.positions_triaged} max={Math.max(1, job.probe_total || 0)}/><p>{job.positions_triaged} / {job.probe_total || 0} selected positions processed</p><p className="small">Extra evidence is used for classification. Review answers and schedules stay unchanged. Cancel and retry preserve completed work.</p></>}
    {job.error && <p className="error-text">{job.error}</p>}
    {job.activity && <p className="small">Parallel work: {job.activity.games.active} game workers · {job.activity.classifications.active} classification workers · {job.activity.classifications.pending - job.activity.classifications.active} classification tasks waiting</p>}
    {job.kind === 'classification' && <p className="small">Cancel keeps completed work. Retry reuses saved results for the same rules, configuration and evidence.</p>}
    <div className="button-row">{['queued', 'running'].includes(job.status) && <button onClick={() => post(`/jobs/${job.id}/cancel`).then(reload).catch(fail)}>Cancel</button>}{job.kind !== 'teaching' && ['failed', 'cancelled'].includes(job.status) && <button onClick={() => post(`/jobs/${job.id}/retry`).then(reload).catch(fail)}>Retry saved work</button>}</div>
  </article>;
}
