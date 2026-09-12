import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BookOpen, ChevronRight, CircleCheck, FileUp, Flag, Focus, Layers, LockKeyhole, RotateCcw, Settings2, ShieldCheck, X } from 'lucide-react';
import { api, post, type ColdPosition, type Evidence, type Feedback, type Job } from './api';
import Board from './Board';
import { ChessComImportForm, ImportJob } from './ChessComImport';

const tabs = [
  ['Review', Focus], ['Course', BookOpen], ['Import', FileUp],
  ['Weaknesses', Flag], ['Repertoire', Layers], ['Settings', Settings2],
] as const;
type Tab = typeof tabs[number][0];
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function App() {
  const [tab, setTab] = useState<Tab>('Review');
  const [error, setError] = useState('');
  const [connection, setConnection] = useState(false);
  const [token, setToken] = useState('');
  const [health, setHealth] = useState<any>(null);
  const [exercise, setExercise] = useState<string | null>(() => new URLSearchParams(window.location.search).get('exercise'));
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), []);
  useEffect(() => {
    const connect = () => setConnection(true);
    window.addEventListener('connection-required', connect);
    api('/health').then(setHealth).catch(fail);
    return () => window.removeEventListener('connection-required', connect);
  }, [refresh, fail]);
  function navigate(next: Tab) { setTab(next); setError(''); setExercise(null); }
  function practice(id: string) {setExercise(id); setTab('Review');}
  return <>
    <header className="app-header"><div className="header-inner">
      <a className="brand" href="#" onClick={e => {e.preventDefault(); navigate('Review');}}><span className="brand-mark">♞</span><span>fieldwork<span className="brand-sub">CHESS PRACTICE</span></span></a>
      <span className="local-label"><span className="status-dot" /> LOCAL WORKSPACE</span>
    </div></header>
    <div className="nav-wrap"><nav aria-label="Main navigation">{tabs.map(([name, Icon]) => <button key={name} className={tab === name ? 'nav-item active' : 'nav-item'} onClick={() => navigate(name)}><Icon size={17} strokeWidth={1.7} />{name}</button>)}</nav></div>
    <main>
      {error && <div role="alert" className="notice error">{error}<button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={18}/></button></div>}
      {connection ? <section className="panel connection"><LockKeyhole/><h1>Connect to your workspace</h1><p>Enter the LAN token configured on your host computer.</p><form onSubmit={e => {e.preventDefault(); sessionStorage.setItem('lan-token', token); setConnection(false); setRefresh(v => v + 1); setError('');}}><label>Access token<input type="password" value={token} onChange={e => setToken(e.target.value)} required /></label><button className="primary">Connect</button></form></section> : <>
        {tab === 'Review' && <ReviewScreen key={refresh} requested={exercise} onImport={() => navigate('Import')} fail={fail} onEvidence={setEvidenceId}/>}
        {tab === 'Import' && <ImportScreen health={health} fail={fail} />}
        {tab === 'Course' && <CourseScreen onPractice={practice} onEvidence={setEvidenceId} fail={fail} />}
        {tab === 'Weaknesses' && <WeaknessScreen onEvidence={setEvidenceId} fail={fail} />}
        {tab === 'Repertoire' && <RepertoireScreen fail={fail} />}
        {tab === 'Settings' && <SettingsScreen fail={fail} />}
      </>}
    </main>
    <footer><span>Good decisions. Repeated.</span><span><ShieldCheck size={14}/> Games & practice stay on this computer</span></footer>
    {evidenceId && <EvidenceDialog id={evidenceId} onClose={() => setEvidenceId(null)} fail={fail}/>}
  </>;
}

function PageTitle({eyebrow, title, description, children}: {eyebrow: string; title: string; description: string; children?: React.ReactNode}) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>;
}

