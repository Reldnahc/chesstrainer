import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import Board from "../Board";
import TurnIndicator from "../TurnIndicator";
import ActionLink from "../ActionLink";
import AudioMuteButton from "../audio/AudioMuteButton";
import Button from "../Button";
import ContinuationMoves from "../ContinuationMoves";
import { LoadingState, UnavailableState } from "../LoadState";
import ReviewWorkspace from "../ReviewWorkspace";
import ReviewCoach from "../ReviewCoach";
import MoveBadge from "../MoveBadge";
import MoveStatus from "../MoveStatus";
import Notice from "../Notice";
import SourceLine from "../SourceLine";
import type { CoachExpression } from "../coach/model";
import { navigate, puzzleSessionPath, studyPaths } from "../navigation";
import { createPuzzleStarter, gameReviewPath, loadPuzzleSelection, puzzleThemeLabel } from "./puzzleApi";
import { usePuzzleSession } from "./usePuzzleSession";
import { useCoachSpeech } from "../audio/speech/useCoachSpeech";
import { puzzleRecording } from "../audio/speech/practiceSelection";
import { withSessionTake } from "../audio/speech/meaningPools";
import { useSelectedCoachSpokenText } from "../audio/speech/spokenText";

export default function PuzzlePlayer({ sessionId }: { sessionId: string }) {
  const state = usePuzzleSession(sessionId);
  const { session, frame, loading, busy, playing, retrying, error } = state;
  // Extra takes of a clip take turns as the session's revisions advance.
  const recordingId = withSessionTake(puzzleRecording({session, error: !!error, playing, retrying}), sessionId, session?.revision ?? 0);
  const voice = useCoachSpeech({
    scopeKey: `puzzle:${sessionId}:${session?.revision}:${state.fen ?? "position"}:${frame?.before_fen ?? ""}:${frame?.uci ?? ""}:${recordingId}`,
    recordingId, ready: !!session && !loading && !busy,
    automaticEventId: !error && !playing && session?.status !== "revealed"
      ? state.feedbackEventId : null,
  });
  // Each puzzle state has one coach sentence; the bubble shows the coach's spoken
  // form of it. An error keeps its written instruction, which a paraphrase can drop.
  const spoken = useSelectedCoachSpokenText(error ? null : recordingId);
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
    voice.stop();
    setOpeningNext(true);
    setNextError("");
    try {
      const result = await startNextPuzzle({ ...loadPuzzleSelection(), source: session?.source }, controller.signal);
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
  // A solve's saved record is a grading fact, so it stays written beside the spoken line.
  const record = complete && session.status !== "revealed" ? session.failed ? "Saved as failed, then solved." : "Saved as a clean solve." : null;
  const message = spoken ? record ? `${spoken} ${record}` : spoken : (error ? "Reload the saved session before making another move."
    : playing ? "The board is playing the verified line."
    : session.status === "revealed" ? "This attempt is saved as revealed. You can replay the solution below."
    : complete ? session.failed ? "You found the whole continuation after a retry. Saved as failed, then solved." : "You found the whole continuation. Saved as a clean solve."
    : incorrect ? "That move does not solve this puzzle. Your earlier correct moves are saved."
    : correct ? "That move matches the puzzle. Find your next move."
    : "Take your time and calculate before moving.");
  const displayedFen = state.fen || session.fen;
  const playbackTurn = frame
    ? frame.before_fen.split(" ")[1] === (session.orientation === "white" ? "w" : "b") ? "Your move" : "Opponent reply"
    : "Solution start";
  return <ReviewWorkspace
    heading={<div className="puzzle-player-heading"><h1>Puzzle practice</h1><span className="muted">{session.source === "games" ? "From your games · " : ""}{complete ? session.status === "revealed" ? "Revealed" : "Solved" : "In progress"}</span></div>}
    boardLabel="Puzzle position"
    aboveBoard={<div className="review-position-status"><TurnIndicator color={session.orientation}>{playing ? playbackTurn : complete ? "Solution review" : `${session.orientation === "white" ? "White" : "Black"} to move`}</TurnIndicator><span>{session.history.length} MOVES PLAYED</span></div>}
    belowBoard={<div className="review-board-hint">{playing ? "The saved position will be ready after playback." : complete ? "Select a solution move to inspect it." : "Select a piece to see legal moves. Tap a destination or drag."}</div>}
    boardControls={<div className="lesson-board-controls"><ActionLink variant="secondary" href={studyPaths.puzzles}><ArrowLeft size={16} />All puzzles</ActionLink><AudioMuteButton /></div>}
    board={<Board fen={displayedFen} orientation={session.orientation} legalMoves={session.legal_moves} disabled={state.disabled} onMove={state.answer} feedback={incorrect ? "retry" : undefined} highlights={frame ? [frame.uci.slice(0, 2), frame.uci.slice(2, 4)] : []} />}
  >
    <ReviewCoach title={<h2>{title}</h2>} voice={voice}
      badge={complete ? <MoveBadge label={session.status === "revealed" ? "Revealed" : "Accepted"} /> : undefined}
      reaction={{ state: expression, key: `${session.id}:${session.revision}:${expression}` }}
      actions={<>{error ? <Button size="compact" variant="primary" onClick={state.reload}>Reload session</Button>
        : complete ? <><Button size="compact" variant="primary" disabled={playing || openingNext} onClick={next}>Next puzzle <ArrowRight size={16} /></Button><Button size="compact" disabled={playing || openingNext} onClick={state.replay}><Play size={15} />{state.motion === "still" ? "View solution" : "Replay solution"}</Button></>
        : <>{incorrect && <Button size="compact" variant="primary" disabled={busy} onClick={state.retry}>Try again</Button>}<Button size="compact" variant="secondary" disabled={busy || playing} onClick={state.reveal}>Reveal solution</Button></>}</>}
    ><MoveStatus busy={busy} failed={incorrect && !error} text={message} /></ReviewCoach>
    {(error || nextError) && <Notice announcement="alert" tone="error">{error || nextError}</Notice>}
    {session.completion && <section className="panel puzzle-history" aria-label="Puzzle solution">
      <h2>{session.completion.themes.length ? session.completion.themes.map(puzzleThemeLabel).join(" · ") : "The continuation"}</h2>
      <ContinuationMoves label="Solution moves" moves={session.completion.solution} disabled={playing}
        selectedIndex={session.completion.solution.findIndex(move => frame === move)}
        startSelected={displayedFen === session.completion.solution[0]?.before_fen}
        onStart={state.inspectStart} onSelect={index => state.inspect(session.completion!.solution[index])} />
      {session.completion.rating != null && <p className="small">Puzzle rating: {session.completion.rating}</p>}
      {session.source === "games" && session.completion.provenance.game_id ? <>
        {/* The source game stays hidden until completion; the line played here used the engine's defence, not the game's. */}
        <SourceLine className="puzzle-provenance" text={`From your games · ${session.completion.provenance.attribution}`} />
        <div className="button-row"><ActionLink variant="secondary" size="compact" href={gameReviewPath(session.completion.provenance.game_id, session.completion.provenance.source_ply)}>Open your move in the game review <ArrowRight size={16} /></ActionLink></div>
      </> : <>
        <SourceLine className="puzzle-provenance" text={`Puzzle practice · ${session.source === "games" ? "From your games" : "Collection puzzle"}`} />
        <SourceLine className="puzzle-provenance" text={session.completion.provenance.attribution}
          url={session.completion.provenance.url} linkLabel="Source" />
      </>}
    </section>}
  </ReviewWorkspace>;
}
