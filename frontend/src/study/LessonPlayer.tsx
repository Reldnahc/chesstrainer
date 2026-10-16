import type { ReactNode } from "react";
import { usePageTitle } from "../PageTitle";
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, Play } from "lucide-react";
import Board from "../Board";
import TurnIndicator from "../TurnIndicator";
import ActionLink from "../ActionLink";
import Button, { IconButton } from "../Button";
import { LoadingState, UnavailableState } from "../LoadState";
import MovePlaybackControls from "../MovePlaybackControls";
import AudioMuteButton from "../audio/AudioMuteButton";
import ReturnButton from "../ReturnButton";
import ReviewCoach from "../ReviewCoach";
import MoveStatus from "../MoveStatus";
import Notice from "../Notice";
import Reveal from "../Reveal";
import ReviewWorkspace from "../ReviewWorkspace";
import type { CoachExpression } from "../coach/model";
import { lessonCoursePath, studyPaths } from "../navigation";
import { moveSquares } from "../boardCues";
import { playbackMover, sideName, sideToMove } from "../fen";
import LessonAttribution from "./LessonAttribution";
import { useLessonSession, type LessonAction } from "./useLessonSession";
import { useCoachSpeech } from "../audio/speech/useCoachSpeech";
import { useSelectedCoachSpokenText } from "../audio/speech/spokenText";