function ReviewScreen({requested, onImport, fail, onEvidence}: {requested: string | null; onImport: () => void; fail: (e: unknown) => void; onEvidence: (id: string) => void}) {
  const [position, setPosition] = useState<ColdPosition | null>(null);
  const [due, setDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const load = useCallback(async (id?: string | null, previous?: string | null) => {
    setLoading(true); setFeedback(null);
    try {
      const queue = await api<{exercise_id: string}[]>(`/review/queue${previous ? `?last_id=${previous}` : ''}`);
      setDue(queue.length);
      const next = id || queue[0]?.exercise_id;
      setPosition(next ? await post<ColdPosition>(`/review/${next}/start`) : null);
    } catch (e) { fail(e); } finally {setLoading(false);}
  }, [fail]);
  useEffect(() => {void load(requested);}, [load, requested]);
  async function answer(from: string, to: string, promotion?: string) {
    if (!position || busy || feedback?.completed) return;
    setBusy(true);
    try {
      const result = await post<Feedback>(`/review/sessions/${position.session_id}/move`, {from_square: from, to_square: to, promotion: promotion || null});
      setFeedback(result);
      if (result.completed) {setDone(v => v + 1); setLast(position.exercise_id);}
    } catch (e) {fail(e);} finally {setBusy(false);}
  }
  async function show() {
    if (!position) return;
    setBusy(true);
    try {setFeedback(await post<Feedback>(`/review/sessions/${position.session_id}/reveal`)); setLast(position.exercise_id); setDone(v => v + 1);}
    catch(e) {fail(e);} finally {setBusy(false);}
  }
  return <>
    <PageTitle eyebrow="YOUR DAILY PRACTICE" title="Make the next good move." description="A position. A decision. A little better each time.">
      <div className="session-count"><strong>{done}</strong><span>reviewed this session</span></div>
    </PageTitle>
    {loading ? <div className="panel loading">Loading your practice…</div> : <div className="review-layout">
      <section className="board-area" aria-label="Chess position"><div className="board-topline"><span><span className={`turn-dot ${position?.fen.split(' ')[1] === 'b' ? 'black' : ''}`} />{position ? (position.fen.split(' ')[1] === 'w' ? 'White' : 'Black') + ' to move' : 'Your next move starts here'}</span><span>{position ? 'POSITION PRACTICE' : 'READY WHEN YOU ARE'}</span></div>
        <Board key={position?.session_id || 'empty'} fen={feedback?.completed && feedback.fen ? feedback.fen : position?.fen || START} orientation={position?.orientation || 'white'} legalMoves={position?.legal_moves} disabled={!position || busy || feedback?.completed} onMove={answer}/>
        <div className="board-caption">{position ? 'Select a piece to see legal moves. Tap a destination or drag.' : 'Import a game to turn real decisions into useful practice.'}<span>♔</span></div>
      </section>
      <aside className="practice-panel">
        {!position ? <><span className="section-number">01 / BEGIN</span><h2>{done ? 'You’re caught up.' : 'Your games are the starting point.'}</h2><p>{done ? 'Your next reviews are scheduled. Come back when they’re due, or add another game.' : 'Bring in a PGN. We’ll look for decisions worth practicing and keep the useful positions here.'}</p><button className="primary" onClick={onImport}>Import games <ArrowRight size={17}/></button><div className="aside-note"><ShieldCheck size={19}/><p>Stockfish analyzes on your computer. Optional classification can help organize what to learn.</p></div></> : <>
          <span className="section-number">{String(done + 1).padStart(2, '0')} / PRACTICE</span>
          <h2>{feedback?.completed ? (feedback.grade === 'revealed' ? 'Take a moment to see it.' : 'A good move to remember.') : 'Read the board.'}</h2>
          <p>{feedback?.completed ? feedback.message || 'Replay the idea in your mind before moving on.' : 'Take your time, then make your move.'}</p>
          {busy && <div role="status" className="notice">Checking your move…</div>}
          {feedback && !feedback.completed && <div role="status" className="notice retry"><RotateCcw size={17}/>{feedback.message}</div>}
          {feedback?.completed ? <>
            <div className="answer-feedback"><CircleCheck size={20}/><div><strong>{feedback.answers?.filter(a => a.primary).map(a => a.san).join(', ')}</strong><span>{feedback.answers && feedback.answers.length > 1 ? `Also accepted: ${feedback.answers.filter(a => !a.primary).map(a => a.san).join(', ')}` : 'Accepted move'}</span></div></div>
            {feedback.played_san && <p className="small">In your game: {feedback.played_san} · {feedback.source}</p>}
            <button className="primary" onClick={() => load(null, last)}>Next position <ArrowRight size={17}/></button>
            {feedback.decision_id && <button className="text-button" onClick={() => onEvidence(feedback.decision_id!)}>See the evidence <ChevronRight size={16}/></button>}
          </> : <button className="secondary" disabled={busy} onClick={show}>Show move</button>}
          <div className="aside-note"><Focus size={19}/><p>{due} due or new position{due === 1 ? '' : 's'} in your queue. Due reviews come first.</p></div>
          <p className="small muted">A missed first attempt is recorded once. Keep trying for as long as you need.</p>
        </>}
      </aside>
    </div>}
  </>;
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
  const reload = useCallback(() => api<Job[]>('/jobs').then(setJobs).catch(fail), [fail]);
  useEffect(() => {reload(); const timer = setInterval(reload, 2000); return () => clearInterval(timer);}, [reload]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const body = new FormData(); body.append('file', file || new File([text], 'pasted-games.pgn')); body.append('usernames', names); body.append('side', side);
      setResult(await api('/imports', {method: 'POST', body})); await reload();
    } catch(e) {fail(e);} finally {setBusy(false);}
  }
  return <><PageTitle eyebrow="FROM PLAY TO PRACTICE" title="Bring your games." description="Find the decisions that matter in games you actually played."/>
    {!health?.engine_available && <div className="notice">{health?.engine_error || 'Checking engine availability…'}</div>}
    <div className="two-column"><div><div className="import-source" role="group" aria-label="Game source"><button aria-pressed={source === 'chesscom'} onClick={() => setSource('chesscom')}>Chess.com username</button><button aria-pressed={source === 'pgn'} onClick={() => setSource('pgn')}>PGN file</button></div>{source === 'chesscom' ? <ChessComImportForm onQueued={reload} fail={fail}/> : <form className="panel form-panel" onSubmit={submit}><h2>Import PGN</h2><PgnInput {...{file, setFile, text, setText}}/>
      <label>Your username(s)<input value={names} onChange={e => setNames(e.target.value)} placeholder="Match the White or Black PGN headers" required={side === 'auto'}/><small>Separate multiple usernames with commas. Matching ignores case.</small></label>
      <label>Learner side<select value={side} onChange={e => setSide(e.target.value)}><option value="auto">Match my username in each game</option><option value="white">I played White in every game</option><option value="black">I played Black in every game</option></select></label>
      <button className="primary" disabled={busy || (!file && !text.trim())}>{busy ? 'Importing…' : 'Import & analyze'}<ArrowRight size={17}/></button>
      {result && <div role="status" className="notice"><span>{result.imported} imported · {result.duplicates} duplicate(s).{result.errors.map((e: any, i: number) => <p key={i}>Game {e.game}: {e.error}</p>)}</span></div>}
    </form>}</div><section><h2 className="section-heading">Analysis activity</h2>{jobs.length === 0 && <div className="empty-state"><Layers/><h3>No analysis jobs yet</h3><p>Your imports and their progress will appear here.</p></div>}
      {jobs.map(job => <ImportJob key={job.id} job={job} reload={reload} fail={fail}/>)}
    </section></div></>;
}

