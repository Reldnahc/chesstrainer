import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FlipVertical2, GitBranch, RefreshCw } from "lucide-react";
import { api, post, type LegalMove, type ExplanationFrame } from "./api";
import Board from "./Board";
import PageTitle from "./PageTitle";

type Score = { kind: "cp" | "mate"; value: number; mate_given?: boolean };
type Finding = { skill_id: string; explanation: string; frame_ply: number; roles: Record<string, string[]> };
type Line = { frames: ExplanationFrame[]; findings: Finding[]; material_delta: number | null; settled: boolean };
type Candidate = { uci: string; san: string; pv: string[]; score: Score };
type Report = {
  label: string; reason: string; coach: string; best: Candidate; actual: Candidate;
  white_score: Score; actual_line: Line; best_line: Line; depth: number; engine_version: string;
};
type Position = { fen: string; legal_moves: LegalMove[]; turn: "white" | "black"; result: string | null; termination: string | null; san: string };
type Frame = Position & { uci: string | null; number: number; actor: "white" | "black" | null; report: Report | null };
type Game = {
  id: string; white: string; black: string; played_on: string | null; result: string;
  orientation: "white" | "black"; rating: number; frames: Frame[];
  job: { id: string; status: string; completed: number; total: number; error: string | null; cancel_requested: boolean } | null;
};
type Item = { id: string; white: string; black: string; played_on: string | null; result: string; status: string };
type Branch = { id: number; root: number; moves: string[]; sans: string[]; };
type Cursor = { ply: number; branch: number | null; step: number };
type Analysis = { report: Report | null; score: Score | null; best_move: string | null };
const labels = ["Brilliant", "Great", "Best", "Good", "Inaccuracy", "Mistake", "Miss", "Blunder"];
const symbols: Record<string, string> = { Brilliant: "!!", Great: "!", Best: "★", Good: "✓", Inaccuracy: "?!", Mistake: "?", Miss: "↗", Blunder: "??" };
const bad = new Set(["Inaccuracy", "Mistake", "Miss", "Blunder"]);
const dateText = (date: string | null) => date && !date.includes("?") ? date : "Date unknown";

function scoreText(score: Score | null | undefined) {
  if (!score) return "—";
  if (score.kind === "mate") return `${score.value > 0 || score.mate_given ? "+" : "−"}M${Math.abs(score.value)}`;
  return `${score.value >= 0 ? "+" : ""}${(score.value / 100).toFixed(2)}`;
}
function strength(score: Score) {
  return score.kind === "mate" ? (score.value > 0 || score.mate_given ? 1 : -1) : Math.tanh(score.value / 400);
}
function Badge({ label }: { label: string }) {
  return <span className={`game-badge label-${label.toLowerCase()}`}><b>{symbols[label]}</b>{label}</span>;
}
function CoachAvatar() {
  return <svg className="game-coach-avatar" viewBox="0 0 80 100" role="img" aria-label="Your chess coach">
    <path d="M9 100V82Q10 65 30 65H50Q70 65 71 82V100" fill="#5d7770" />
    <path d="m29 67 11 15 11-15-3-9H32Z" fill="#edb38a" />
    <ellipse cx="40" cy="39" rx="24" ry="29" fill="#f2c5a0" />
    <path d="M16 37Q8 5 35 6Q67 0 65 39L57 29Q43 33 29 19L22 38Z" fill="#dad4ca" />
    <path d="M20 52Q40 73 60 52Q54 77 40 74Q24 72 20 52" fill="#dad4ca" />
    <g fill="none" stroke="#393c42" strokeWidth="2.5"><rect x="23" y="35" width="14" height="11" rx="4"/><rect x="43" y="35" width="14" height="11" rx="4"/><path d="M37 39h6M33 55q7 6 14 0"/></g>
    <circle cx="30" cy="40" r="1.5" fill="#393c42"/><circle cx="50" cy="40" r="1.5" fill="#393c42"/>
    <path d="m27 70 13 12-9 10-10-19m32-3L40 82l9 10 10-19" fill="#849e94"/>
  </svg>;
}

