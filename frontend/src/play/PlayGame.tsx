import { useState } from "react";
import { usePageTitle } from "../PageTitle";
import Banner from "../Banner";
import { ArrowRight } from "lucide-react";
import Board from "../Board";
import ReviewWorkspace from "../ReviewWorkspace";
import EvaluationGraph from "../EvaluationGraph";
import ActionLink from "../ActionLink";
import Button from "../Button";
import FlipBoardButton from "../FlipBoardButton";
import MovePlaybackControls from "../MovePlaybackControls";
import { LoadingState, UnavailableState } from "../LoadState";
import AudioMuteButton from "../audio/AudioMuteButton";
import { pawnsText, positionScore, startingScore } from "../evaluation";
import EvaluationBar from "../EvaluationBar";
import { ARROW_COLOURS, cueArrows, cuesFor, moveSquares, uciArrow } from "../boardCues";
import { PlayerRow } from "../gameReview/Players";
import PositionCoach from "../gameReview/PositionCoach";
import ReviewMoves from "../gameReview/ReviewMoves";
import { gamesPath, pagePaths, playSetupPath } from "../navigation";
import { usePlaySession, type PlaySession } from "./usePlaySession";
import { useCoachPreferences } from "../coach/CoachProvider";
import { getCoach } from "../coach/registry";

// Opening practice speaks in text only: one placeholder line per moment, shared by
// every coach until lines are written and recorded for it.
export const PRACTICE_LINES = {
  checking: "That's not the line.",
  fine: "Decent, but that's not the line.",
  worse: "That's not the line, and it costs you something.",
  ended: "That's the end of the line. Keep playing, or go again?",
} as const;

/** The coach's bubble asks the learner when practice needs a choice; null otherwise. */
function practicePrompt(session: PlaySession, bot: string) {
  const { deviation } = session;
  if (deviation) {
    const line = deviation.verdict ? PRACTICE_LINES[deviation.verdict] : PRACTICE_LINES.checking;
    const detail = !deviation.verdict
      ? `Checking how ${deviation.san} compares with the book move…`
      : deviation.verdict === "fine"
        ? `${deviation.san} is within ${pawnsText(30)} of the book move.`
        : deviation.loss_cp === null
          ? `${deviation.san} walks into a mate the book move avoids.`
          : `${deviation.san} gives up about ${pawnsText(deviation.loss_cp)} against the book move.`;
    return {
      title: <strong>{bot}</strong>,
      text: <div className="play-practice-prompt" role="status"><p>{line}</p><p className="small">{detail}</p></div>,
      actions: <>
        <Button size="compact" disabled={session.busy} onClick={session.takeBack}>Take back</Button>
        <Button size="compact" disabled={session.busy} onClick={session.carryOn}>Play on</Button>
      </>,
    };
  }
  if (session.lineOver)
    return {
      title: <strong>{bot}</strong>,
      text: <div className="play-practice-prompt" role="status"><p>{PRACTICE_LINES.ended}</p></div>,
      actions: <>
        <Button size="compact" disabled={session.busy} onClick={session.keepPlaying}>Keep playing</Button>
        <Button size="compact" disabled={session.busy} onClick={session.goAgain}>Go again</Button>
      </>,
    };
  return null;
}

function resultLine(state: NonNullable<ReturnType<typeof usePlaySession>["state"]>, bot: string) {
  const learnerWon = state.result === (state.learner_color === "white" ? "1-0" : "0-1");
  switch (state.termination) {
    case "checkmate":
      return learnerWon ? `Checkmate. You beat ${bot}.` : `Checkmate. ${bot} won this one.`;
    case "resignation":
      return learnerWon ? `${bot} resigned. You won.` : `You resigned. ${bot} takes the game.`;
    case "abandoned":
      return "This game was left unfinished.";
    default:
      return state.result === "1/2-1/2"
        ? `Draw by ${state.termination ?? "rule"}.`
        : learnerWon
          ? `You won by ${state.termination ?? "rule"}.`
          : `${bot} won by ${state.termination ?? "rule"}.`;
  }
}

