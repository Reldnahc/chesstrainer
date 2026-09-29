import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Lightbulb, Play, Undo2 } from "lucide-react";
import Board from "../Board";
import ActionLink from "../ActionLink";
import Button from "../Button";
import ReviewCoach from "../ReviewCoach";
import ReviewWorkspace from "../ReviewWorkspace";
import type { CoachExpression } from "../coach/model";
import { lessonCoursePath, studyPaths } from "../navigation";
import LessonAttribution from "./LessonAttribution";
import { useLessonSession, type LessonAction } from "./useLessonSession";

export default function LessonPlayer({ sessionId }: { sessionId: string }) {
  const state = useLessonSession(sessionId);
  const { session, loading, error, busy, playback, disabled, gameNavigationDisabled } = state;
  useEffect(() => {
    document.title = `${session?.course_title || "Opening lesson"} · Fieldwork`;
  }, [session?.course_title]);
  if (loading) return <div className="panel loading" role="status">Loading your lesson…</div>;
  if (!session) return <section className="panel"><h1>Lesson unavailable</h1><p role="alert">{error}</p><Button onClick={state.reload}>Try loading again</Button><ActionLink variant="secondary" href={studyPaths.openings}>All openings</ActionLink></section>;
  const has = (action: LessonAction) => session.actions.includes(action);
  const finished = session.status === "completed";
  const { step, feedback } = session;
  const frame = playback.frame;
  const fen = playback.fen || session.fen;
  const guidedPlayback = playback.playing && !session.game;
  const expression: CoachExpression = error ? "uncertain" : session.game ? "explaining" : busy ? "thinking"
    : playback.playing ? "explaining"
    : feedback?.kind === "incorrect" ? "encouraging"
    : finished ? session.failed || session.assisted ? "recovered" : "great"
    : feedback?.kind === "correct" ? "good"
    : feedback || !has("move") ? "explaining" : "neutral";
  const reactionKey = session.game ? `${session.id}:game:${step.id}:${expression}` : `${session.id}:${session.revision}:${expression}`;
  const turn = fen.split(" ")[1] === "w" ? "White" : "Black";
  const annotations = !playback.playing && fen === session.fen
    ? session.game ? session.game.note?.annotations : step.annotations : undefined;
  // Pending navigation remains locked in the session hook and announced as
  // unavailable, without dimming the controls or losing keyboard focus per move.
  const gameButtonState = (atBoundary = false) => ({ disabled: !!error || atBoundary, "aria-disabled": gameNavigationDisabled || atBoundary });
  const action = (name: LessonAction, label: string, primary = false, icon?: ReactNode) => has(name) && <Button key={name} size="compact" className={name === "return_branch" || name === "close_game" ? "lesson-return" : undefined} variant={name === "return_branch" || name === "close_game" ? "default" : primary ? "primary" : "secondary"} {...(name === "close_game" ? gameButtonState() : { disabled })} onClick={() => state.command(name)}>{icon}{label}</Button>;
  return <ReviewWorkspace
    boardLabel="Lesson position"
    heading={<div className="puzzle-player-heading"><h1>{session.course_title}</h1><span className="muted">{session.orientation === "white" ? "White" : "Black"}</span></div>}
    aboveBoard={<div className="review-position-status"><span><span className={`turn-dot ${turn === "Black" ? "black" : ""}`} />{playback.playing ? frame ? `${frame.before_fen.split(" ")[1] === (session.orientation === "white" ? "w" : "b") ? "Your move" : "Opponent reply"} · ${frame.san}` : "Line start" : session.game ? "Game playback" : has("move") ? `${turn} to move` : "Guided lesson"}</span><span>{session.branch ? "ALTERNATIVE LINE" : session.game ? `PLY ${session.game.ply} / ${session.game.total_plies}` : finished ? "CHAPTER COMPLETED" : session.chapter_title}</span></div>}
    belowBoard={<div className="review-board-hint">{has("move") ? step.kind === "rehearsal" ? "Play your studied continuation." : "Play this lesson’s move." : session.branch ? "Explore the alternative, then return to the main line." : "Use the lesson controls to continue."}</div>}
    boardControls={<div className="lesson-board-controls"><ActionLink variant="secondary" href={lessonCoursePath(session.course_id, session.course_revision)}><ArrowLeft size={16} />Chapters</ActionLink>{session.game && <div className="lesson-game-controls"><button aria-label="Previous game move" {...gameButtonState(session.game.ply === 0)} onClick={() => state.command("game_seek", { ply: session.game!.ply - 1 })}><ChevronLeft size={18} /></button><span>{session.game.ply} / {session.game.total_plies}</span><button aria-label="Next game move" {...gameButtonState(session.game.ply === session.game.total_plies)} onClick={() => state.command("game_seek", { ply: session.game!.ply + 1 })}><ChevronRight size={18} /></button></div>}</div>}
    board={<Board fen={fen} orientation={session.orientation} legalMoves={session.legal_moves} disabled={disabled || !has("move")} onMove={state.answer} feedback={feedback?.kind === "incorrect" ? "retry" : undefined} highlights={frame ? [frame.uci.slice(0, 2), frame.uci.slice(2, 4)] : annotations?.squares || []} arrows={annotations?.arrows?.map(arrow => ({ startSquare: arrow.from_square, endSquare: arrow.to_square, color: "#f5b56abb" })) || []} />}
  >
    <ReviewCoach title={<h2>{error ? "Let’s restore your lesson." : guidedPlayback ? "Follow the continuation." : session.game ? session.game.title : finished ? "Chapter completed." : step.title}</h2>}
      reaction={{ state: expression, key: reactionKey }}
      messageResetKey={`${session.id}:${session.revision}:${guidedPlayback}:${error || ""}`}
      actions={<>{error ? <Button size="compact" variant="primary" onClick={state.reload}>Reload lesson</Button> : <>
        {session.game ? <>{action("close_game", "Return to lesson", true, <Undo2 size={16} />)}<Button size="compact" variant="secondary" {...gameButtonState(session.game.ply === 0)} onClick={() => state.command("game_seek", { ply: 0 })}><Play size={16} />From the beginning</Button></> : <>
          {action("back", "Back", false, <ChevronLeft size={16} />)}
          {action("continue", (step.kind === "demonstration" || step.kind === "game_excerpt") && step.phase === "ready" ? "Play continuation" : finished ? "Review chapter" : "Continue", true, <ArrowRight size={16} />)}
          {action("enter_branch", "Explore alternative", true, <Play size={16} />)}
          {action("return_branch", "Return to main line", true, <Undo2 size={16} />)}
          {action("show_move", "Show move")}
          {action("hint", "Hint", false, <Lightbulb size={16} />)}
          {action("open_game", "Explore full game", false, <BookOpen size={16} />)}
        </>}
      </>}</>}
    ><div role="status" aria-live="polite"><p>{error ? "Reload the saved lesson before continuing." : guidedPlayback ? "Watch how this position develops." : session.game ? session.game.note?.text || "Explore the full game. Return to the lesson whenever you’re ready." : finished ? "Your chapter progress is saved. Revisit it whenever you want to practice again." : step.text}</p>{feedback && !playback.playing && !session.game && !finished && <p className={`lesson-feedback ${feedback.kind}`}>{feedback.text}</p>}</div></ReviewCoach>
    {error && <p className="notice error" role="alert">{error}</p>}
    <section className="panel lesson-context" aria-label="Lesson progress">
      <p className="eyebrow">{session.branch ? "EXPLORING AN ALTERNATIVE" : session.game ? "ILLUSTRATIVE GAME" : "YOUR CHAPTER"}</p>
      <h2>{session.branch?.title || session.game?.title || session.chapter_title}</h2>
      <p className="small">{finished ? "Completed" : step.kind === "rehearsal" ? "Independent rehearsal" : "Guided learning"}{session.assisted ? " · Help used" : ""}</p>
      {session.game && <LessonAttribution attributions={session.game.attributions} />}
      {finished && <ActionLink variant="primary" href={lessonCoursePath(session.course_id, session.course_revision)}>Choose a chapter <ArrowRight size={16} /></ActionLink>}
    </section>
  </ReviewWorkspace>;
}
