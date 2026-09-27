import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CornerUpLeft, FlipVertical2 } from "lucide-react";
import { api, post, type LegalMove } from "./api";
import Board from "./Board";
import MoveSymbol from "./MoveSymbol";
import MoveBadge from "./MoveBadge";
import ReviewCoach from "./ReviewCoach";
import ReviewWorkspace from "./ReviewWorkspace";
import EvaluationScore from "./EvaluationScore";
import { scoreText, strength, type Score } from "./evaluation";
import PageTitle from "./PageTitle";
import GameSync from "./GameSync";
import GameHistory, { type HistoryItem } from "./GameHistory";
import Link from "./Link";
import { gamesPath, navigate as navigatePage, pagePaths, rememberGamePly } from "./navigation";

type Candidate = { uci: string; san: string; pv: string[]; score: Score };
type Report = {
  label: string; reason: string; coach: string; best: Candidate; actual: Candidate;
  white_score: Score; depth: number; engine_version: string;
  board_cues?: { fen: string; caption: string; roles: Record<string, string[]>; arrows: { startSquare: string; endSquare: string; kind: "move" | "reply" | "threat" }[] } | null;
};
type Position = { fen: string; legal_moves: LegalMove[]; turn: "white" | "black"; result: string | null; termination: string | null; san: string };
type Frame = Position & { uci: string | null; number: number; actor: "white" | "black" | null; report: Report | null };
type Accuracy = { version: string; white: number; black: number };
type Game = {
  id: string; white: string; black: string; played_on: string | null; result: string;
  orientation: "white" | "black"; rating: number; white_rating: number | null; black_rating: number | null; frames: Frame[];
  job: { id: string; status: string; completed: number; total: number; error: string | null; cancel_requested: boolean } | null;
  accuracy: Accuracy | null;
};
type ReviewProgress = { job: Game["job"]; accuracy: Accuracy | null; moves: { ply: number; report: Report }[] };
type Branch = { id: number; root: number; moves: string[]; sans: string[]; returnPly: number; };
type Cursor = { ply: number; branch: number | null; step: number };
type Analysis = { report: Report | null; score: Score | null; best_move: string | null };
const labels = ["Brilliant", "Great", "Best", "Good", "Book", "Inaccuracy", "Mistake", "Miss", "Blunder"];
const bad = new Set(["Inaccuracy", "Mistake", "Miss", "Blunder"]);
const dateText = (date: string | null) => date && !date.includes("?") ? date : "Date unknown";

function AccuracyReadout({ color, accuracy, complete, summary = false }: {
  color: "white" | "black"; accuracy: Accuracy | null; complete: boolean; summary?: boolean;
}) {
  const value = accuracy?.[color];
  const side = color === "white" ? "White" : "Black";
  const description = value != null ? "Original-game accuracy out of 100, using Lichess's method."
    : complete ? "Accuracy unavailable. Both players need moves with complete analysis."
    : "Accuracy will appear when the full game review finishes.";
  return <output className="game-accuracy" aria-label={summary ? `Accuracy for ${side}` : `${side} accuracy`} title={description}>
    {!summary && <span>Accuracy</span>}<b>{value == null ? "—" : value.toFixed(1)}</b><span className="sr-only">{description}</span>
  </output>;
}
function PlayerRow({ name, color, accuracy, complete, status }: {
  name: string; color: "white" | "black"; accuracy: Accuracy | null; complete: boolean; status: string;
}) {
  return <div className="game-player">
    <div className="game-player-identity"><strong className="game-player-name" title={name}>{name}</strong>
      <AccuracyReadout color={color} accuracy={accuracy} complete={complete}/>
    </div>
    <span className="game-player-status" title={status}>{status}</span>
  </div>;
}