export default function PlayGame({ id }: { id: string }) {
  const session = usePlaySession(id);
  const { state, game, frame, report, ply, latest } = session;
  // The board shows the selected coach's portrait and voice, so the game is
  // named for that coach too, even when it was started with another one.
  const { preferences } = useCoachPreferences();
  const bot = getCoach(preferences.coach_id).name;
  const [orientation, setOrientation] = useState<"white" | "black" | null>(null);
  // "Show book": arrows for the book moves where the learner is deciding, for
  // the position it was turned on in.
  const bookMoves = state?.status === "active" ? (state.practice?.book_moves ?? []) : [];
  const bookKey = `${state?.frames.length}:${state?.practice?.status}`;
  // Any change of position or practice status turns it off, even one that comes back
  // to an earlier key (a take-back followed by the same move).
  const [showBook, setShowBook] = useState(false);
  const [bookFor, setBookFor] = useState(bookKey);
  if (bookFor !== bookKey) {
    setBookFor(bookKey);
    setShowBook(false);
  }
  usePageTitle(state ? `Playing ${bot}` : null);
  if (!state || !game)
    return (
      <>
        <ActionLink variant="quiet" href={pagePaths.Play}>Play</ActionLink>
        {session.error ? <UnavailableState>{session.error}</UnavailableState> : <LoadingState>Setting up the board…</LoadingState>}
      </>
    );
  const shownOrientation = orientation ?? state.learner_color;
  const finished = state.status === "finished";
  // Replies the engine played because the human move model was unavailable, once shown.
  const stoodIn = state.fallback_plies.filter((reply) => reply <= latest).length;
  // The latest position on the learner's turn, or an earlier one to play from again.
  const playable = (session.learnerToMove && !session.browsing) || session.canRewind;
  // The starting position is scored from the first move's report, as in game review.
  const initialScore = startingScore(game.frames);
  const scoreAt = (at: number, atReport: typeof report, atFrame: typeof frame) =>
    positionScore(atReport?.white_score ?? (at === 0 ? initialScore : null), atFrame);
  const score = scoreAt(ply, report, frame);
  const cues = cuesFor(report, frame);
  const explaining = session.explaining && !!cues;
  const currentUci = frame?.uci ?? null;
  // The coach can still be on the learner's move while the board shows the reply.
  const coach = session.coach;
  const coachHeld = coach.ply !== ply;
  // A practice question replaces the coach's comment, and its voice, until answered.
  const prompt = session.browsing ? null : practicePrompt(session, bot);
  const actor = coach.ply > 0 && coach.frame?.san ? (coach.frame.turn === "white" ? "Black" : "White") : null;
  const name = (color: "white" | "black") => {
    const rating = color === "white" ? state.white_rating : state.black_rating;
    return `${color === state.learner_color ? state[color] : `${bot} (bot)`} (${rating})`;
  };
  const statusFor = (color: "white" | "black") => {
    if (finished) return state.result ?? "";
    if (color === state.learner_color) {
      if (session.canRewind) return "Moving replaces the rest";
      return session.learnerToMove ? (session.browsing ? "Your move · browsing" : "Your move") : "";
    }
    return session.waitingForBot ? `${bot} is thinking…` : "";
  };
  return (
    <div className="game-workspace">
      {session.error && <Banner tone="error" onDismiss={session.dismissError}>{session.error}</Banner>}
      {session.replyError && (
        <Banner tone="error" action={<Button size="compact" onClick={session.retryReply}>Try again</Button>}>
          {session.replyError}
        </Banner>
      )}
      {stoodIn > 0 && state.fallback_elo != null && (
        <Banner tone="info">
          {stoodIn} of {bot}'s moves came from Stockfish at Elo {state.fallback_elo}, because the human move model was unavailable.
        </Banner>
      )}
      {finished && (
        <Banner tone="success" action={state.saved_game_id ? (
          <ActionLink variant="primary" size="compact" href={gamesPath(1, state.saved_game_id)}>
            Open {bot}'s review <ArrowRight size={16} aria-hidden="true" />
          </ActionLink>
        ) : <ActionLink variant="secondary" size="compact" href={playSetupPath(state.id)}>New game</ActionLink>}>
          {resultLine(state, bot)}
        </Banner>
      )}
      <ReviewWorkspace
        boardLabel="Game board and controls"
        aboveBoard={
          <PlayerRow
            name={name(shownOrientation === "white" ? "black" : "white")}
            color={shownOrientation === "white" ? "black" : "white"}
            complete={false}
            status={statusFor(shownOrientation === "white" ? "black" : "white")}
          />
        }
        belowBoard={
          <PlayerRow
            name={name(shownOrientation)}
            color={shownOrientation}
            complete={false}
            status={statusFor(shownOrientation)}
          />
        }
        evaluation={<EvaluationBar score={score} orientation={shownOrientation} />}
        board={
          <Board
            fen={frame?.fen ?? game.frames[0].fen}
            orientation={shownOrientation}
            legalMoves={playable ? (frame?.legal_moves ?? []) : []}
            disabled={!playable || session.moving}
            onMove={session.play}
            highlights={moveSquares(currentUci)}
            quality={report && currentUci ? { square: currentUci.slice(2, 4), label: report.label } : undefined}
            roles={explaining ? cues!.roles : undefined}
            arrows={
              explaining
                ? cueArrows(cues!)
                : showBook && !session.browsing
                  ? bookMoves.map((uci) => uciArrow(uci, ARROW_COLOURS.book))
                  : []
            }
          />
        }
        boardControls={
          <div className="game-board-controls" role="group" aria-label="Game controls">
            {finished ? (
              <ActionLink size="compact" className="game-library-link" href={playSetupPath(state.id)}>New game</ActionLink>
            ) : (
              <div className="game-board-actions">
                <Button size="compact" disabled={session.busy} onClick={session.resign}>Resign</Button>
              </div>
            )}
            <MovePlaybackControls label="Game move playback" current={ply} maximum={latest}
              first={{ "aria-label": "Start of game", title: "Starting position", disabled: ply === 0, onClick: () => session.navigate(0) }}
              previous={{ "aria-label": "Previous move", disabled: ply === 0, onClick: () => session.navigate(ply - 1) }}
              next={{ "aria-label": "Next move", disabled: ply === latest, onClick: () => session.navigate(ply + 1) }}
              last={{ "aria-label": "Latest move", disabled: ply === latest, onClick: () => session.navigate(latest) }} />
            <div className="game-board-tools">
              <FlipBoardButton onFlip={() => setOrientation(shownOrientation === "white" ? "black" : "white")} />
              <AudioMuteButton />
            </div>
          </div>
        }
      >
        <PositionCoach
          positionKey={`${id}:${coach.ply}`}
          dialogueKey={`${id}:${coach.ply}`}
          ply={coach.ply}
          variation={false}
          game={game}
          report={coach.report}
          frame={coach.frame}
          actor={actor}
          score={coachHeld ? scoreAt(coach.ply, coach.report, coach.frame) : score}
          bestMove={coach.report?.best.san ?? (coach.ply === 0 ? game.frames[1]?.report?.best.san : undefined)}
          explaining={explaining && !coachHeld}
          cues={coachHeld ? null : cues}
          errorAtPosition={session.analysisError}
          reviewStarting={false}
          speechPending={session.moving || (!!coach.speechNavigation?.awaitAnalysis && !coach.report && !session.analysisError)}
          speechEventId={prompt ? undefined : coach.speechNavigation?.eventId}
          onExplain={() => (session.analysisError ? session.retryAnalysis() : session.toggleExplanation())}
          onReturnToGame={() => session.navigate(latest)}
          live={latest === 0 ? "new" : "underway"}
          prompt={prompt}
          extraAction={bookMoves.length > 0 && (session.learnerToMove || session.deviation) && !session.browsing ? (
            <Button size="compact" aria-pressed={showBook} title="Show the book move on the board"
              onClick={() => setShowBook(value => !value)}>
              {showBook ? "Hide book" : "Show book"}
            </Button>
          ) : undefined}
        />
        <ReviewMoves
          game={game}
          exploration={{
            cursor: { ply, branch: null, step: 0 },
            branch: undefined,
            branches: [],
            navigate: session.navigate,
            selectBranch: () => undefined,
          }}
          getAnalysis={() => undefined}
          progress={null}
        />
        <EvaluationGraph
          frames={game.frames}
          initialScore={initialScore}
          selected={ply}
          onSelect={session.navigate}
          onScrubStart={session.beginScrubbing}
          onScrubSelect={(target) => session.navigate(target, { silent: true })}
          onScrubEnd={session.finishScrubbing}
        />
      </ReviewWorkspace>
    </div>
  );
}
