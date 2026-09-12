import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, CircleCheck, FileUp, Flag, Focus, Layers, LockKeyhole, Settings2, ShieldCheck, X } from 'lucide-react';
import { api, post, type ExplanationFrame, type ColdPosition, type Evidence, type Feedback, type Job } from './api';
import Board from './Board';
import MoveStatus from './MoveStatus';
import ReviewExplanation from './ReviewExplanation';
import WeaknessScreen, {CoverageSummary} from './Weaknesses';
import appMark from './assets/fieldwork.svg';
import { ChessComImportForm, ImportJob } from './ChessComImport';

const tabs = [
  ['Review', Focus], ['Import', FileUp],
  ['Weaknesses', Flag], ['Settings', Settings2],
] as const;
type Tab = typeof tabs[number][0];
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function App() {
  const [tab, setTab] = useState<Tab>('Review');
  const [focusSkill, setFocusSkill] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState(false);
  const [token, setToken] = useState('');
  const [health, setHealth] = useState<any>(null);
  const [exercise, setExercise] = useState<string | null>(() => new URLSearchParams(window.location.search).get('exercise'));
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('unit')) clearExerciseLink();
    const connect = () => setConnection(true);
    window.addEventListener('connection-required', connect);
    api('/health').then(setHealth).catch(fail);
    return () => window.removeEventListener('connection-required', connect);
  }, [refresh, fail]);
  function navigate(next: Tab) { setFocusSkill(null); clearExerciseLink(); setTab(next); setError(''); setExercise(null); window.scrollTo({top: 0, behavior: 'instant'}); }
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header"><div className="header-inner">
      <a className="brand" href="#" onClick={e => {e.preventDefault(); navigate('Review');}} aria-label="Fieldwork home"><img src={appMark} width="34" height="34" alt=""/><span>fieldwork<span className="brand-sub">Chess training</span></span></a>
      <nav aria-label="Main navigation">{tabs.map(([name, Icon]) => <button key={name} aria-current={tab === name ? 'page' : undefined} className={tab === name ? 'nav-item active' : 'nav-item'} onClick={() => navigate(name)}><Icon size={17} strokeWidth={1.7} /><span>{name}</span></button>)}</nav>
      <span className="local-label"><span className="status-dot" /> Local</span>
    </div></header>
    <main id="main-content" tabIndex={-1} className={tab === 'Review' ? 'review-page' : 'workspace-page'}>
      {error && <div role="alert" className="notice error">{error}<button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={18}/></button></div>}
      {connection ? <section className="panel connection"><LockKeyhole/><h1>Connect to your workspace</h1><p>Enter the LAN token configured on your host computer.</p><form onSubmit={e => {e.preventDefault(); sessionStorage.setItem('lan-token', token); setConnection(false); setRefresh(v => v + 1); setError('');}}><label>Access token<input type="password" value={token} onChange={e => setToken(e.target.value)} required /></label><button className="primary">Connect</button></form></section> : <>
        {tab === 'Review' && <ReviewScreen key={`${refresh}-${focusSkill}`} focusSkill={focusSkill} onExitFocus={() => navigate('Review')} requested={exercise} onImport={() => navigate('Import')} fail={fail} onEvidence={setEvidenceId}/>}
        {tab === 'Import' && <ImportScreen health={health} fail={fail} />}
        {tab === 'Weaknesses' && <WeaknessScreen onPractice={skill => {navigate('Review'); setFocusSkill(skill);}} onEvidence={setEvidenceId} fail={fail} />}
        {tab === 'Settings' && <SettingsScreen fail={fail} />}
      </>}
    </main>
    <footer className="app-footer"><span>FIELDWORK <span className="footer-divider">/</span> PERSONAL CHESS TRAINING</span><span><ShieldCheck size={14}/> Games & practice stay on this computer</span></footer>
    {evidenceId && <EvidenceDialog id={evidenceId} onClose={() => setEvidenceId(null)} fail={fail}/>}
  </>;
}

function PageTitle({eyebrow, title, description, children}: {eyebrow: string; title: string; description: string; children?: React.ReactNode}) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>;
}

function clearExerciseLink() {
  const url = new URL(window.location.href);
  url.searchParams.delete('exercise');
  url.searchParams.delete('unit');
  window.history.replaceState(null, '', url);
}