export default function GamesScreen({ onImport }: { onImport: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [offset, setOffset] = useState(0), [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api<{ items: Item[]; total: number }>(`/games?offset=${offset}`).then(data => {
      if (active) { setItems(data.items); setTotal(data.total); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [offset, selected]);
  if (selected) return <GameWorkspace key={selected} id={selected} onBack={() => setSelected(null)} />;
  return <>
    <PageTitle eyebrow="EVERY MOVE HAS A STORY" title="Your games" description="Review the turning points. Follow the ideas. Try a different move.">
      <button className="primary" onClick={onImport}>Import games</button>
    </PageTitle>
    {error && <p role="alert" className="notice error">{error}</p>}
    {loading ? <p role="status">Loading your games…</p> : !items.length ? <section className="panel"><h2>Your next insight starts with a game.</h2><p>Import a PGN or your Chess.com games to review both sides with your local coach.</p><button onClick={onImport}>Go to Import</button></section> : <div className="game-library">
      {items.map(item => <button key={item.id} className="game-library-item" onClick={() => setSelected(item.id)}>
        <span><strong>{item.white} <span className="muted">vs</span> {item.black}</strong><small>{dateText(item.played_on)} · {item.result}</small></span>
        <span className="game-library-status">{item.status === "completed" ? "Open review" : item.status === "not_started" ? "Review game" : item.status.replaceAll("_", " ")} <ChevronRight size={18}/></span>
      </button>)}
    </div>}
    {total > 30 && <div className="game-pagination"><button disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - 30))}>Previous games</button><span>{offset + 1}–{Math.min(offset + 30, total)} of {total}</span><button disabled={offset + 30 >= total} onClick={() => setOffset(n => n + 30)}>More games</button></div>}
  </>;
}

function GameWorkspace({ id, onBack }: { id: string; onBack: () => void }) {
  const [game, setGame] = useState<Game | null>(null);
  const [cursor, setCursor] = useState<Cursor>({ ply: 0, branch: null, step: 0 });
  const [branches, setBranches] = useState<Branch[]>([]);
  const nextId = useRef(1);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [rating, setRating] = useState(1000);
  const [busy, setBusy] = useState(false), [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [branchPosition, setBranchPosition] = useState<{ key: string; value: Position } | null>(null);
  const [analysis, setAnalysis] = useState<{ key: string; value: Analysis } | null>(null);
  const [analysisError, setAnalysisError] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [lineView, setLineView] = useState<{ branch: number; offset: number; line: Line; finding: Finding | null; title: string } | null>(null);
  const mounted = useRef(true);
  const activeKey = useRef("");
  const inFlight = useRef<Promise<unknown> | null>(null);
  const cache = useRef(new Map<string, Analysis>());
  const moveButtons = useRef(new Map<number, HTMLButtonElement>());
  const branch = branches.find(b => b.id === cursor.branch);
  const path = branch ? branch.moves.slice(0, cursor.step) : [];
  const root = branch ? branch.root : cursor.ply;
  const key = `${root}:${path.join(",")}`;
  const analysisKey = `${key}@${game?.rating ?? 1000}`;
  activeKey.current = key;
  const saved = !branch ? game?.frames[cursor.ply]?.report : null;
  const frame = branch ? (branchPosition?.key === key ? branchPosition.value : null) : game?.frames[cursor.ply];
  const report = saved || (analysis?.key === analysisKey ? analysis.value.report : null);
  const score = report?.white_score || (analysis?.key === analysisKey ? analysis.value.score : null);
  const line = lineView?.branch === branch?.id ? lineView : null;
  const lineIndex = line ? cursor.step - line.offset : -1;
  const lineFrame = line?.line.frames[lineIndex];
  const currentFinding = line?.finding;
  const actor = report ? (frame?.turn === "white" ? "Black" : "White") : null;
  const load = useCallback(() => api<Game>(`/games/${id}`).then(data => {
    if (mounted.current) setGame(data);
    return data;
  }), [id]);
  useEffect(() => {
    mounted.current = true;
    load().then(data => { if (mounted.current) { setOrientation(data.orientation); setRating(data.rating); } }).catch(e => { if (mounted.current) setError(e.message); });
    return () => { mounted.current = false; };
  }, [load]);
  const running = game?.job && ["queued", "running"].includes(game.job.status);
  useEffect(() => {
    if (!running) return;
    let active = true;
    const timer = window.setInterval(() => { if (active) load().catch(e => { if (active) setError(e.message); }); }, 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, [running, load]);
  useEffect(() => {
    if (!branch) return;
    let active = true;
    post<Position>(`/games/${id}/position`, { ply: root, moves: path }).then(value => {
      if (active) setBranchPosition({ key, value });
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
    // The key completely identifies this position, including repetition history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key, !!branch]);
  useEffect(() => {
    if (!game || saved || !frame) return;
    let active = true;
    const requestKey = analysisKey;
    const timer = window.setTimeout(async () => {
      // Wait for the previous search; fast navigation never queues a pile of engines.
      if (inFlight.current) await inFlight.current;
      if (!active) return;
      if (cache.current.has(requestKey)) { setAnalysis({ key: requestKey, value: cache.current.get(requestKey)! }); return; }
      const work = post<Analysis>(`/games/${id}/analyze`, { ply: root, moves: path }).then(value => {
        cache.current.set(requestKey, value);
        if (active) { setAnalysis({ key: requestKey, value }); setAnalysisError(null); }
      }).catch(e => { if (active) setAnalysisError({ key: requestKey, message: e.message }); });
      inFlight.current = work;
      await work;
      if (inFlight.current === work) inFlight.current = null;
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
    // Saved report arriving during a search supersedes that search's result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key, !!frame, !!saved, retry, game?.rating]);
  useEffect(() => {
    if (!branch) moveButtons.current.get(cursor.ply)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cursor.ply, !!branch]);

  function navigate(ply: number) { setCursor({ ply, branch: null, step: 0 }); setLineView(null); setError(""); }
  const navigateRef = useRef<(delta: number) => void>(() => {});
  navigateRef.current = delta => {
    if (!game) return;
    if (branch) setCursor(c => ({ ...c, step: Math.max(0, Math.min(branch.moves.length, c.step + delta)) }));
    else navigate(Math.max(0, Math.min(game.frames.length - 1, cursor.ply + delta)));
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input,select,textarea,[contenteditable=true]")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); navigateRef.current(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  function addBranch(base: number, moves: string[], sans: string[], step: number, extend = false) {
    const existing = branches.find(b => b.root === base && b.moves.join() === moves.join());
    const extending = !existing && extend && branch && cursor.step === branch.moves.length;
    const id = existing?.id ?? (extending ? branch.id : nextId.current++);
    if (extending) setBranches(values => values.map(b => b.id === id ? { id, root: base, moves, sans } : b));
    else if (!existing) setBranches(values => [...values, { id, root: base, moves, sans }]);
    setCursor({ ply: base, branch: id, step });
    return id;
  }
  async function play(from: string, to: string, promotion?: string) {
    if (!frame || moving) return;
    const requestKey = key;
    const moves = [...path, from + to + (promotion || "")];
    if (moves.length > 128) { setError("This variation has reached 128 moves. Return to the game to start another."); return; }
    setMoving(true); setError("");
    try {
      const next = await post<Position>(`/games/${id}/position`, { ply: root, moves });
      if (!mounted.current || activeKey.current !== requestKey) return;
      addBranch(root, moves, [...(branch ? branch.sans.slice(0, cursor.step) : []), next.san], moves.length, true);
      setBranchPosition({ key: `${root}:${moves.join(",")}`, value: next });
      setLineView(null);
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setMoving(false); }
  }
  function showLine(which: "actual" | "best", finding: Finding | null = null) {
    if (!report) return;
    const selected = which === "actual" ? report.actual_line : report.best_line;
    const inVariation = branch && path.length > 0;
    const prefix = inVariation ? path.slice(0, -1) : [];
    const base = inVariation ? root : Math.max(0, root - 1);
    const moves = [...prefix, ...selected.frames.slice(1).map(f => f.uci!)];
    const sans = [...(inVariation ? branch.sans.slice(0, cursor.step - 1) : []), ...selected.frames.slice(1).map(f => f.san)];
    const branchId = addBranch(base, moves, sans, prefix.length + (finding ? finding.frame_ply : Math.min(1, selected.frames.length - 1)));
    setLineView({ branch: branchId, offset: prefix.length, line: selected, finding, title: which === "best" ? "Better-move line" : "Played-move line" });
  }
  async function start() {
    setBusy(true); setError("");
    try {
      await post(`/games/${id}/review`, { rating });
      cache.current.clear(); setAnalysis(null);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!game?.job) return;
    setBusy(true);
    try { await post(`/jobs/${game.job.id}/cancel`); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (!game) return <><button onClick={onBack}><ArrowLeft size={16}/>All games</button><p role={error ? "alert" : "status"}>{error || "Opening game…"}</p></>;
  const last = game.frames.length - 1;
  const current = branch ? cursor.step : cursor.ply;
  const maximum = branch ? branch.moves.length : last;
  const errorAtPosition = analysisError?.key === analysisKey ? analysisError.message : null;
  const summary = labels.map(label => ({ label, white: game.frames.filter(f => f.actor === "white" && f.report?.label === label).length, black: game.frames.filter(f => f.actor === "black" && f.report?.label === label).length }));
  const displayed = frame || (branchPosition?.value ?? game.frames[cursor.ply]);
  const currentUci = branch ? path.at(-1) : game.frames[cursor.ply].uci;
  return <div className="game-workspace">
    <div className="game-heading"><button className="text-button" onClick={onBack}><ArrowLeft size={16}/>All games</button><span>{dateText(game.played_on)} · {game.result}</span></div>
    <PageTitle eyebrow="GAME REVIEW" title={`${game.white} vs ${game.black}`} description="Move any piece to explore. Your original game is always one click away." />
    {error && <p className="notice error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></p>}
    <div className="game-review-layout">
      <section className="game-board-area" aria-label="Game board and navigation">
        <div className="game-player"><span>{orientation === "white" ? game.black : game.white}</span><span>{branch ? "Exploring a variation" : "Original game"}</span></div>
        <div className="game-board-with-eval">
          <div className="game-eval-bar" aria-label={`Evaluation for White: ${scoreText(score)}`}><div style={{ height: `${score ? 50 + 48 * strength(score) : 50}%` }} /><span>{scoreText(score)}</span></div>
          <Board fen={displayed.fen} orientation={orientation} legalMoves={frame?.legal_moves || []} disabled={!frame || moving} onMove={play}
            highlights={lineFrame?.highlights || (currentUci ? [currentUci.slice(0, 2), currentUci.slice(2, 4)] : [])}
            roles={currentFinding?.frame_ply === lineIndex ? currentFinding.roles : undefined}/>
        </div>
        <div className="game-player"><strong>{orientation === "white" ? game.white : game.black}</strong><span>{frame?.termination ? `${frame.result} · ${frame.termination}` : `${frame?.turn || displayed.turn} to move`}</span></div>
        <div className="game-board-controls" role="group" aria-label="Game navigation">
          <button aria-label="First move" disabled={current === 0} onClick={() => branch ? setCursor(c => ({ ...c, step: 0 })) : navigate(0)}><ChevronsLeft size={19}/></button>
          <button aria-label="Previous move" disabled={current === 0} onClick={() => navigateRef.current(-1)}><ChevronLeft size={19}/></button>
          <span>{current} / {maximum}</span>
          <button aria-label="Next move" disabled={current === maximum} onClick={() => navigateRef.current(1)}><ChevronRight size={19}/></button>
          <button aria-label="Last move" disabled={current === maximum} onClick={() => branch ? setCursor(c => ({ ...c, step: maximum })) : navigate(last)}><ChevronsRight size={19}/></button>
          <button aria-label="Flip board" onClick={() => setOrientation(v => v === "white" ? "black" : "white")}><FlipVertical2 size={17}/></button>
        </div>
        {branch && <div className="game-branch-banner"><GitBranch size={16}/><span>{line?.title || "Your variation"} · from ply {branch.root}</span><button onClick={() => navigate(branch.root)}>Return to game</button></div>}
        <EvaluationGraph frames={game.frames} selected={cursor.ply} onSelect={navigate}/>
        {!!branches.length && <details className="game-variations" open><summary>Variations ({branches.length})</summary><p className="small">Kept while this game is open. Undo and play another move to branch again.</p>{branches.map(b => <div key={b.id} className="game-variation-row"><span>#{b.id} · ply {b.root}</span>{b.sans.map((san, index) => <button key={index} aria-pressed={branch?.id === b.id && cursor.step === index + 1} onClick={() => { setCursor({ ply: b.root, branch: b.id, step: index + 1 }); setLineView(null); }}>{san}</button>)}</div>)}</details>}
      </section>
      <aside className="game-review-sidebar">
        <section className="game-coach" aria-label="Chess coach"><CoachAvatar/><div className="game-speech">
          <div className="game-coach-label"><strong>{actor ? `${actor} · ${frame?.san || "Move"}` : "Your coach"}</strong>{report && <Badge label={report.label}/>}</div>
          <p aria-live="polite">{lineFrame ? currentFinding?.explanation || lineFrame.annotation : report?.coach || (errorAtPosition ? "You can still explore the board. Engine coaching is unavailable for this position." : cursor.ply === 0 && !branch ? "Let's look at the ideas in this game. Start a review for the full story, or move a piece to try your own line." : "I'm checking this move and the opponent's strongest reply…")}</p>
          {report && !lineFrame && report.coach !== report.reason && <p className="small muted">{report.reason}</p>}
          {report && <div className="game-coach-actions"><button onClick={() => showLine("actual")}>Show why</button>{report.actual.uci !== report.best.uci && <button onClick={() => showLine("best")}>Show {report.best.san}</button>}</div>}
          {!report && analysis?.key === analysisKey && analysis.value.best_move && <p className="small">Engine suggestion: {analysis.value.best_move} · {scoreText(score)}</p>}
          {errorAtPosition && <><p className="small" role="alert">{errorAtPosition}</p><button onClick={() => { setAnalysisError(null); setRetry(n => n + 1); }}><RefreshCw size={14}/>Retry analysis</button></>}
        </div></section>
        {report && <div className="game-patterns">{report.actual_line.findings.map((f, i) => <button key={i} onClick={() => showLine("actual", f)}>Show {f.skill_id.replaceAll("_", " ")}</button>)}<details><summary>Analysis details</summary><p>{report.engine_version} · depth {report.depth}. White evaluation: {scoreText(report.white_score)}.</p><p>Lines show strong engine replies. A tactic visible in a line does not prove every defense loses material.</p></details></div>}
        <section className="game-progress panel">
          <div className="row-between"><h2>Game report</h2><span>{game.job ? `${game.job.completed}/${game.job.total} moves` : `${last} moves`}</span></div>
          {game.job && <progress value={game.job.completed} max={game.job.total || 1} aria-label="Game review progress"/>}
          {running ? <div className="row-between"><p role="status">{game.job?.cancel_requested ? "Finishing the current move…" : game.job?.status === "queued" ? "Review queued. You can explore while you wait." : "Reviewing both sides…"}</p><button disabled={busy || game.job?.cancel_requested} onClick={cancel}>Pause review</button></div> : <div className="button-row"><button className="primary" disabled={busy} onClick={start}>{game.job?.status === "completed" ? "Update labels" : game.job ? "Resume review" : "Start game review"}</button></div>}
          {game.job?.error && <p className="small" role="alert">{game.job.error}</p>}
          <details><summary>Blunder sensitivity</summary><label>Player rating<select value={rating} disabled={!!running} onChange={e => setRating(Number(e.target.value))}>{Array.from(new Set([600, 1000, 1500, 2000, 2500, game.rating])).sort((a,b) => a-b).map(n => <option key={n} value={n}>{n}</option>)}</select></label><p className="small">Only the Blunder label changes with rating. Decisive pawn losses still count. Applies to both players; use {game.job?.status === "completed" ? "Update labels" : "Start / Resume review"} to save.</p></details>
        </section>
        {!!game.job?.completed && <details className="game-summary"><summary>Move quality · {game.job.status === "completed" ? "complete game" : "analyzed moves so far"}</summary><table><thead><tr><th>Move quality</th><th>White</th><th>Black</th></tr></thead><tbody>{summary.map(s => <tr key={s.label}><td><Badge label={s.label}/></td><td>{s.white}</td><td>{s.black}</td></tr>)}</tbody></table></details>}
        <div className="game-move-heading"><h2>Moves</h2><button onClick={() => {
          const next = game.frames.findIndex((f, i) => i > cursor.ply && f.report && bad.has(f.report.label));
          const first = game.frames.findIndex(f => f.report && bad.has(f.report.label));
          if (next >= 0 || first >= 0) navigate(next >= 0 ? next : first);
        }} disabled={!game.frames.some(f => f.report && bad.has(f.report.label))}>Next mistake</button></div>
        <div className="game-move-list" aria-label="Game moves">{game.frames.slice(1).map((f, index) => {
          const ply = index + 1;
          return <button key={ply} ref={element => { if (element) moveButtons.current.set(ply, element); else moveButtons.current.delete(ply); }} aria-current={!branch && cursor.ply === ply ? "step" : undefined} onClick={() => navigate(ply)} aria-label={`${f.number}${f.actor === "white" ? "." : "..."} ${f.san}${f.report ? `, ${f.report.label}` : ""}`}>
            <span className="game-move-number">{f.number}{f.actor === "white" ? "." : "…"}</span><strong>{f.san}</strong>{f.report && <span className={`game-move-symbol label-${f.report.label.toLowerCase()}`} title={f.report.label}>{symbols[f.report.label]}</span>}
          </button>;
        })}</div>
      </aside>
    </div>
  </div>;
}

function EvaluationGraph({ frames, selected, onSelect }: { frames: Frame[]; selected: number; onSelect: (ply: number) => void }) {
  const width = 600, height = 105;
  const x = (i: number) => 8 + i / Math.max(1, frames.length - 1) * (width - 16);
  const y = (score: Score) => height / 2 - strength(score) * (height / 2 - 8);
  return <div className="game-graph"><div className="row-between"><strong>Evaluation</strong><span>White ↑ · Black ↓</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evaluation across analyzed game moves">
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="#44484f" strokeDasharray="4 4"/>
      {frames.map((f, i) => f.report && <g key={i}>
        {i > 0 && frames[i - 1].report && <line x1={x(i - 1)} y1={y(frames[i - 1].report!.white_score)} x2={x(i)} y2={y(f.report.white_score)} stroke="#b8cfc2" strokeWidth="2"/>}
        <circle cx={x(i)} cy={y(f.report.white_score)} r={i === selected ? 4 : 2} fill={bad.has(f.report.label) ? "#ff8059" : "#b8cfc2"}/>
      </g>)}<line x1={x(selected)} x2={x(selected)} y1="0" y2={height} stroke="#ff8059" opacity=".6"/>
    </svg><input type="range" min="0" max={frames.length - 1} value={selected} onChange={e => onSelect(Number(e.target.value))} aria-label="Navigate evaluation timeline"/>
    {!frames.some(f => f.report) && <p className="small">The timeline fills as your game is reviewed.</p>}
  </div>;
}