function CourseScreen({onPractice, onEvidence, fail}: {onPractice: (id: string) => void; onEvidence: (id: string) => void; fail: (e: unknown) => void}) {
  const [data, setData] = useState<any>(null);
  const reload = useCallback(() => api('/course').then(setData).catch(fail), [fail]);
  useEffect(() => {reload();}, [reload]);
  return <><PageTitle eyebrow="LEARN, THEN RETAIN" title="Your practice course." description="Useful concepts, ordered around evidence from your games."><button onClick={() => post('/course/rebuild').then(reload).catch(fail)}>Refresh course</button></PageTitle>
    {!data?.course ? <div className="empty-state panel"><BookOpen/><h2>A course needs evidence.</h2><p>Import and analyze your games, then enable skill classification in Settings. Verified positions remain available in Review while classification is unavailable.</p></div> : <div className="course-list">{data.units.map((unit: any, i: number) => <article className="panel course-unit" key={unit.id}><div className="unit-number">{String(i + 1).padStart(2, '0')}</div><div className="unit-body"><div className="eyebrow">{unit.provisional ? 'EXPLORATORY PRACTICE' : 'RECURRING EVIDENCE'}</div><h2>{unit.title}</h2><p>{unit.rationale}</p><div className="stages">{unit.lessons.map((lesson: any) => <div className="stage" key={lesson.id}><span>{lesson.completed ? '✓ ' : ''}{lesson.stage}</span><p>{({diagnose: 'Try an example before reading the explanation.', teach: 'Study the verified example and the teaching interpretation.', drill: 'Practice the decisions that support this unit.', retain: 'Keep the position in your spaced review queue.'} as any)[lesson.stage]}</p>{lesson.stage === 'teach' ? <button onClick={() => onEvidence(unit.decision_ids[0])}>Study example</button> : lesson.stage !== 'retain' ? <button disabled={!unit.exercise_ids.length} onClick={() => onPractice(unit.exercise_ids[0])}>Practice</button> : <span className="small">Added to review</span>}<button className="text-button small" disabled={lesson.completed} onClick={() => post(`/lessons/${lesson.id}/complete`).then(reload).catch(fail)}>{lesson.completed ? 'Completed' : 'Mark complete'}</button></div>)}</div><details><summary>Why this unit? · {unit.decision_ids.length} supporting decisions</summary><div className="button-row">{unit.decision_ids.map((id: string, index: number) => <button key={id} onClick={() => onEvidence(id)}>Example {index + 1}</button>)}</div></details></div></article>)}</div>}
  </>;
}