function ReviewScreen({requested, focusSkill, onExitFocus, onImport, fail, onEvidence}: {focusSkill: string | null; onExitFocus: () => void; requested: string | null; onImport: () => void; fail: (e: unknown) => void; onEvidence: (id: string) => void}) {
  const [position, setPosition] = useState<ColdPosition | null>(null);
  const [due, setDue] = useState(0);
  const practiceBatch = useRef<{exercise_id: string}[] | null>(null);
  const practiced = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [mistakeCue, setMistakeCue] = useState(false);
  const [explanationFrame, setExplanationFrame] = useState<ExplanationFrame | null>(null);
  const explanationOpener = useRef<HTMLButtonElement | null>(null);
  const closeExplanation = useCallback(() => {
    setExplaining(false); setExplanationFrame(null); setMistakeCue(false);
    if (!feedback?.completed) {window.clearTimeout(previewTimer.current); setPreview(null);}
    window.requestAnimationFrame(() => explanationOpener.current?.focus({preventScroll: true}));
  }, [feedback?.completed]);
  const [preview, setPreview] = useState<'attempt' | 'reply' | null>(null);
  const previewTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(previewTimer.current);
    if (feedback?.counter_reply && !feedback.completed) {
      setPreview('attempt');
      previewTimer.current = window.setTimeout(() => setPreview('reply'), 400);
    } else setPreview(null);
    return () => window.clearTimeout(previewTimer.current);
  }, [feedback]);
  function retry() {
    setMistakeCue(false);
    window.clearTimeout(previewTimer.current);
    setPreview(null);
  }
  const previewFrame = preview === 'attempt' ? feedback?.attempt_frame : preview === 'reply' ? feedback?.counter_reply : undefined;
  const load = useCallback(async (id?: string | null, previous?: string | null) => {
    setLoading(true); setFeedback(null); setExplaining(false); setExplanationFrame(null); setMistakeCue(false);
    if (window.matchMedia('(max-width: 760px)').matches) window.scrollTo({top: 0, behavior: 'instant'});
    try {
      if (focusSkill && !practiceBatch.current) practiceBatch.current = await api(`/practice/queue?skill_id=${encodeURIComponent(focusSkill)}`);
      const queue = focusSkill ? (practiceBatch.current || []).filter(item => !practiced.current.has(item.exercise_id)) : await api<{exercise_id: string}[]>(`/review/queue${previous ? `?last_id=${previous}` : ''}`);
      setDue(queue.length);
      const next = id || queue[0]?.exercise_id;
      setPosition(next ? await post<ColdPosition>(`/review/${next}/start${focusSkill ? `?focus_skill_id=${encodeURIComponent(focusSkill)}` : ''}`) : null);
    } catch (e) { fail(e); } finally {setLoading(false);}
  }, [fail, focusSkill]);
  useEffect(() => {void load(requested);}, [load, requested]);
  async function answer(from: string, to: string, promotion?: string) {
    if (!position || busy || feedback?.completed || preview || explaining) return;
    setMistakeCue(false); setBusy(true);
    try {
      const result = await post<Feedback>(`/review/sessions/${position.session_id}/move`, {from_square: from, to_square: to, promotion: promotion || null});
      setFeedback(result); setMistakeCue(!result.completed);
      if (result.completed) {practiced.current.add(position.exercise_id); clearExerciseLink(); setDone(v => v + 1); setLast(position.exercise_id);}
    } catch (e) {fail(e);} finally {setBusy(false);}
  }
  async function show() {
    if (!position) return;
    setBusy(true);
    try {setFeedback(await post<Feedback>(`/review/sessions/${position.session_id}/reveal`)); setMistakeCue(false); practiced.current.add(position.exercise_id); clearExerciseLink(); setLast(position.exercise_id); setDone(v => v + 1);}
    catch(e) {fail(e);} finally {setBusy(false);}
  }
  return <>
    <PageTitle eyebrow={focusSkill ? "FOCUSED PRACTICE" : "TRAINING / REVIEW"} title="Your move." description="Build better decisions, one position at a time.">
      <div className="session-count"><strong>{done}</strong><span>{focusSkill ? 'practiced this session' : 'reviewed this session'}</span></div>
    </PageTitle>
    {loading ? <div className="panel loading">Loading your practice…</div> : <div className={`review-layout${position ? ' review-session' : ''}`}>
      <section className={`board-area${mistakeCue && !explaining ? ' review-mistake' : ''}`} aria-label="Chess position"><div className="board-topline"><span><span className={`turn-dot ${position?.fen.split(' ')[1] === 'b' ? 'black' : ''}`} />{explaining ? 'Line playback' : preview ? (preview === 'attempt' ? 'Your attempted move' : 'Opponent reply') : feedback?.completed ? (feedback.grade === 'revealed' ? 'Answer shown' : 'Move played') : position ? (position.fen.split(' ')[1] === 'w' ? 'White' : 'Black') + ' to move' : 'Your next move starts here'}</span><span>{position ? `${Math.max(0, due - (feedback?.completed ? 1 : 0))}${due === 30 ? '+' : ''} IN QUEUE` : 'NO POSITION LOADED'}</span></div>
        <Board key={position?.session_id || 'empty'} fen={explanationFrame?.fen || previewFrame?.fen || (feedback?.completed && feedback.fen ? feedback.fen : position?.fen || START)} roles={explanationFrame?.roles} highlights={explanationFrame?.highlights || previewFrame?.highlights || feedback?.reveal_frame?.highlights} orientation={position?.orientation || 'white'} legalMoves={position?.legal_moves} disabled={!position || busy || feedback?.completed || !!preview || explaining} onMove={answer}/>
        <div className="board-caption">{position ? 'Select a piece to see legal moves. Tap a destination or drag.' : 'Import a game to turn real decisions into useful practice.'}<span className="board-coordinate-note">POSITION PRACTICE</span></div>
      </section>
      <aside className="practice-panel">
        {explaining && position ? <ReviewExplanation sessionId={position.session_id} attemptId={feedback?.attempt_id || position.last_attempt_id} solution={feedback?.grade === 'revealed'} completed={!!feedback?.completed} initialPly={feedback?.counter_reply ? 2 : 1} onFrame={setExplanationFrame} onClose={closeExplanation}/> : !position ? <><span className="section-number">GET STARTED</span><h2>{focusSkill ? 'Practice complete.' : done ? 'You’re caught up.' : 'Train from your games.'}</h2><p>{focusSkill ? 'Your practice is saved separately. Review schedules and retirement progress are unchanged.' : done ? 'Your next reviews are scheduled. Come back when they’re due, or add another game.' : 'Bring in a PGN. We’ll look for decisions worth practicing and keep the useful positions here.'}</p><button className="primary" onClick={focusSkill ? onExitFocus : onImport}>{focusSkill ? 'Return to mixed review' : 'Import games'} <ArrowRight size={17}/></button><div className="aside-note"><ShieldCheck size={19}/><p>Stockfish analyzes on your computer. Local classification groups supported tactical patterns.</p></div></> : <>
          <div className="review-result-heading"><h2>{feedback?.completed ? (feedback.retired ? 'Position retired.' : feedback.grade === 'revealed' ? 'Move revealed.' : 'Good decision.') : mistakeCue ? 'Mistake.' : preview ? (preview === 'attempt' ? 'Your attempted move' : "Opponent's best reply") : 'Find a good move.'}</h2>
            {feedback?.completed && <strong className="review-move">{feedback.submitted_san || feedback.answers?.filter(a => a.primary).map(a => a.san).join(', ')}</strong>}
          </div>
          {feedback?.completed && <p className="review-message"><span>{feedback.message || 'Study the move, then try the next position.'}</span>{feedback.explanation_summary && <span className="review-reason" title={feedback.explanation_summary}>{feedback.explanation_summary}</span>}</p>}
          {!feedback?.completed && (previewFrame ? <div className="move-status counter-caption" role="status" aria-live="polite" aria-atomic="true"><span><strong>Mistake.</strong> {previewFrame.annotation}</span></div> : <MoveStatus busy={busy} failed={position.failed || !!(feedback && !feedback.completed)}/>)}
          {feedback?.completed && feedback.retired && <p className="review-due" role="status">Progress saved. Retired from future reviews.</p>}
          {feedback?.completed && feedback.next_due && <p className="review-due" role="status">Progress saved. Next review: <time dateTime={feedback.next_due} title={new Date(feedback.next_due).toLocaleString()}>{relativeDue(feedback.next_due)}</time>.</p>}
          <div className="review-actions">
            {feedback?.completed ? <button className="primary review-action" disabled={busy} onClick={() => load(null, last)}>Next position <ArrowRight size={17}/></button> : preview ? <button className="primary review-action" onClick={retry}>Try again</button> : <button className="secondary review-action" disabled={busy} onClick={show}>Reveal move</button>}
            {(feedback || position.last_attempt_id) && <button ref={explanationOpener} className="secondary review-why" disabled={busy} onClick={() => setExplaining(true)}>{feedback?.completed ? 'Show why' : 'Show me why'}</button>}
          </div>
          {focusSkill && <><p className="small practice-note">Focused practice. Your review schedule is unchanged.</p><button className="text-button" onClick={onExitFocus}>Return to mixed review</button></>}
          <details className="review-details" key={`${position.session_id}-${!!feedback?.completed}`}>
            <summary>{feedback?.completed ? 'Answer & review details' : 'Review details'}</summary>
            {feedback?.completed ? <>
              <div className="answer-feedback"><CircleCheck size={20}/><div><span>Accepted move{feedback.answers && feedback.answers.length > 1 ? 's' : ''}: {feedback.answers?.map(a => a.san).join(', ')}</span></div></div>
              {feedback.explanation && <p>{feedback.explanation}</p>}
              {feedback.played_san && <p className="small">In your game: {feedback.played_san} / {feedback.source}</p>}
              {feedback.retired && <p className="small">Your recall interval reached {Math.round(feedback.retired_interval_days || 0)} days. This position is permanently retired from reviews; your history is preserved.</p>}
              {feedback.next_due && <p className="small">Scheduled for {new Date(feedback.next_due).toLocaleString()}. Successful recalls build longer intervals. New positions can return within minutes while you learn them.</p>}
              {feedback.decision_id && <button className="text-button" onClick={() => onEvidence(feedback.decision_id!)}>See the evidence <ChevronRight size={16}/></button>}
            </> : <>
              <p>Select a piece to see legal moves. Tap a destination or drag.</p>
              {position.previous_reviews > 0 && <p>{({resume: 'Resuming your unfinished attempt. Your earlier result is saved.', learning: 'Learning review: this position is due again for a short follow-up. Your earlier result is saved.', relearning: 'Relearning review: this position is due again after a missed recall.', review: 'Scheduled review: time to recall this position again.', practice: 'Extra practice: you opened this position before its scheduled review.', new: ''})[position.review_reason]}</p>}
            </>}
            <p className="small muted">{focusSkill ? 'Practice attempts are stored separately from scheduled recall.' : 'Due reviews come first.'} A missed first attempt is recorded once; keep trying for as long as you need. FSRS spaces successful recalls farther apart. Positions retire permanently when their interval exceeds the retirement threshold in Settings.</p>
          </details>
        </>}
      </aside>
    </div>}
  </>;
}

