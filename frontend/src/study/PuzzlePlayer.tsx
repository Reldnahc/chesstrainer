import { LoadingState, UnavailableState } from "../LoadState";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import Board from "../Board";
import ActionLink from "../ActionLink";
import Button from "../Button";
import ReviewWorkspace from "../ReviewWorkspace";
import ReviewCoach from "../ReviewCoach";
import MoveBadge from "../MoveBadge";
import MoveStatus from "../MoveStatus";
import type { CoachExpression } from "../coach/model";
import { navigate, puzzleSessionPath, studyPaths } from "../navigation";
import { createPuzzleStarter } from "./puzzleApi";
import { usePuzzleSession } from "./usePuzzleSession";

export default function PuzzlePlayer({ sessionId }: { sessionId: string }) {
  const state = usePuzzleSession(sessionId);
  const { session, frame, loading, busy, playing, retrying, error } = state;
  const [nextError, setNextError] = useState("");
  const [openingNext, setOpeningNext] = useState(false);
  const [startNextPuzzle] = useState(createPuzzleStarter);
  const nextRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    document.title = "Puzzle practice · Fieldwork";
    return () => nextRequest.current?.abort();
  }, []);
  async function next() {
    if (nextRequest.current && !nextRequest.current.signal.aborted) return;
    const controller = new AbortController();
    nextRequest.current = controller;
    setOpeningNext(true);
    setNextError("");
    try {
      const result = await startNextPuzzle(session?.source, controller.signal);
      if (controller.signal.aborted) return;
      if (result) navigate(puzzleSessionPath(result.id));
      else navigate(studyPaths.puzzles);
    } catch (e) { if (!controller.signal.aborted) setNextError((e as Error).message); }
    finally { if (!controller.signal.aborted) { setOpeningNext(false); nextRequest.current = null; } }
  }
  if (loading) return <LoadingState presentation="panel">Loading your puzzle…</LoadingState>;
  if (!session) return <UnavailableState presentation="panel" heading={<h1>Puzzle unavailable</h1>} actions={<><Button onClick={state.reload}>Try loading again</Button><ActionLink variant="secondary" href={studyPaths.puzzles}>All puzzles</ActionLink></>}>{error}</UnavailableState>;
  const complete = session.status !== "active";
  const incorrect = retrying && !complete;
  const correct = session.feedback?.grade === "correct" && !complete;
  const expression: CoachExpression = error ? "uncertain" : busy ? "thinking"
    : playing ? "explaining" : session.status === "revealed" ? "explaining"
    : complete ? session.failed ? "recovered" : "winning"
    : incorrect ? "encouraging" : correct ? "good" : "neutral";
  const title = error ? "Let’s restore your position."
    : playing ? "Follow the continuation."
    : session.status === "revealed" ? "Solution revealed."
    : complete ? "Puzzle solved."
    : incorrect ? "Try a different move."
    : correct ? "Keep going."
    : "Find the continuation.";
  const message = error ? "Reload the saved session before making another move."
    : playing ? "The board is playing the verified line."
    : session.status === "revealed" ? "This attempt is saved as revealed. You can replay the solution below."
    : complete ? session.failed ? "You found the whole continuation after a retry. Saved as failed, then solved." : "You found the whole continuation. Saved as a clean solve."
    : incorrect ? "That move does not solve this puzzle. Your earlier correct moves are saved."
    : correct ? "That move matches the puzzle. Find your next move."
    : "Take your time and calculate before moving.";
  const displayedFen = state.fen || session.fen;
  const playbackTurn = frame
    ? frame.before_fen.split(" ")[1] === (session.orientation === "white" ? "w" : "b") ? "Your move" : "Opponent reply"
    : "Solution start";
  return <ReviewWorkspace
    heading={<div className="puzzle-player-heading"><h1>Puzzle practice</h1><span className="muted">{complete ? session.status === "revealed" ? "Revealed" : "Solved" : "In progress"}</span></div>}
    boardLabel="Puzzle position"
    aboveBoard={<div className="review-position-status"><span><span className={`turn-dot ${session.orientation === "black" ? "black" : ""}`} />{playing ? playbackTurn : complete ? "Solution review" : `${session.orientation === "white" ? "White" : "Black"} to move`}</span><span>{session.history.length} MOVES PLAYED</span></div>}
    belowBoard={<div className="review-board-hint">{playing ? "The saved position will be ready after playback." : complete ? "Select a solution move to inspect it." : "Select a piece to see legal moves. Tap a destination or drag."}</div>}
    boardControls={<div><ActionLink variant="secondary" href={studyPaths.puzzles}><ArrowLeft size={16} />All puzzles</ActionLink></div>}
    board={<Board fen={displayedFen} orientation={session.orientation} legalMoves={session.legal_moves} disabled={state.disabled} onMove={state.answer} feedback={incorrect ? "retry" : undefined} highlights={frame ? [frame.uci.slice(0, 2), frame.uci.slice(2, 4)] : []} />}
  >
    <ReviewCoach title={<h2>{title}</h2>}
      badge={complete ? <MoveBadge label={session.status === "revealed" ? "Revealed" : "Accepted"} /> : undefined}
      reaction={{ state: expression, key: `${session.id}:${session.revision}:${expression}` }}
      actions={<>{error ? <Button size="compact" variant="primary" onClick={state.reload}>Reload session</Button>
        : complete ? <><Button size="compact" variant="primary" disabled={playing || openingNext} onClick={next}>Next puzzle <ArrowRight size={16} /></Button><Button size="compact" disabled={playing || openingNext} onClick={state.replay}><Play size={15} />{state.motion === "still" ? "View solution" : "Replay solution"}</Button></>
        : <>{incorrect && <Button size="compact" variant="primary" disabled={busy} onClick={state.retry}>Try again</Button>}<Button size="compact" variant="secondary" disabled={busy || playing} onClick={state.reveal}>Reveal solution</Button></>}</>}
    ><MoveStatus busy={busy} failed={incorrect && !error} text={message} /></ReviewCoach>
    {(error || nextError) && <p className="notice error" role="alert">{error || nextError}</p>}
    {session.completion && <section className="panel puzzle-history" aria-label="Puzzle solution">
      <h2>{session.completion.themes.length ? session.completion.themes.map(theme => theme.replaceAll("_", " ")).join(" · ") : "The continuation"}</h2>
      <div className="puzzle-move-list"><button disabled={playing} aria-current={displayedFen === session.completion.solution[0]?.before_fen ? "step" : undefined} onClick={state.inspectStart}>Start</button>{session.completion.solution.map((move, index) => <button key={`${index}:${move.uci}`} disabled={playing} aria-current={frame === move ? "step" : undefined} onClick={() => state.inspect(move)}>{move.san}</button>)}</div>
      {session.completion.rating != null && <p className="small">Puzzle rating: {session.completion.rating}</p>}
      <p className="puzzle-provenance">Puzzle practice · {session.source === "games" ? "From your games" : "Collection puzzle"}</p>
      <p className="puzzle-provenance">{session.completion.provenance.attribution}
        {session.completion.provenance.url && /^https?:\/\//i.test(session.completion.provenance.url) && <> · <a href={session.completion.provenance.url} target="_blank" rel="noreferrer">Source</a></>}
      </p>
    </section>}
  </ReviewWorkspace>;
}
