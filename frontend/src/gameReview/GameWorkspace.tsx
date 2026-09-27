import { ArrowLeft } from "lucide-react";
import Board from "../Board";
import ReviewWorkspace from "../ReviewWorkspace";
import EvaluationGraph from "../EvaluationGraph";
import { scoreText, strength } from "../evaluation";
import Link from "../Link";
import { PlayerRow } from "./Players";
import PositionCoach from "./PositionCoach";
import ReviewControls from "./ReviewControls";
import ReviewMoves from "./ReviewMoves";
import ReviewSummary from "./ReviewSummary";
import { useGameReviewSession } from "./useGameReviewSession";
import { useGameExploration } from "./useGameExploration";
import { usePositionAnalysis } from "./usePositionAnalysis";

const dateText = (date: string | null) =>
  date && !date.includes("?") ? date : "Date unknown";

export default function GameWorkspace({
  id,
  initialPly,
  libraryHref,
}: {
  id: string;
  initialPly: number;
  libraryHref: string;
}) {
  const session = useGameReviewSession(id);
  const {
    game,
    busy,
    reviewStarting,
    running,
    error,
    setError,
    dismissError,
    start,
    cancel,
    analysisEpoch,
  } = session;
  const exploration = useGameExploration(id, initialPly, game, setError);
  const {
    cursor,
    branch,
    root,
    path,
    key,
    frame,
    branchPosition,
    orientation,
    moving,
    navigate,
  } = exploration;
  const saved = !branch ? game?.frames[cursor.ply]?.report : null;
  const firstReport = game?.frames[1]?.report;
  const startingReport = !branch && cursor.ply === 0 ? firstReport : null;
  const analysis = usePositionAnalysis({
    id,
    rating: game?.rating ?? 1000,
    epoch: analysisEpoch,
    root,
    path,
    positionKey: key,
    browse:
      !!game &&
      !saved &&
      !startingReport &&
      !!frame &&
      (!!branch || (!running && !reviewStarting)),
  });
  const currentAnalysis = analysis.get(root, path);
  const report = saved || currentAnalysis?.report;
  const initialScore = firstReport
    ? {
        ...firstReport.best.score,
        value:
          firstReport.best.score.value *
          (game?.frames[0].turn === "white" ? 1 : -1),
      }
    : null;
  const score =
    report?.white_score ||
    currentAnalysis?.score ||
    (startingReport ? initialScore : null);
  const bestMove =
    report?.best.san || currentAnalysis?.best_move || startingReport?.best.san;
  const cues =
    report?.board_cues?.fen === frame?.fen ? report?.board_cues : null;
  const explaining = exploration.explanationKey === key && !!cues;
  const actor =
    (branch ? cursor.step > 0 : cursor.ply > 0) && frame?.san
      ? frame.turn === "white"
        ? "Black"
        : "White"
      : null;
  async function play(from: string, to: string, promotion?: string) {
    const played = await exploration.play(from, to, promotion);
    if (played) void analysis.request(played.root, played.moves);
  }
  if (!game)
    return (
      <>
        <Link className="button-link text-button" href={libraryHref}>
          <ArrowLeft size={16} />
          All games
        </Link>
        <p role={error ? "alert" : "status"}>{error || "Opening game…"}</p>
      </>
    );
  const playerName = (color: "white" | "black") => {
    const elo = color === "white" ? game.white_rating : game.black_rating;
    return `${game[color]}${elo ? ` (${elo})` : ""}`;
  };
  const displayed = frame || (branchPosition?.value ?? game.frames[cursor.ply]);
  const currentUci = branch ? path.at(-1) : game.frames[cursor.ply].uci;
  return (
    <div className="game-workspace">
      {error && (
        <p className="notice error" role="alert">
          {error}
          <button onClick={dismissError}>Dismiss</button>
        </p>
      )}
      <ReviewWorkspace
        boardLabel="Game board and navigation"
        heading={
          <>
            <Link className="button-link text-button" href={libraryHref}>
              <ArrowLeft size={16} />
              All games
            </Link>
            <h1>
              {game.white} <span>vs</span> {game.black}
            </h1>
            <span>
              {dateText(game.played_on)} · {game.result}
            </span>
          </>
        }
        aboveBoard={
          <PlayerRow
            name={playerName(orientation === "white" ? "black" : "white")}
            color={orientation === "white" ? "black" : "white"}
            accuracy={game.accuracy}
            complete={game.job?.status === "completed"}
            status={branch ? "Exploring a variation" : "Original game"}
          />
        }
        belowBoard={
          <PlayerRow
            name={playerName(orientation)}
            color={orientation}
            accuracy={game.accuracy}
            complete={game.job?.status === "completed"}
            status={
              frame?.termination
                ? `${frame.result} · ${frame.termination}`
                : `${frame?.turn || displayed.turn} to move`
            }
          />
        }
        evaluation={
          <div
            className="game-eval-bar"
            aria-label={`Evaluation for White: ${scoreText(score)}`}
          >
            <div
              style={{
                height: `${score ? 50 + 48 * strength(score) : 50}%`,
                top: orientation === "black" ? 0 : "auto",
                bottom: orientation === "white" ? 0 : "auto",
              }}
            />
            <span>{scoreText(score)}</span>
          </div>
        }
        board={
          <Board
            fen={displayed.fen}
            orientation={orientation}
            legalMoves={frame?.legal_moves || []}
            disabled={!frame || moving}
            onMove={play}
            highlights={
              currentUci ? [currentUci.slice(0, 2), currentUci.slice(2, 4)] : []
            }
            quality={
              report && currentUci
                ? { square: currentUci.slice(2, 4), label: report.label }
                : undefined
            }
            roles={explaining ? cues!.roles : undefined}
            arrows={
              explaining
                ? cues!.arrows.map((a) => ({
                    ...a,
                    color:
                      a.kind === "move"
                        ? "#b8d69be6"
                        : a.kind === "reply"
                          ? "#ffb17be6"
                          : "#ff7187db",
                  }))
                : []
            }
          />
        }
        boardControls={<ReviewControls exploration={exploration} />}
      >
        <PositionCoach
          game={game}
          report={report}
          frame={frame}
          actor={actor}
          score={score}
          bestMove={bestMove}
          explaining={explaining}
          cues={cues}
          errorAtPosition={analysis.error}
          reviewStarting={reviewStarting}
          onExplain={() =>
            analysis.error ? analysis.retry() : exploration.toggleExplanation()
          }
        />
        <ReviewMoves
          game={game}
          exploration={exploration}
          getAnalysis={analysis.get}
        />
        <EvaluationGraph
          frames={game.frames}
          initialScore={initialScore}
          selected={cursor.ply}
          onSelect={navigate}
        />
        <ReviewSummary
          game={game}
          running={running}
          busy={busy}
          reviewStarting={reviewStarting}
          start={start}
          cancel={cancel}
        />
      </ReviewWorkspace>
    </div>
  );
}