function relativeDue(value: string) {
  const seconds = Math.max(0, (new Date(value).getTime() - Date.now()) / 1000);
  if (seconds < 60) return 'in less than a minute';
  const formatter = new Intl.RelativeTimeFormat(undefined, {numeric: 'always'});
  if (seconds < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (seconds < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
  return formatter.format(Math.round(seconds / 86400), 'day');
}

function PgnInput({file, setFile, text, setText}: {file: File | null; setFile: (file: File | null) => void; text: string; setText: (s: string) => void}) {
  return <><label className="upload-zone"><FileUp size={25}/><strong>{file?.name || 'Choose a PGN file'}</strong><span>One game or a collection · UTF-8</span><input type="file" accept=".pgn,text/plain" onChange={e => setFile(e.target.files?.[0] || null)}/></label><details><summary>Or paste PGN text</summary><label>PGN<textarea value={text} onChange={e => setText(e.target.value)} rows={7} placeholder={'[White "Your username"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 *'}/></label></details></>;
}

function ImportScreen({health, fail}: {health: any; fail: (e: unknown) => void}) {
  const [source, setSource] = useState<'chesscom' | 'pgn'>('chesscom');
  const [file, setFile] = useState<File | null>(null), [text, setText] = useState('');
  const [names, setNames] = useState(''), [side, setSide] = useState('auto');
  const [jobs, setJobs] = useState<Job[]>([]), [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const reload = useCallback(() => api<Job[]>('/jobs').then(setJobs).catch(fail), [fail]);
  useEffect(() => {reload(); const timer = setInterval(reload, 2000); return () => clearInterval(timer);}, [reload]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const body = new FormData(); body.append('file', file || new File([text], 'pasted-games.pgn')); body.append('usernames', names); body.append('side', side);
      setResult(await api('/imports', {method: 'POST', body})); await reload();
    } catch(e) {fail(e);} finally {setBusy(false);}
  }
  return <><PageTitle eyebrow="FROM PLAY TO PRACTICE" title="Import games" description="Find the decisions that matter in games you actually played."/>
    {!health?.engine_available && <div className="notice">{health?.engine_error || 'Checking engine availability…'}</div>}
    <div className="two-column"><div><div className="import-source" role="group" aria-label="Game source"><button aria-pressed={source === 'chesscom'} onClick={() => setSource('chesscom')}>Chess.com username</button><button aria-pressed={source === 'pgn'} onClick={() => setSource('pgn')}>PGN file</button></div>{source === 'chesscom' ? <ChessComImportForm onQueued={reload} fail={fail}/> : <form className="panel form-panel" onSubmit={submit}><h2>Import PGN</h2><PgnInput {...{file, setFile, text, setText}}/>
      <label>Your username(s)<input value={names} onChange={e => setNames(e.target.value)} placeholder="Match the White or Black PGN headers" required={side === 'auto'}/><small>Separate multiple usernames with commas. Matching ignores case.</small></label>
      <label>Learner side<select value={side} onChange={e => setSide(e.target.value)}><option value="auto">Match my username in each game</option><option value="white">I played White in every game</option><option value="black">I played Black in every game</option></select></label>
      <button className="primary" disabled={busy || (!file && !text.trim())}>{busy ? 'Importing…' : 'Import & analyze'}<ArrowRight size={17}/></button>
      {result && <div role="status" className="notice"><span>{result.imported} imported · {result.duplicates} duplicate(s).{result.errors.map((e: any, i: number) => <p key={i}>Game {e.game}: {e.error}</p>)}</span></div>}
    </form>}</div><section><h2 className="section-heading">Analysis activity</h2>{jobs.filter(job => job.kind !== 'teaching').length === 0 && <div className="empty-state"><Layers/><h3>No analysis jobs yet</h3><p>Your imports and their progress will appear here.</p></div>}
      {jobs.filter(job => job.kind !== 'teaching').filter((job, index) => showHistory || index < 3 || ['queued', 'running', 'failed', 'cancelled'].includes(job.status)).map(job => <ImportJob key={job.id} job={job} reload={reload} fail={fail}/>)}
      {jobs.filter(job => job.kind !== 'teaching').length > 3 && <button className="secondary history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Show recent activity' : 'Show older activity'}</button>}
    </section></div></>;
}

function SettingsScreen({fail}: {fail: (e: unknown) => void}) {
  const [data, setData] = useState<any>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {api('/settings').then(setData).catch(fail);}, [fail]);
  async function classify(enrich = false) {
    setBusy(true);
    try {await post(enrich ? '/classifications/enrich' : '/classifications/retry'); setMessage(enrich ? `Extra Stockfish evidence queued for up to ${data.classification_probe_positions} unclear positions. Watch progress in Import.` : 'Local classification queued. Watch progress in Import. Saved results are reused.');}
    catch (e) {fail(e);} finally {setBusy(false);}
  }
  return <><PageTitle eyebrow="LOCAL CONFIGURATION" title="Settings" description="Your engine, practice preferences and local workspace."/>{data && <div className="settings-grid">
    <section className="panel settings-panel"><h2>Chess analysis</h2><p className="setting-summary"><span className={`status-dot ${data.engine_available ? '' : 'unavailable'}`}/>{data.engine_available ? data.engine_version : 'Engine unavailable'}</p>
      {data.engine_error && <p className="error-text">{data.engine_error}</p>}
      <details><summary>Engine configuration</summary><dl><dt>Engine path</dt><dd className="mono">{data.stockfish_path}</dd><dt>Resources</dt><dd>{data.stockfish_workers} workers / {data.stockfish_threads} threads / {data.stockfish_hash_mb} MB hash each</dd><dt>Triage / deeper limits</dt><dd>{data.triage_time}s / {data.deep_time}s</dd><dt>Candidate lines</dt><dd>{data.multipv}</dd></dl></details>
    </section>
    <section className="panel settings-panel"><h2>Training policy</h2><dl className="setting-overview"><dt>Target rapid rating</dt><dd>{data.target_rating}</dd><dt>Answer policy</dt><dd>{data.acceptance_mode}</dd><dt>Retire positions after</dt><dd>Over {data.retire_after_days} days between reviews</dd></dl>
      <details><summary>Grading & scheduling</summary><dl><dt>Practical tolerance</dt><dd>{data.practical_tolerance_cp} centipawns</dd><dt>Slow answer threshold</dt><dd>{data.slow_answer_seconds} seconds</dd><dt>FSRS retention target</dt><dd>{Math.round(data.desired_retention * 100)}%</dd></dl><p className="small muted">Existing exercises retain their answer policy. Successful recalls build longer intervals until a position retires.</p></details>
    </section>
    <section className="panel settings-panel"><h2>Local mistake classification</h2><p>Patterns verified from engine lines and chess rules, on your computer.</p><button className="secondary" disabled={busy} onClick={() => classify()}>{busy ? 'Queuing classification...' : 'Classify saved games'}</button><button className="secondary" disabled={busy || !data.engine_available} onClick={() => classify(true)}>Deepen unclear positions</button><p className="small">Optional: up to {data.classification_probe_positions} positions, two searches of at most {data.classification_probe_time}s each. Completed work is reused.</p>{data.coverage && <CoverageSummary data={data.coverage}/>} {message && <p className="setting-message" role="status">{message}</p>}
      <details><summary>Classification details</summary><dl><dt>Rule version</dt><dd>{data.classification_version}</dd><dt>Workers</dt><dd>{data.classification_workers}</dd><dt>Saved runs</dt><dd>{data.classification_runs}</dd><dt>Historical abstentions</dt><dd>{data.classification_abstained}</dd><dt>Failed / rejected</dt><dd>{data.classification_failed} / {data.classification_rejected}</dd></dl><p className="small">Unclear causes stay unclassified. Supported labels include mate transitions, material consequences and specific tactical patterns.</p></details>
    </section>
    <section className="panel settings-panel"><h2>Workspace</h2><p>Games, reviews and progress are saved on your host computer.</p><details><summary>Storage & connection</summary><dl><dt>Database</dt><dd className="mono">{data.database_path}</dd><dt>LAN token</dt><dd>{data.lan_token_configured ? 'Required' : 'Not configured'}</dd></dl><p className="small">Back up with <code>python scripts/backup.py export backup.zip</code>. Secrets are excluded.</p><p className="small">Open the host's LAN address from devices on the same network. Do not expose the app directly to the public internet.</p></details><details><summary>How to change settings</summary><p className="small">Edit .env on the host computer, then restart the backend. These settings are read-only here.</p></details></section>
  </div>}</>;
}

function EvidenceDialog({id, onClose, fail}: {id: string; onClose: () => void; fail: (e: unknown) => void}) {
  const [data, setData] = useState<Evidence | null>(null), [audit, setAudit] = useState<any>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {element?.close(); opener?.focus({preventScroll: true});};
  }, []);
  useEffect(() => {api<Evidence>(`/evidence/${id}`).then(setData).catch(fail);}, [id, fail]);
  return <dialog ref={dialog} onCancel={onClose} aria-label="Decision evidence" className="evidence-dialog panel"><div className="row-between"><div><div className="eyebrow">VERIFIED GAME EVIDENCE</div><h2>Decision evidence</h2></div><button className="icon-button" onClick={onClose} aria-label="Close evidence"><X/></button></div>{data ? <div className="evidence-grid"><Board fen={data.fen} orientation={data.fen.split(' ')[1] === 'w' ? 'white' : 'black'} disabled/><div><h3>You played {data.played_san}</h3><p>{data.allows_mate ? 'The engine found a forced mate for the opponent.' : data.mate_lost ? 'The move gave up a verified forced mate.' : `Estimated loss: ${((data.loss_cp || 0) / 100).toFixed(2)} pawns.`}</p><h3>Engine candidates</h3>{data.candidates.map(c => <div className="candidate" key={c.san}><strong>{c.san}</strong><span>{c.score.kind === 'mate' ? `Mate ${c.score.value}` : (c.score.value / 100).toFixed(2)}</span><code>{c.pv.join(' ')}</code></div>)}{data.classifications.map(c => <div className="interpretation" key={c.skill}><span className="eyebrow">{c.provider === 'local_rules' ? 'LOCAL RULE FINDING' : 'HISTORICAL CLASSIFICATION'}</span><p>{c.explanation}</p><button className="text-button small" onClick={() => api(`/classification-runs/${c.run_id}`).then(setAudit).catch(fail)}>View classification audit</button><button className="text-button small" onClick={() => post(`/classification-runs/${c.run_id}/reject`).then(() => api<Evidence>(`/evidence/${id}`)).then(setData).catch(fail)}>Reject unsupported classification</button></div>)}{audit && <pre className="audit">{JSON.stringify(audit, null, 2)}</pre>}</div></div> : <p>Loading evidence…</p>}</dialog>;
}