function WeaknessScreen({onEvidence, fail}: {onEvidence: (id: string) => void; fail: (e: unknown) => void}) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {api('/weaknesses').then(setData).catch(fail);}, [fail]);
  return <><PageTitle eyebrow="EVIDENCE, NOT LABELS" title="What deserves your attention." description="Repeated independent examples carry more weight than a single bad move."/>
    {data?.unclassified > 0 && <div className="notice">{data.unclassified} meaningful decisions await a supported classification. {data.classification_available ? 'Retry classification from Settings.' : 'OpenAI classification is currently unavailable; your engine evidence is saved.'}</div>}
    {!data?.skills.length ? <div className="empty-state panel"><Flag/><h2>No supported weaknesses yet.</h2><p>Classified evidence from your games will appear here, with the positions behind each teaching priority.</p></div> : <div className="panel weakness-list">{data.skills.map((skill: any) => <div className="weakness" key={skill.skill_id}><div><span className="eyebrow">{skill.provisional ? 'EXPLORATORY' : 'REPEATED PATTERN'}</span><h3>{skill.title}</h3><p>{skill.occurrences} examples · {skill.independent_games} independent games · {skill.reviews} reviews</p></div><button onClick={() => onEvidence(skill.decision_ids[0])}>See evidence <ChevronRight size={16}/></button></div>)}</div>}
  </>;
}