export default function GamesScreen({ page, selected, initialPly }: { page: number; selected: string | null; initialPly: number }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const offset = (page - 1) * 30;
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => {
    if (selected) return;
    let active = true;
    setLoading(true); setError("");
    api<{ items: HistoryItem[]; total: number }>(`/games?offset=${offset}`).then(data => {
      if (active) { setItems(data.items); setTotal(data.total); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [offset, selected, revision]);
  if (selected) return <GameWorkspace key={selected} id={selected} initialPly={initialPly} libraryHref={gamesPath(page)} />;
  return <>
    <PageTitle eyebrow="EVERY MOVE HAS A STORY" title="Your games" description="Review the turning points. Follow the ideas. Try a different move.">
      <Link className="button-link primary" href={pagePaths.Import}>Import games</Link>
    </PageTitle>
    <GameSync onChanged={() => setRevision(value => value + 1)} />
    {error && <p role="alert" className="notice error">{error}</p>}
    {loading ? <p role="status">Loading your games…</p> : !items.length ? <section className="panel"><h2>{page > 1 ? "No games on this page." : "Your next insight starts with a game."}</h2>{page > 1 ? <Link className="button-link" href={gamesPath()}>Back to your games</Link> : <><p>Import a PGN or your Chess.com games to review both sides with your local coach.</p><Link className="button-link" href={pagePaths.Import}>Go to Import</Link></>}</section> : <GameHistory items={items} page={page}/>}
    {total > 30 && items.length > 0 && <div className="game-pagination"><button disabled={offset === 0} onClick={() => navigatePage(gamesPath(page - 1))}>Previous games</button><span>{offset + 1}–{Math.min(offset + 30, total)} of {total}</span><button disabled={offset + 30 >= total} onClick={() => navigatePage(gamesPath(page + 1))}>More games</button></div>}
  </>;
}

function GameWorkspace({ id, initialPly, libraryHref }: { id: string; initialPly: number; libraryHref: string }) {
  const [game, setGame] = useState<Game | null>(null);
  const [cursor, setCursor] = useState<Cursor>({ ply: initialPly, branch: null, step: 0 });
  const [branches, setBranches] = useState<Branch[]>([]);
  const nextId = useRef(1);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [busy, setBusy] = useState(false), [moving, setMoving] = useState(false);
  const [reviewStarting, setReviewStarting] = useState(true);
  const [error, setError] = useState("");
  const [branchPosition, setBranchPosition] = useState<{ key: string; value: Position } | null>(null);
  const [, setAnalysisRevision] = useState(0);
  const [analysisError, setAnalysisError] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [explanationKey, setExplanationKey] = useState<string | null>(null);
  const openedReview = useRef(false);
  const loadVersion = useRef(0);
  const receivedPly = useRef(0);
  const mounted = useRef(true);
  const activeKey = useRef("");
  const inFlight = useRef<Promise<unknown> | null>(null);
  const requests = useRef(new Map<string, Promise<unknown>>());
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
  const currentAnalysis = cache.current.get(analysisKey);
  const report = saved || currentAnalysis?.report;
  const startingReport = !branch && cursor.ply === 0 ? game?.frames[1]?.report : null;
  const startingScore = startingReport ? { ...startingReport.best.score, value: startingReport.best.score.value * (game?.frames[0].turn === "white" ? 1 : -1) } : null;
  const score = report?.white_score || currentAnalysis?.score || startingScore;
  const bestMove = report?.best.san || currentAnalysis?.best_move || startingReport?.best.san;
  const cues = report?.board_cues?.fen === frame?.fen ? report?.board_cues : null;
  const explaining = explanationKey === key && !!cues;
  const actor = (branch ? cursor.step > 0 : cursor.ply > 0) && frame?.san ? (frame.turn === "white" ? "Black" : "White") : null;
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const data = await api<Game>(`/games/${encodeURIComponent(id)}`);
    if (mounted.current && version === loadVersion.current) {
      receivedPly.current = data.frames.reduce((last, frame, index) => frame.report ? index : last, 0);
      setCursor(value => ({ ...value, ply: Math.min(value.ply, data.frames.length - 1) }));
      setGame(data);
    }
    return data;
  }, [id]);
  useEffect(() => {
    mounted.current = true;
    load().then(data => { if (mounted.current) { setOrientation(data.orientation); } }).catch(e => { if (mounted.current) setError(e.message); });
    return () => { mounted.current = false; };
  }, [load]);
  useEffect(() => {
    if (game && !branch) rememberGamePly(id, cursor.ply);
  }, [id, !!game, cursor.ply, !!branch]);
  useEffect(() => {
    if (game) document.title = `${game.white} vs ${game.black} · Fieldwork`;
  }, [game?.white, game?.black]);
  const running = game?.job && ["queued", "running"].includes(game.job.status);
  useEffect(() => {
    if (!game || openedReview.current) return;
    openedReview.current = true;
    if (!game.job || ["failed", "cancelled"].includes(game.job.status)) void start();
    else setReviewStarting(false);
    // Opening is the trigger. Pausing or failing while open must not restart a job.
  }, [game?.id]);
  useEffect(() => {
    if (!running) return;
    let active = true;
    let timer: number | undefined;
    const update = async () => {
      const version = loadVersion.current;
      try {
        const progress = await api<ReviewProgress>(`/games/${encodeURIComponent(id)}/review?after=${receivedPly.current}`);
        if (!active || version !== loadVersion.current) return;
        // Advance only over reports actually received, not a newer progress count.
        for (const move of progress.moves) receivedPly.current = Math.max(receivedPly.current, move.ply);
        const reports = new Map(progress.moves.map(move => [move.ply, move.report]));
        setGame(current => current ? { ...current, job: progress.job, accuracy: progress.accuracy, frames: current.frames.map((frame, index) => reports.has(index) ? { ...frame, report: reports.get(index)! } : frame) } : current);
      } catch (e) { if (active) setError((e as Error).message); }
      finally { if (active) timer = window.setTimeout(update, 750); }
    };
    void update();
    return () => { active = false; window.clearTimeout(timer); };
  }, [running, id]);
  useEffect(() => {
    if (!branch) return;
    let active = true;
    post<Position>(`/games/${encodeURIComponent(id)}/position`, { ply: root, moves: path }).then(value => {
      if (active) setBranchPosition({ key, value });
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
    // The key completely identifies this position, including repetition history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key, !!branch]);
  function analyzePosition(ply: number, moves: string[]) {
    const requestKey = `${ply}:${moves.join(",")}@${game?.rating ?? 1000}`;
    if (cache.current.has(requestKey)) return Promise.resolve();
    const pending = requests.current.get(requestKey);
    if (pending) return pending;
    // Every move actually played is queued once. Merely browsing is debounced below.
    const work = (inFlight.current || Promise.resolve()).then(async () => {
      if (!mounted.current) return;
      try {
        const value = await post<Analysis>(`/games/${encodeURIComponent(id)}/analyze`, { ply, moves });
        if (!mounted.current) return;
        cache.current.set(requestKey, value);
        setAnalysisRevision(value => value + 1);
        setAnalysisError(previous => previous?.key === requestKey ? null : previous);
      } catch (e) {
        if (mounted.current) setAnalysisError({ key: requestKey, message: (e as Error).message });
      }
    }).finally(() => { requests.current.delete(requestKey); });
    requests.current.set(requestKey, work);
    inFlight.current = work;
    return work;
  }
  useEffect(() => {
    if (!game || saved || startingReport || !frame || (!branch && (running || reviewStarting))) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      if (inFlight.current) await inFlight.current;
      if (active) void analyzePosition(root, path);
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
    // The position key includes the full repetition history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key, !!frame, !!saved, !!startingReport, retry, game?.rating, running, reviewStarting]);
  useEffect(() => {
    if (branch) return;
    const button = moveButtons.current.get(cursor.ply);
    const list = button?.closest('.game-notation-scroll');
    if (!button || !list) return;
    // Scroll the notation pane only; navigating must never pull the board off screen.
    const row = button.getBoundingClientRect(), pane = list.getBoundingClientRect();
    if (row.top < pane.top) list.scrollTop -= pane.top - row.top;
    else if (row.bottom > pane.bottom) list.scrollTop += row.bottom - pane.bottom;
  }, [cursor.ply, !!branch]);

  function navigate(ply: number) { setCursor({ ply, branch: null, step: 0 }); setExplanationKey(null); setError(""); }
  const returnRef = useRef(() => {});
  returnRef.current = () => { if (explaining) setExplanationKey(null); else if (branch) navigate(branch.returnPly); };
  const navigateRef = useRef<(delta: number) => void>(() => {});
  navigateRef.current = delta => {
    if (!game) return;
    setExplanationKey(null);
    if (branch) setCursor(c => ({ ...c, step: Math.max(0, Math.min(branch.moves.length, c.step + delta)) }));
    else navigate(Math.max(0, Math.min(game.frames.length - 1, cursor.ply + delta)));
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (target.closest("input,select,textarea,[contenteditable=true]")) return;
      if (event.key === "Escape") { event.preventDefault(); returnRef.current(); }
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
    const returnPly = branch?.returnPly ?? cursor.ply;
    if (extending) setBranches(values => values.map(b => b.id === id ? { id, root: base, moves, sans, returnPly } : b));
    else if (existing) setBranches(values => values.map(b => b.id === id ? { ...b, returnPly } : b));
    else setBranches(values => [...values, { id, root: base, moves, sans, returnPly }]);
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
      const next = await post<Position>(`/games/${encodeURIComponent(id)}/position`, { ply: root, moves });
      if (!mounted.current || activeKey.current !== requestKey) return;
      addBranch(root, moves, [...(branch ? branch.sans.slice(0, cursor.step) : []), next.san], moves.length, true);
      setBranchPosition({ key: `${root}:${moves.join(",")}`, value: next });
      setExplanationKey(null);
      void analyzePosition(root, moves);
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setMoving(false); }
  }
  async function start() {
    setBusy(true); setReviewStarting(true); setError("");
    try {
      await post(`/games/${encodeURIComponent(id)}/review`, {});
      cache.current.clear(); setAnalysisRevision(value => value + 1);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); setReviewStarting(false); }
  }
  async function cancel() {
    if (!game?.job) return;
    setBusy(true);
    try { await post(`/jobs/${game.job.id}/cancel`); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (!game) return <><Link className="button-link text-button" href={libraryHref}><ArrowLeft size={16}/>All games</Link><p role={error ? "alert" : "status"}>{error || "Opening game…"}</p></>;
  const playerName = (color: "white" | "black") => {
    const elo = color === "white" ? game.white_rating : game.black_rating;
    return `${game[color]}${elo ? ` (${elo})` : ""}`;
  };
  const last = game.frames.length - 1;
  const current = branch ? cursor.step : cursor.ply;
  const maximum = branch ? branch.moves.length : last;
  const errorAtPosition = analysisError?.key === analysisKey ? analysisError.message : null;
  const summary = labels.map(label => ({ label, white: game.frames.filter(f => f.actor === "white" && f.report?.label === label).length, black: game.frames.filter(f => f.actor === "black" && f.report?.label === label).length }));
  const displayed = frame || (branchPosition?.value ?? game.frames[cursor.ply]);
  const currentUci = branch ? path.at(-1) : game.frames[cursor.ply].uci;
  const coachIntro = game.job?.status === "completed"
    ? "Your review is ready. Select a move, jump to the next mistake, or move a piece to try an idea."
    : game.job?.status === "cancelled" ? "Your review is paused. Resume it below, or move a piece to explore."
    : game.job?.status === "failed" || (!game.job && !reviewStarting) ? "The review couldn't finish. Retry below, or explore the board while you wait."
    : "I'm reviewing both sides. The move ratings will appear as they're ready. You can explore the board while you wait.";
  return <div className="game-workspace">
    {error && <p className="notice error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></p>}
    <ReviewWorkspace
      boardLabel="Game board and navigation"
      heading={<><Link className="button-link text-button" href={libraryHref}><ArrowLeft size={16}/>All games</Link><h1>{game.white} <span>vs</span> {game.black}</h1><span>{dateText(game.played_on)} · {game.result}</span></>}
      aboveBoard={<PlayerRow name={playerName(orientation === "white" ? "black" : "white")} color={orientation === "white" ? "black" : "white"}
          accuracy={game.accuracy} complete={game.job?.status === "completed"} status={branch ? "Exploring a variation" : "Original game"}/>}
      belowBoard={<PlayerRow name={playerName(orientation)} color={orientation} accuracy={game.accuracy} complete={game.job?.status === "completed"}
          status={frame?.termination ? `${frame.result} · ${frame.termination}` : `${frame?.turn || displayed.turn} to move`}/>}
      evaluation={<div className="game-eval-bar" aria-label={`Evaluation for White: ${scoreText(score)}`}><div style={{ height: `${score ? 50 + 48 * strength(score) : 50}%`, top: orientation === "black" ? 0 : "auto", bottom: orientation === "white" ? 0 : "auto" }} /><span>{scoreText(score)}</span></div>}
      board={<Board fen={displayed.fen} orientation={orientation} legalMoves={frame?.legal_moves || []} disabled={!frame || moving} onMove={play}
            highlights={currentUci ? [currentUci.slice(0, 2), currentUci.slice(2, 4)] : []}
            quality={report && currentUci ? { square: currentUci.slice(2, 4), label: report.label } : undefined}
            roles={explaining ? cues!.roles : undefined}
            arrows={explaining ? cues!.arrows.map(a => ({ ...a, color: a.kind === "move" ? "#b8d69be6" : a.kind === "reply" ? "#ffb17be6" : "#ff7187db" })) : []}/>}
      boardControls={<div className="game-board-controls" role="group" aria-label="Game navigation">
          <button className="game-return" aria-label="Back to game" title="Back to game (Escape)" disabled={!branch} onClick={() => branch && navigate(branch.returnPly)}><CornerUpLeft size={16}/><span>Game</span></button>
          <button aria-label="First move" disabled={current === 0} onClick={() => { setExplanationKey(null); if (branch) setCursor(c => ({ ...c, step: 0 })); else navigate(0); }}><ChevronsLeft size={19}/></button>
          <button aria-label="Previous move" disabled={current === 0} onClick={() => navigateRef.current(-1)}><ChevronLeft size={19}/></button>
          <span className="game-move-counter"><span>{current}</span> / <span>{maximum}</span></span>
          <button aria-label="Next move" disabled={current === maximum} onClick={() => navigateRef.current(1)}><ChevronRight size={19}/></button>
          <button aria-label="Last move" disabled={current === maximum} onClick={() => { setExplanationKey(null); if (branch) setCursor(c => ({ ...c, step: maximum })); else navigate(last); }}><ChevronsRight size={19}/></button>
          <button aria-label="Flip board" onClick={() => setOrientation(v => v === "white" ? "black" : "white")}><FlipVertical2 size={17}/></button>
        </div>}
    >
        <ReviewCoach
          title={report ? <MoveBadge label={report.label}><span className="coach-rated-move">
            <span className="sr-only">{actor} · </span>{frame?.san || "Move"} is {(["Mistake", "Miss", "Blunder", "Inaccuracy"].includes(report.label)) ? (report.label === "Inaccuracy" ? "an " : "a ") : ""}<span className="coach-quality-name">{report.label}</span>
          </span></MoveBadge> : <strong>{actor ? `${actor} · ${frame?.san || "Move"}` : "Your coach"}</strong>}
          evaluation={<EvaluationScore score={score}/>}
          actions={<>
            <button aria-pressed={explaining} disabled={!cues && !errorAtPosition} onClick={() => {
              if (errorAtPosition) { setAnalysisError(null); setRetry(n => n + 1); }
              else setExplanationKey(explaining ? null : key);
            }}>{errorAtPosition ? "Retry analysis" : explaining ? "Hide why" : "Show why"}</button>
            <span title={bestMove ? `Best move: ${bestMove}` : undefined}>{bestMove ? <>Best: <strong>{bestMove}</strong></> : "Move a piece to explore"}</span>
          </>}
        >
          <p aria-live="polite">{explaining ? cues!.caption : report?.coach || (errorAtPosition ? "You can still explore the board. Engine coaching is unavailable for this position." : !actor ? coachIntro : "I'm checking this move and the opponent's strongest reply…")}</p>
          {errorAtPosition && <p role="alert">{errorAtPosition}</p>}
        </ReviewCoach>
        <section className="game-notation" aria-label="Moves and variations">
        <div className="game-move-heading"><h2>Moves</h2><button onClick={() => {
          const next = game.frames.findIndex((f, i) => i > cursor.ply && f.report && bad.has(f.report.label));
          const first = game.frames.findIndex(f => f.report && bad.has(f.report.label));
          if (next >= 0 || first >= 0) navigate(next >= 0 ? next : first);
        }} disabled={!game.frames.some(f => f.report && bad.has(f.report.label))}>Next mistake <ChevronRight size={14}/></button></div>
        <div className="game-notation-scroll">
        <div className="game-move-list" aria-label="Game moves">{game.frames.slice(1).map((f, index) => {
          const ply = index + 1;
          return <button key={ply} ref={element => { if (element) moveButtons.current.set(ply, element); else moveButtons.current.delete(ply); }} aria-current={!branch && cursor.ply === ply ? "step" : undefined} onClick={() => navigate(ply)} aria-label={`${f.number}${f.actor === "white" ? "." : "..."} ${f.san}${f.report ? `, ${f.report.label}` : ""}`}>
            <span className="game-move-number">{f.number}{f.actor === "white" ? "." : "…"}</span><strong>{f.san}</strong>{f.report && <span className={`game-move-symbol label-${f.report.label.toLowerCase()}`} title={f.report.label}><MoveSymbol label={f.report.label}/></span>}
          </button>;
        })}</div>
        {!!branches.length && <details className="game-variations" open><summary>Variations ({branches.length})</summary>{branches.map(b => <div key={b.id} className="game-variation-row"><span>#{b.id} · ply {b.root}</span>{b.sans.map((san, index) => <button key={index} aria-pressed={branch?.id === b.id && cursor.step === index + 1} onClick={() => { setCursor({ ply: b.root, branch: b.id, step: index + 1 }); setExplanationKey(null); }}>{san}{cache.current.get(`${b.root}:${b.moves.slice(0, index + 1).join(",")}@${game.rating}`)?.report ? <MoveBadge label={cache.current.get(`${b.root}:${b.moves.slice(0, index + 1).join(",")}@${game.rating}`)!.report!.label}/> : <span className="muted" aria-label="Not yet rated">…</span>}</button>)}</div>)}</details>}
        </div></section>
        <EvaluationGraph frames={game.frames} selected={cursor.ply} onSelect={navigate}/>
        <div className="game-review-tools">
        <section className="game-progress">
          {game.job?.status !== "completed" && <>
          <div className="row-between"><span>{game.job ? `${game.job.completed}/${game.job.total} moves reviewed` : `${last} moves to review`}</span>
          {running ? <button disabled={busy || game.job?.cancel_requested} onClick={cancel}>Pause review</button> : <button className="primary" disabled={busy || reviewStarting} onClick={start}>{reviewStarting ? "Starting review…" : !game.job || game.job.status === "failed" ? "Retry review" : "Resume review"}</button>}</div>
          {game.job && <progress value={game.job.completed} max={game.job.total || 1} aria-label="Game review progress"/>}
          {running && <p role="status">{game.job?.cancel_requested ? "Finishing active moves…" : game.job?.status === "queued" ? "Review queued. You can explore while you wait." : "Reviewing both sides…"}</p>}
          </>}
          {game.job?.error && <p className="small" role="alert">{game.job.error}</p>}
        </section>
        <details className="game-summary"><summary>Move quality{game.job?.status === "completed" ? " · complete game" : ""}</summary>
          <table aria-label="Move quality and accuracy"><thead><tr><th scope="col">Move quality</th><th scope="col">White</th><th scope="col">Black</th></tr></thead><tbody>
            <tr className="game-summary-accuracy"><th scope="row">Accuracy</th>{(["white", "black"] as const).map(color => <td key={color}>
              <AccuracyReadout color={color} accuracy={game.accuracy} complete={game.job?.status === "completed"} summary/>
            </td>)}</tr>
            {summary.map(s => <tr key={s.label}><th scope="row"><MoveBadge label={s.label}/></th><td>{s.white}</td><td>{s.black}</td></tr>)}
          </tbody></table>
        </details>
        </div>
    </ReviewWorkspace>
  </div>;
}

function EvaluationGraph({ frames, selected, onSelect }: { frames: Frame[]; selected: number; onSelect: (ply: number) => void }) {
  const plot = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);
  const height = 56;
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(32, element.getBoundingClientRect().width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const padding = 14;
  const last = frames.length - 1;
  const spacing = (width - padding * 2) / Math.max(1, last);
  // Use the whole game so dots keep their size as review results arrive.
  const radius = Math.min(6, spacing * .35);
  const selectedRadius = Math.max(3, radius * 2);
  const x = (i: number) => padding + i * spacing;
  const y = (score: Score) => height / 2 - strength(score) * (height / 2 - padding);
  const points = frames.flatMap((frame, ply) => frame.report ? [{frame, ply, report: frame.report}] : []);
  const tabStop = frames[selected]?.report ? selected : points[0]?.ply;
  const selectPoint = (ply: number) => {
    onSelect(ply);
    plot.current?.querySelector<SVGCircleElement>(`[data-ply="${ply}"]`)?.focus({preventScroll: true});
  };
  return <div className="game-graph"><div className="row-between"><strong>Game evaluation</strong><span>White ↑ · Black ↓</span></div>
    <svg ref={plot} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="group" aria-label="Evaluation across analyzed game moves" onClick={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const position = (event.clientX - bounds.left) * width / bounds.width;
      selectPoint(Math.max(0, Math.min(last, Math.round((position - padding) / spacing))));
    }}>
      <g pointerEvents="none" aria-hidden="true">
        <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="#44484f" strokeDasharray="4 4"/>
        {points.map(({ply, report}) => ply > 0 && frames[ply - 1].report && <line key={ply} x1={x(ply - 1)} y1={y(frames[ply - 1].report!.white_score)} x2={x(ply)} y2={y(report.white_score)} stroke="#b8cfc2" strokeWidth="1.5"/>)}
        <line x1={x(selected)} x2={x(selected)} y1="0" y2={height} stroke="#ff8059" opacity=".6"/>
      </g>
      {points.map(({frame, ply, report}, index) => <circle key={ply} className="game-graph-node" data-ply={ply}
        cx={x(ply)} cy={y(report.white_score)} r={ply === selected ? selectedRadius : radius}
        fill={bad.has(report.label) ? "#ff8059" : "#b8cfc2"}
        role="button" tabIndex={ply === tabStop ? 0 : -1} aria-current={ply === selected ? "step" : undefined}
        aria-label={`${frame.number}${frame.actor === "white" ? "." : "..."} ${frame.san}, ${report.label}, evaluation ${scoreText(report.white_score)}`}
        onClick={event => {
          if (event.detail === 0) { event.stopPropagation(); selectPoint(ply); }
        }}
        onKeyDown={event => {
          const target = event.key === "ArrowLeft" ? points[Math.max(0, index - 1)]
            : event.key === "ArrowRight" ? points[Math.min(points.length - 1, index + 1)]
            : event.key === "Home" ? points[0] : event.key === "End" ? points.at(-1)
            : event.key === "Enter" || event.key === " " ? points[index] : null;
          if (target) { event.preventDefault(); event.stopPropagation(); selectPoint(target.ply); }
        }}><title>{frame.number}{frame.actor === "white" ? "." : "..."} {frame.san} · {scoreText(report.white_score)}</title></circle>)}
    </svg><input type="range" min="0" max={last} value={selected} onChange={e => onSelect(Number(e.target.value))} aria-label="Navigate evaluation timeline"/>
    {!points.length && <p className="small">The timeline fills as your game is reviewed.</p>}
  </div>;
}
