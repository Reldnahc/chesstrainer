import { useEffect, useState } from "react";
import { ArrowRight, FlipVertical2 } from "lucide-react";
import Board from "../Board";
import ReviewWorkspace from "../ReviewWorkspace";
import EvaluationGraph from "../EvaluationGraph";
import ActionLink from "../ActionLink";
import Button, { IconButton } from "../Button";
import MovePlaybackControls from "../MovePlaybackControls";
import Notice from "../Notice";
import { LoadingState, UnavailableState } from "../LoadState";
import AudioMuteButton from "../audio/AudioMuteButton";
import { scoreText, strength } from "../evaluation";
import { PlayerRow } from "../gameReview/Players";
import PositionCoach from "../gameReview/PositionCoach";
import ReviewMoves from "../gameReview/ReviewMoves";
import { gamesPath, pagePaths } from "../navigation";
import { usePlaySession } from "./usePlaySession";

function resultLine(state: NonNullable<ReturnType<typeof usePlaySession>["state"]>) {
  const learnerWon = state.result === (state.learner_color === "white" ? "1-0" : "0-1");
  const bot = state.coach_name;
  switch (state.termination) {
    case "checkmate":
      return learnerWon ? `Checkmate. You beat ${bot}.` : `Checkmate. ${bot} won this one.`;
    case "resignation":
      return learnerWon ? `${bot} resigned. You won.` : `You resigned. ${bot} takes the game.`;
    case "agreement":
      return `${bot} accepted the draw.`;
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
  const [orientation, setOrientation] = useState<"white" | "black" | null>(null);
  useEffect(() => {
    if (state) document.title = `Playing ${state.coach_name} · Fieldwork`;
  }, [state?.coach_name]);
  if (!state || !game)
    return (
      <>
        <ActionLink variant="quiet" href={pagePaths.Play}>Play</ActionLink>
        {session.error ? <UnavailableState>{session.error}</UnavailableState> : <LoadingState>Setting up the board…</LoadingState>}
      </>
    );
  const shownOrientation = orientation ?? state.learner_color;
  const commentary = state.commentary;
  const finished = state.status === "finished";
  const score = report?.white_score ?? null;
  const cues = report?.board_cues?.fen === frame?.fen ? (report?.board_cues ?? null) : null;
  const explaining = session.explaining && !!cues;
  const currentUci = frame?.uci ?? null;
  const actor = ply > 0 && frame?.san ? (frame.turn === "white" ? "Black" : "White") : null;
  const bot = state.coach_name;
  const name = (color: "white" | "black") => {
    const rating = color === "white" ? state.white_rating : state.black_rating;
    return `${state[color]} (${rating})`;
  };
  const statusFor = (color: "white" | "black") => {
    if (finished) return state.result ?? "";
    if (color === state.learner_color)
      return session.learnerToMove ? (session.browsing ? "Your move · browsing" : "Your move") : "";
    return session.waitingForBot ? `${bot} is thinking…` : "";
  };
  const askable = commentary === "request" && ply > 0 && !report && !session.browsing;
  return (
    <div className="game-workspace">
      {session.error && (
        <Notice announcement="alert" tone="error" actions={<Button onClick={session.dismissError}>Dismiss</Button>}>
          {session.error}
        </Notice>
      )}
      {finished && (
        <Notice announcement="status" tone="success" actions={state.saved_game_id ? (
          <ActionLink variant="primary" size="compact" href={gamesPath(1, state.saved_game_id)}>
            Open {bot}'s review <ArrowRight size={16} aria-hidden="true" />
          </ActionLink>
        ) : <ActionLink variant="secondary" size="compact" href={pagePaths.Play}>New game</ActionLink>}>
          {resultLine(state)}
        </Notice>
      )}
      {state.draw_declined && !finished && (
        <Notice announcement="status" tone="info">{bot} declined the draw.</Notice>
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
        evaluation={
          commentary === "live" ? (
            <div className="game-eval-bar" aria-label={`Evaluation for White: ${scoreText(score, 1)}`}>
              <div
                style={{
                  height: `${score ? 50 + 48 * strength(score) : 50}%`,
                  top: shownOrientation === "black" ? 0 : "auto",
                  bottom: shownOrientation === "white" ? 0 : "auto",
                }}
              />
              <span>{scoreText(score, 1)}</span>
            </div>
          ) : undefined
        }
        board={
          <Board
            fen={frame?.fen ?? game.frames[0].fen}
            orientation={shownOrientation}
            legalMoves={session.learnerToMove && !session.browsing ? (frame?.legal_moves ?? []) : []}
            disabled={!session.learnerToMove || session.browsing || session.moving}
            onMove={session.play}
            highlights={currentUci ? [currentUci.slice(0, 2), currentUci.slice(2, 4)] : []}
            quality={report && currentUci ? { square: currentUci.slice(2, 4), label: report.label } : undefined}
            roles={explaining ? cues!.roles : undefined}
            arrows={
              explaining
                ? cues!.arrows.map((a) => ({
                    ...a,
                    color: a.kind === "move" ? "#b8d69be6" : a.kind === "reply" ? "#ffb17be6" : "#ff7187db",
                  }))
                : []
            }
          />
        }
        boardControls={
          <div className="game-board-controls" role="group" aria-label="Game controls">
            {finished ? (
              <ActionLink size="compact" className="game-library-link" href={pagePaths.Play}>New game</ActionLink>
            ) : (
              <div className="game-board-actions">
                <Button size="compact" onClick={session.resign}>Resign</Button>
                <Button size="compact" onClick={session.offerDraw} disabled={state.draw_declined}>Offer draw</Button>
              </div>
            )}
            <MovePlaybackControls label="Game move playback" current={ply} maximum={latest}
              first={{ "aria-label": "Start of game", title: "Starting position", disabled: ply === 0, onClick: () => session.navigate(0) }}
              previous={{ "aria-label": "Previous move", disabled: ply === 0, onClick: () => session.navigate(ply - 1) }}
              next={{ "aria-label": "Next move", disabled: ply === latest, onClick: () => session.navigate(ply + 1) }}
              last={{ "aria-label": "Latest move", disabled: ply === latest, onClick: () => session.navigate(latest) }} />
            <div className="game-board-tools">
              <IconButton aria-label="Flip board" onClick={() => setOrientation(shownOrientation === "white" ? "black" : "white")}>
                <FlipVertical2 size={17} />
              </IconButton>
              <AudioMuteButton />
            </div>
          </div>
        }
      >
        <PositionCoach
          positionKey={`${id}:${ply}`}
          dialogueKey={`${id}:${ply}`}
          ply={ply}
          variation={false}
          game={game}
          report={report}
          frame={frame}
          actor={actor}
          score={score}
          bestMove={commentary === "live" || report ? report?.best.san : null}
          explaining={explaining}
          cues={cues}
          errorAtPosition={commentary === "after" ? null : session.analysisError}
          reviewStarting={false}
          speechPending={session.moving || session.waitingForBot || (!!session.speechNavigation?.awaitAnalysis && !report && !session.analysisError && commentary === "live")}
          speechEventId={session.speechNavigation?.eventId}
          onExplain={() => (session.analysisError ? session.retryAnalysis() : session.toggleExplanation())}
          onReturnToGame={() => session.navigate(latest)}
        />
        {askable && (
          <div className="button-row">
            <Button size="compact" variant="secondary" onClick={session.ask} disabled={session.analysisPending}>
              {session.analysisPending ? `${bot} is looking…` : `Ask ${bot} about this move`}
            </Button>
          </div>
        )}
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
        {commentary === "live" && (
          <EvaluationGraph
            frames={game.frames}
            selected={ply}
            onSelect={session.navigate}
            onScrubSelect={(target) => session.navigate(target, { silent: true })}
          />
        )}
      </ReviewWorkspace>
    </div>
  );
}
