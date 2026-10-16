import MovePlaybackControls from "../MovePlaybackControls";
import { usePageTitle } from "../PageTitle";
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
import Reveal from "../Reveal";
import SourceLine from "../SourceLine";
import type { CoachExpression } from "../coach/model";
import { gameReviewPath, navigate, puzzleSessionPath, studyPaths } from "../navigation";
import { moveSquares } from "../boardCues";
import { playbackMover } from "../fen";
import { createPuzzleStarter, loadPuzzleSelection, puzzleThemeLabel } from "./puzzleApi";
import { usePuzzleSession } from "./usePuzzleSession";
import { useCoachSpeech } from "../audio/speech/useCoachSpeech";
import { puzzleRecording } from "../audio/speech/practiceSelection";
import { withSessionTake } from "../audio/speech/meaningPools";
import { useSelectedCoachSpokenText } from "../audio/speech/spokenText";
import { CommandError } from "../useQuery";
import { useSessionStart } from "../useSessionStart";

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
  // Next puzzle opens the next match for the saved choices, or the puzzle list when none is left.
  const opening = useSessionStart(createPuzzleStarter, (next) => puzzleSessionPath(next.id));
  usePageTitle("Puzzle practice");
  function next() {
    if (opening.busy) return;
    voice.stop();
    void opening.start("next", { ...loadPuzzleSelection(), source: session?.source }, () => navigate(studyPaths.puzzles));
  }
  if (loading) return <LoadingState presentation="panel">Loading your puzzle…</LoadingState>;
  if (!session) return <UnavailableState presentation="panel" heading={<h1>Puzzle unavailable</h1>} actions={<><Button variant="secondary" onClick={state.reload}>Try again</Button><ActionLink variant="secondary" href={studyPaths.puzzles}>All puzzles</ActionLink></>}>Couldn’t load your puzzle. {error}</UnavailableState>;
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
  // A completed puzzle's solution steps like the opening preview's continuation.
  const solution = session.completion?.solution ?? [];
  const selectedMove = solution.findIndex(move => frame === move);
  const solutionAt = selectedMove >= 0 ? selectedMove + 1 : displayedFen === solution[0]?.before_fen ? 0 : solution.length;
  const seekSolution = (target: number) => target <= 0 ? state.inspectStart() : state.inspect(solution[target - 1]);
  const playbackTurn = frame
    ? playbackMover(frame.before_fen, session.orientation)
    : "Solution start";
  return <ReviewWorkspace
    heading={<div className="puzzle-player-heading"><h1>Puzzle practice</h1><span className="muted">{session.source === "games" ? "From your games · " : ""}{complete ? session.status === "revealed" ? "Revealed" : "Solved" : "In progress"}</span></div>}
    boardLabel="Puzzle position"
    aboveBoard={<div className="review-position-status"><TurnIndicator color={session.orientation}>{playing ? playbackTurn : complete ? "Solution review" : `${session.orientation === "white" ? "White" : "Black"} to move`}</TurnIndicator><span>{session.history.length} MOVES PLAYED</span></div>}
    belowBoard={<div className="review-board-hint">{playing ? "The saved position will be ready after playback." : complete ? "Select a solution move to inspect it." : "Select a piece to see legal moves. Tap a destination or drag."}</div>}
    boardControls={<div className="lesson-board-controls"><ActionLink variant="secondary" href={studyPaths.puzzles}><ArrowLeft size={16} />All puzzles</ActionLink>
      {session.completion && <MovePlaybackControls label="Solution playback" current={solutionAt} maximum={solution.length}
        previous={{ "aria-label": "Previous solution move", disabled: playing || solutionAt === 0, onClick: () => seekSolution(solutionAt - 1) }}
        next={{ "aria-label": "Next solution move", disabled: playing || solutionAt === solution.length, onClick: () => seekSolution(solutionAt + 1) }} />}
      <AudioMuteButton /></div>}
    board={<Board fen={displayedFen} orientation={session.orientation} legalMoves={session.legal_moves} disabled={state.disabled} onMove={state.answer} feedback={incorrect ? "retry" : undefined} highlights={moveSquares(frame?.uci)} />}
  >
    <ReviewCoach title={<h2>{title}</h2>} voice={voice}
      badge={complete ? <MoveBadge label={session.status === "revealed" ? "Revealed" : "Accepted"} /> : undefined}
      reaction={{ state: expression, key: `${session.id}:${session.revision}:${expression}` }}
      actions={<>{error ? <Button size="compact" variant="primary" onClick={state.reload}>Reload session</Button>
        : complete ? <><Button size="compact" variant="primary" disabled={playing || !!opening.busy} onClick={next}>Next puzzle <ArrowRight size={16} /></Button><Button size="compact" disabled={playing || !!opening.busy} onClick={state.replay}><Play size={15} />{state.motion === "still" ? "View solution" : "Replay solution"}</Button></>
        : <>{incorrect && <Button size="compact" variant="primary" disabled={busy} onClick={state.retry}>Try again</Button>}<Button size="compact" variant="secondary" disabled={busy || playing} onClick={state.reveal}>Reveal solution</Button></>}</>}
    ><MoveStatus busy={busy} failed={incorrect && !error} text={message} /></ReviewCoach>
    <Reveal>{error && <Notice announcement="alert" tone="error">{error}</Notice>}</Reveal>
    <CommandError command={opening} />
    {session.completion && <section className="panel puzzle-history" aria-label="Puzzle solution">
      <h2>{session.completion.themes.length ? session.completion.themes.map(puzzleThemeLabel).join(" · ") : "The continuation"}</h2>
      <ContinuationMoves label="Solution moves" moves={solution} disabled={playing}
        selectedIndex={selectedMove}
        startSelected={solutionAt === 0}
        onStart={state.inspectStart} onSelect={index => state.inspect(session.completion!.solution[index])} />
      {session.completion.rating != null && <p className="small">Puzzle rating: {session.completion.rating}</p>}
      {session.source === "games" && session.completion.provenance.game_id ? <>
        {/* The source game stays hidden until completion; the line played here used the engine's defence, not the game's. */}
        <SourceLine className="puzzle-provenance" text={`From your games · ${session.completion.provenance.attribution}`} />
        <div className="button-row"><ActionLink variant="secondary" size="compact" href={gameReviewPath(session.completion.provenance.game_id, { ply: session.completion.provenance.source_ply })}>Open your move in the game review <ArrowRight size={16} /></ActionLink></div>
      </> : <>
        <SourceLine className="puzzle-provenance" text={`Puzzle practice · ${session.source === "games" ? "From your games" : "Collection puzzle"}`} />
        <SourceLine className="puzzle-provenance" text={session.completion.provenance.attribution}
          url={session.completion.provenance.url} linkLabel="Source" />
      </>}
    </section>}
  </ReviewWorkspace>;
}