export default function LessonPlayer({ sessionId }: { sessionId: string }) {
  const state = useLessonSession(sessionId);
  const { session, loading, error, busy, playback, disabled, gameNavigationDisabled, speech } = state;
  // Each command response is one event with at most one generic clip; a later
  // command takes over its scope, so no step ever gets two automatic playbacks.
  const voice = useCoachSpeech({
    scopeKey: `lesson:${sessionId}:${speech?.eventId ?? "open"}`,
    recordingId: speech?.recordingId, ready: !!session && !loading && !busy,
    automaticEventId: speech?.eventId ?? null,
  });
  const spoken = useSelectedCoachSpokenText(speech?.recordingId);
  usePageTitle(session?.course_title || "Opening lesson");
  if (loading) return <LoadingState presentation="panel">Loading your lesson…</LoadingState>;
  if (!session) return <UnavailableState presentation="panel" heading={<h1>Lesson unavailable</h1>} actions={<><Button variant="secondary" onClick={state.reload}>Try again</Button><ActionLink variant="secondary" href={studyPaths.openings}>All lessons</ActionLink></>}>Couldn’t load your lesson. {error}</UnavailableState>;
  const has = (action: LessonAction) => session.actions.includes(action);
  const finished = session.status === "completed";
  const { feedback } = session;
  const step = state.playingStep ?? session.step;
  const frame = playback.frame;
  const fen = playback.fen || session.fen;
  const guidedPlayback = playback.playing && !session.game;
  // A single move is not a continuation: the coach names it as one move and
  // keeps the step's own text rather than announcing a sequence.
  const singleMove = guidedPlayback && (state.playingStep?.plies ?? session.playback.length) === 1;
  const expression: CoachExpression = error ? "uncertain" : session.game ? "explaining" : busy ? "thinking"
    : playback.playing ? "explaining"
    : feedback?.kind === "incorrect" ? "encouraging"
    : finished ? session.failed || session.assisted ? "recovered" : "great"
    : feedback?.kind === "correct" ? "good"
    : feedback || !has("move") ? "explaining" : "neutral";
  // The coach's own status and move feedback show as the coach says them, but
  // only where that line replaces one written sentence. Step text, hints,
  // authored choice feedback, game notes and a revealed move's SAN are course
  // content and stay written. A full game's fallback stays written too: only
  // opening it speaks, and seeking through it must not flip the sentence.
  // A clip with extra takes offers them ahead of its own line ("take|line").
  const spokenFor = (id: string, when: boolean) => when && speech?.recordingId?.split("|").includes(id) ? spoken : null;
  // An error keeps its written instruction, which a paraphrase can drop.
  const status = (error ? "Reload the saved lesson before continuing." : null)
    ?? spokenFor("lesson-guided-playback", guidedPlayback && !singleMove) ?? (guidedPlayback && !singleMove ? "Watch how this position develops." : null)
    ?? (session.game ? session.game.note?.text || "Explore the full game. Return to the lesson whenever you’re ready." : null)
    ?? spokenFor("lesson-chapter-complete", finished) ?? (finished ? "Your chapter progress is saved. Revisit it whenever you want to practice again." : step.text);
  const feedbackText = feedback && (spokenFor("lesson-wrong-move", feedback.kind === "incorrect")
    ?? spokenFor("lesson-correct-move", feedback.kind === "correct" && step.kind !== "decision") ?? feedback.text);
  const reactionKey = session.game ? `${session.id}:game:${step.id}:${expression}` : `${session.id}:${session.revision}:${expression}`;
  const turn = sideToMove(fen);
  const annotations = !playback.playing && fen === session.fen
    ? session.game ? session.game.note?.annotations : step.annotations : undefined;
  // Pending navigation remains locked in the session hook and announced as
  // unavailable, without dimming the controls or losing keyboard focus per move.
  const gameButtonState = (atBoundary = false) => ({ disabled: !!error || atBoundary, "aria-disabled": gameNavigationDisabled || atBoundary });
  const action = (name: LessonAction, label: string, primary = false, icon?: ReactNode) => {
    if (!has(name)) return null;
    const props = { ...(name === "close_game" ? gameButtonState() : { disabled }), onClick: () => state.command(name) };
    if (name === "back") return <IconButton key={name} size="compact" variant="secondary" aria-label={label} title={label} {...props}>{icon}</IconButton>;
    return name === "return_branch" || name === "close_game"
      ? <ReturnButton key={name} className={name === "return_branch" ? "lesson-branch-return" : undefined} {...props}>{label}</ReturnButton>
      : <Button key={name} size="compact" variant={primary ? "primary" : "secondary"} {...props}>{icon}{label}</Button>;
  };
  // What the board shows now, what the line counter says, and what the learner can do.
  let turnLabel: string;
  if (playback.playing) turnLabel = frame ? `${playbackMover(frame.before_fen, session.orientation)} · ${frame.san}` : "Line start";
  else if (session.game) turnLabel = "Game playback";
  else turnLabel = has("move") ? `${sideName(turn)} to move` : "Guided lesson";
  let placeLabel: string;
  if (session.branch) placeLabel = "ALTERNATIVE LINE";
  else if (session.game) placeLabel = `PLY ${session.game.ply} / ${session.game.total_plies}`;
  else placeLabel = finished ? "CHAPTER COMPLETED" : session.chapter_title;
  let boardHint: string;
  if (has("move")) boardHint = step.kind === "rehearsal" ? "Play your studied continuation." : "Play this lesson’s move.";
  else boardHint = session.branch ? "Explore the alternative, then return to the main line." : "Use the lesson controls to continue.";
  return <ReviewWorkspace
    boardLabel="Lesson position"
    heading={<div className="puzzle-player-heading"><h1>{session.course_title}</h1><span className="muted">{session.orientation === "white" ? "White" : "Black"}</span></div>}
    aboveBoard={<div className="review-position-status"><TurnIndicator color={turn}>{turnLabel}</TurnIndicator><span>{placeLabel}</span></div>}
    belowBoard={<div className="review-board-hint">{boardHint}</div>}
    boardControls={<div className="lesson-board-controls"><ActionLink variant="secondary" href={lessonCoursePath(session.course_id, session.course_revision, session.course_topic)}><ArrowLeft size={16} />Chapters</ActionLink>{session.game && <MovePlaybackControls label="Lesson game playback" current={session.game.ply} maximum={session.game.total_plies}
      previous={{ "aria-label": "Previous game move", ...gameButtonState(session.game.ply === 0), onClick: () => void state.command("game_seek", { ply: session.game!.ply - 1 }) }}
      next={{ "aria-label": "Next game move", ...gameButtonState(session.game.ply === session.game.total_plies), onClick: () => void state.command("game_seek", { ply: session.game!.ply + 1 }) }} />}<AudioMuteButton /></div>}
    board={<Board fen={fen} orientation={session.orientation} legalMoves={session.legal_moves} disabled={disabled || !has("move")} onMove={state.answer} feedback={feedback?.kind === "incorrect" ? "retry" : undefined} highlights={frame ? moveSquares(frame.uci) : annotations?.squares || []} arrows={annotations?.arrows?.map(arrow => ({ startSquare: arrow.from_square, endSquare: arrow.to_square, color: "#f5b56abb" })) || []} />}
  >
    <ReviewCoach compactLabel={!voice.available} voice={voice} title={<h2>{error ? "Let’s restore your lesson." : singleMove ? "Watch the move." : guidedPlayback ? "Follow the continuation." : session.game ? session.game.title : finished ? "Chapter completed." : step.title}</h2>}
      reaction={{ state: expression, key: reactionKey }}
      messageResetKey={`${session.id}:${session.revision}:${guidedPlayback}:${error || ""}`}
      actions={<>{error ? <Button size="compact" variant="primary" onClick={state.reload}>Reload lesson</Button> : <>
        {session.game ? <>{action("close_game", "Return to lesson")}<Button size="compact" variant="secondary" {...gameButtonState(session.game.ply === 0)} onClick={() => state.command("game_seek", { ply: 0 })}><Play size={16} />From the beginning</Button></> : <>
          {action("back", "Back", false, <ArrowLeft size={16} />)}
          {action("continue", (step.kind === "demonstration" || step.kind === "game_excerpt") && step.phase === "ready" ? step.plies === 1 ? "Play the move" : "Play continuation" : finished ? "Review chapter" : "Continue", true, <ArrowRight size={16} />)}
          {action("enter_branch", "Explore alternative", true, <Play size={16} />)}
          {action("return_branch", "Main line")}
          {action("show_move", "Show move")}
          {action("hint", "Hint", false, <Lightbulb size={16} />)}
          {action("open_game", "Explore full game", false, <BookOpen size={16} />)}
        </>}
      </>}</>}
    ><MoveStatus><p>{status}</p>{feedback && !playback.playing && !session.game && !finished && <p className={`lesson-feedback ${feedback.kind}`}>{feedbackText}</p>}</MoveStatus></ReviewCoach>
    <Reveal>{error && <Notice announcement="alert" tone="error">{error}</Notice>}</Reveal>
    <section className="panel lesson-context" aria-label="Lesson progress">
      <p className="eyebrow">{session.branch ? "EXPLORING AN ALTERNATIVE" : session.game ? "ILLUSTRATIVE GAME" : "YOUR CHAPTER"}</p>
      <h2>{session.branch?.title || session.game?.title || session.chapter_title}</h2>
      <p className="small">{finished ? "Completed" : step.kind === "rehearsal" ? "Independent rehearsal" : "Guided learning"}{session.assisted ? " · Help used" : ""}</p>
      {session.game && <LessonAttribution attributions={session.game.attributions} />}
      {finished && <ActionLink variant="primary" href={lessonCoursePath(session.course_id, session.course_revision, session.course_topic)}>Choose a chapter <ArrowRight size={16} /></ActionLink>}
    </section>
  </ReviewWorkspace>;
}