function RepertoireScreen({fail}: {fail: (e: unknown) => void}) {
  const [file, setFile] = useState<File | null>(null), [text, setText] = useState('');
  const [name, setName] = useState(''), [side, setSide] = useState('white');
  const [list, setList] = useState<any[]>([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const reload = useCallback(() => api<any[]>('/repertoires').then(setList).catch(fail), [fail]);
  useEffect(() => {reload();}, [reload]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {const body = new FormData(); body.append('file', file || new File([text], 'lines.pgn')); body.append('name', name); body.append('side', side); const result = await api('/repertoires', {method: 'POST', body}); setMessage(`${result.exercises} positions added. ${result.errors.length ? `${result.errors.length} invalid line(s) skipped.` : ''}`); await reload();} catch(e) {fail(e);} finally {setBusy(false);}
  }
  return <><PageTitle eyebrow="YOUR CHOSEN CONTINUATIONS" title="Know your lines." description="Your curated repertoire defines the answer. Train only your side."/><div className="two-column"><form onSubmit={submit} className="panel form-panel"><h2>Import a repertoire</h2><label>Repertoire name<input value={name} onChange={e => setName(e.target.value)} required placeholder="My opening lines"/></label><label>Train as<select value={side} onChange={e => setSide(e.target.value)}><option value="white">White</option><option value="black">Black</option></select></label><PgnInput {...{file, setFile, text, setText}}/><button className="primary" disabled={busy || (!file && !text.trim())}>Add repertoire <ArrowRight size={17}/></button>{message && <div role="status" className="notice">{message}</div>}</form><section><h2 className="section-heading">Your repertoires</h2>{list.length ? list.map(r => <article className="panel job" key={r.id}><h3>{r.name}</h3><p>{r.color} · {r.exercises} decision positions</p><span className="small muted">Included in your review queue</span></article>) : <div className="empty-state"><Layers/><p>No repertoire imported yet.</p></div>}<ManualForm fail={fail}/></section></div></>;
}

function ManualForm({fail}: {fail: (e: unknown) => void}) {
  const [fen, setFen] = useState(''), [moves, setMoves] = useState(''), [explanation, setExplanation] = useState(''), [orientation, setOrientation] = useState('white'), [message, setMessage] = useState('');
  async function submit(e: React.FormEvent) {e.preventDefault(); try {await post('/exercises/manual', {fen, moves: moves.split(/[\s,]+/).filter(Boolean), orientation, explanation}); setMessage('Position validated and added to your review queue.');} catch(e) {fail(e);}}
  return <details className="panel manual-form"><summary>Add a manual position</summary><form onSubmit={submit}><label>FEN<textarea value={fen} onChange={e => setFen(e.target.value)} required rows={3}/></label><label>Expected move(s), UCI<input value={moves} onChange={e => setMoves(e.target.value)} required placeholder="e2e4, d2d4"/></label><label>Board orientation<select value={orientation} onChange={e => setOrientation(e.target.value)}><option value="white">White</option><option value="black">Black</option></select></label><label>Explanation (optional)<textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2}/></label><button className="primary">Validate & add position</button>{message && <p role="status" className="success-text">{message}</p>}</form></details>;
}

function SettingsScreen({fail}: {fail: (e: unknown) => void}) {
  const [data, setData] = useState<any>(null), [message, setMessage] = useState('');
  useEffect(() => {api('/settings').then(setData).catch(fail);}, [fail]);
  return <><PageTitle eyebrow="LOCAL CONFIGURATION" title="Your training setup." description="Configuration lives in .env on the host. Restart the server after editing it."/>{data && <div className="settings-grid">
    <section className="panel"><h2>Chess analysis</h2><dl><dt>Native engine</dt><dd>{data.engine_available ? data.engine_version : 'Unavailable'}</dd><dt>Engine path</dt><dd className="mono">{data.stockfish_path}</dd><dt>Resources</dt><dd>{data.stockfish_workers} worker(s) · {data.stockfish_threads} thread(s) · {data.stockfish_hash_mb} MB hash each</dd><dt>Triage / deeper limits</dt><dd>{data.triage_time}s / {data.deep_time}s · {data.multipv} candidate lines</dd></dl>{data.engine_error && <p className="error-text">{data.engine_error}</p>}</section>
    <section className="panel"><h2>Training policy</h2><dl><dt>Target rapid rating</dt><dd>{data.target_rating}</dd><dt>Answer policy</dt><dd>{data.acceptance_mode}</dd><dt>Practical tolerance</dt><dd>{data.practical_tolerance_cp} centipawns</dd><dt>Slow answer threshold</dt><dd>{data.slow_answer_seconds} seconds</dd><dt>FSRS retention target</dt><dd>{Math.round(data.desired_retention * 100)}%</dd></dl><p className="small muted">Rating guides teaching priorities. It does not change engine evaluations. Existing exercises retain their answer policy.</p></section>
    <section className="panel"><h2>Optional skill classification</h2><dl><dt>Status</dt><dd>{data.classification_available ? 'Enabled' : 'Unavailable'}</dd><dt>API key</dt><dd>{data.openai_key_configured ? 'Configured on backend' : 'Not configured'}</dd><dt>Model</dt><dd>{data.openai_model}</dd><dt>Concurrency</dt><dd>Up to {data.llm_workers} classification requests</dd><dt>Requests</dt><dd>{data.llm_attempts} attempts · {data.llm_failed} failed runs</dd><dt>Recorded tokens</dt><dd>{data.llm_input_tokens} input · {data.llm_output_tokens} output</dd></dl><p className="small">To enable, set OPENAI_API_KEY and LLM_ENABLED=true in .env. Verified mistake evidence is sent to OpenAI; game headers are omitted.</p><button disabled={!data.classification_available} onClick={() => post('/classifications/retry').then(() => setMessage('Classification queued. Watch progress in Import.')).catch(fail)}>Retry unclassified evidence</button>{message && <p role="status">{message}</p>}</section>
    <section className="panel"><h2>Storage & connection</h2><dl><dt>Database</dt><dd className="mono">{data.database_path}</dd><dt>LAN token</dt><dd>{data.lan_token_configured ? 'Required' : 'Not configured'}</dd></dl><p className="small">Back up with <code>python scripts/backup.py export backup.zip</code>. The backup includes your learning history and safe settings, with no API key.</p><p className="small">For local network access set SERVER_HOST=0.0.0.0. Do not expose this application directly to the public internet.</p></section>
  </div>}</>;
}

function EvidenceDialog({id, onClose, fail}: {id: string; onClose: () => void; fail: (e: unknown) => void}) {
  const [data, setData] = useState<Evidence | null>(null), [audit, setAudit] = useState<any>(null);
  useEffect(() => {api<Evidence>(`/evidence/${id}`).then(setData).catch(fail);}, [id, fail]);
  useEffect(() => {const escape = (e: KeyboardEvent) => {if(e.key === 'Escape') onClose();}; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);}, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}><section role="dialog" aria-modal="true" aria-label="Decision evidence" className="evidence-dialog panel" onClick={e => e.stopPropagation()}><div className="row-between"><div><div className="eyebrow">VERIFIED GAME EVIDENCE</div><h2>The decision behind the lesson</h2></div><button className="icon-button" onClick={onClose} aria-label="Close evidence"><X/></button></div>{data ? <div className="evidence-grid"><Board fen={data.fen} orientation={data.fen.split(' ')[1] === 'w' ? 'white' : 'black'} disabled/><div><h3>You played {data.played_san}</h3><p>{data.allows_mate ? 'The engine found a forced mate for the opponent.' : data.mate_lost ? 'The move gave up a verified forced mate.' : `Estimated loss: ${((data.loss_cp || 0) / 100).toFixed(2)} pawns.`}</p><h3>Engine candidates</h3>{data.candidates.map(c => <div className="candidate" key={c.san}><strong>{c.san}</strong><span>{c.score.kind === 'mate' ? `Mate ${c.score.value}` : (c.score.value / 100).toFixed(2)}</span><code>{c.pv.join(' ')}</code></div>)}{data.classifications.map(c => <div className="interpretation" key={c.skill}><span className="eyebrow">MODEL TEACHING INTERPRETATION</span><p>{c.explanation}</p><button className="text-button small" onClick={() => api(`/llm-runs/${c.run_id}`).then(setAudit).catch(fail)}>View classification audit</button></div>)}{audit && <pre className="audit">{JSON.stringify(audit, null, 2)}</pre>}</div></div> : <p>Loading evidence…</p>}</section></div>;
}
