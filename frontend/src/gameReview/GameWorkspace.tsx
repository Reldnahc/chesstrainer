import { useState } from "react";
import Banner from "../Banner";
import { ArrowLeft, Share } from "lucide-react";
import Board from "../Board";
import ReviewWorkspace from "../ReviewWorkspace";
import EvaluationGraph from "../EvaluationGraph";
import { negateScore, positionScore, scoreText, strength } from "../evaluation";
import ActionLink from "../ActionLink";
import { LoadingState, UnavailableState } from "../LoadState";
import { PlayerRow } from "./Players";
import PositionCoach from "./PositionCoach";
import ReviewControls from "./ReviewControls";
import ReviewMoves from "./ReviewMoves";
import ReviewProgress from "./ReviewProgress";
import GameExportDialog from "../gameExport/GameExportDialog";
import DialogPresence from "../DialogPresence";
import { useGameReviewSession } from "./useGameReviewSession";
import { useGameExploration } from "./useGameExploration";
import { usePositionAnalysis } from "./usePositionAnalysis";
import { useGuest } from "../AccountGate";

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
  // Signed-out visitors step through a shared review; trying moves needs the engine.
  const guest = useGuest();
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
  const [exporting, setExporting] = useState(false);
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
    speechNavigation,
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
      !guest &&
      !!game &&
      !saved &&
      !startingReport &&
      !!frame &&
      (!!branch || (!running && !reviewStarting)),
  });
  const currentAnalysis = analysis.get(root, path);
  const report = saved || currentAnalysis?.report;
  // The first move's best score is the start position's own score, from the
  // side to move; the board shows it from White's side.
  const initialScore = firstReport
    ? game?.frames[0].turn === "white"
      ? firstReport.best.score
      : negateScore(firstReport.best.score)
    : null;
  // A move's saved score is that move's search; a variation's own search and
  // the start's score belong to the position itself.
  const score = report
    ? positionScore(report.white_score, frame)
    : positionScore(
        currentAnalysis?.score || (startingReport ? initialScore : null),
        frame,
        "position",
      );
  const bestMove =
    report?.best.san || currentAnalysis?.best_move || startingReport?.best.san;
  const cues =
    report?.board_cues?.fen === frame?.fen
      ? (report?.board_cues ?? null)
      : null;
  const explaining = exploration.explanationKey === key && !!cues;
  const actor =
    (branch ? cursor.step > 0 : cursor.ply > 0) && frame?.san
      ? frame.turn === "white"
        ? "Black"
        : "White"
      : null;
  async function play(from: string, to: string, promotion?: string) {
    const played = await exploration.play(from, to, promotion);
    if (played) {
      await analysis.request(played.root, played.moves);
    }
  }
  if (!game)
    return (
      <>
        <ActionLink variant="quiet" href={libraryHref}>
          <ArrowLeft size={16} />
          All games
        </ActionLink>
        {error
          ? <UnavailableState>{error}</UnavailableState>
          : <LoadingState>Opening game…</LoadingState>}
      </>
    );
  const playerName = (color: "white" | "black") => {
    const elo = color === "white" ? game.white_rating : game.black_rating;
    return `${game[color]}${elo ? ` (${elo})` : ""}`;
  };
  const displayed = frame || (branchPosition?.value ?? game.frames[cursor.ply]);
  // Clocks follow the original game; a variation keeps the clocks where it began.
  const clocked = game.frames.some((item) => item.clock != null);
  const clockAt = (color: "white" | "black") => {
    if (!clocked) return undefined;
    for (let ply = root; ply > 0; ply--) {
      const item = game.frames[ply];
      if (item?.actor === color && item.clock != null) return item.clock;
    }
    return game.clock_start ?? null;
  };
  const toMove = frame?.turn || displayed.turn;
  // The opponent's strongest answer to the move just played, faded so it reads
  // as a suggestion beside the move's own highlight. Show why replaces it.
  const reply = report?.immediate_reply?.uci;
  const replyArrow =
    reply && frame && report.actual.san === frame.san && !frame.termination
      ? [{ startSquare: reply.slice(0, 2), endSquare: reply.slice(2, 4), color: "#4f9cff8c" }]
      : [];
  // Pins the move just made, from the pinning piece through the pinned piece to
  // the one behind it. A pin kept from an earlier move is not drawn again.
  const pinArrows = (cues?.pins ?? []).map((pin) => ({
    startSquare: pin.startSquare, endSquare: pin.endSquare, color: "#ff71878c",
  }));
  const currentUci = branch ? path.at(-1) : game.frames[cursor.ply].uci;
  return (
    <div className="game-workspace">
      {error && <Banner tone="error" onDismiss={dismissError}>{error}</Banner>}
      <ReviewWorkspace
        boardLabel="Game board and navigation"
        aboveBoard={
          <PlayerRow
            name={playerName(orientation === "white" ? "black" : "white")}
            color={orientation === "white" ? "black" : "white"}
            accuracy={game.accuracy}
            complete={game.job?.status === "completed"}
            status={branch ? "Exploring a variation" : "Original game"}
            clock={clockAt(orientation === "white" ? "black" : "white")}
            running={!branch && !frame?.termination && toMove !== orientation}
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
                : `${toMove} to move`
            }
            clock={clockAt(orientation)}
            running={!branch && !frame?.termination && toMove === orientation}
          />
        }
        evaluation={
          <div
            className="game-eval-bar"
            aria-label={`Evaluation for White: ${scoreText(score, 1)}`}
          >
            <div
              style={{
                height: `${score ? 50 + 48 * strength(score) : 50}%`,
                top: orientation === "black" ? 0 : "auto",
                bottom: orientation === "white" ? 0 : "auto",
              }}
            />
            <span>{scoreText(score, 1)}</span>
          </div>
        }
        board={
          <Board
            fen={displayed.fen}
            orientation={orientation}
            legalMoves={guest ? [] : frame?.legal_moves || []}
            disabled={!frame || moving || guest}
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
                ? [
                    ...cues!.arrows.map((a) => ({
                      ...a,
                      color:
                        a.kind === "move"
                          ? "#b8d69be6"
                          : a.kind === "reply"
                            ? "#ffb17be6"
                            : "#ff7187db",
                    })),
                    ...pinArrows.filter((pin) => !cues!.arrows.some((a) =>
                      a.startSquare === pin.startSquare && a.endSquare === pin.endSquare)),
                  ]
                : [...replyArrow, ...pinArrows]
            }
          />
        }
        boardControls={<ReviewControls exploration={exploration} />}
      >
        <PositionCoach
          positionKey={`${id}:${analysisEpoch}:${key}`}
          dialogueKey={`${id}:${key}`}
          ply={cursor.ply}
          variation={cursor.branch !== null}
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
          speechPending={moving || !frame || (!!speechNavigation?.awaitAnalysis && !saved && !currentAnalysis && !frame.termination && !analysis.error)}
          speechEventId={speechNavigation?.eventId}
          speechOpening={!!speechNavigation?.opening}
          onExplain={() =>
            analysis.error ? analysis.retry() : exploration.toggleExplanation()
          }
          onReturnToGame={exploration.returnToGame}
        />
        <ReviewMoves
          game={game}
          exploration={exploration}
          getAnalysis={analysis.get}
          actions={
            <button className="game-export-button" aria-label="Export game" title="Export PGN, FEN or GIF"
              onClick={() => setExporting(true)}>
              <Share size={14} />
            </button>
          }
          progress={
            <ReviewProgress
              game={game}
              running={running}
              busy={busy}
              reviewStarting={reviewStarting}
              start={start}
              cancel={cancel}
            />
          }
        />
        <EvaluationGraph
          frames={game.frames}
          initialScore={initialScore}
          selected={cursor.ply}
          onSelect={navigate}
          onScrubStart={exploration.beginScrubbing}
          onScrubSelect={(ply) => navigate(ply, { silent: true })}
          onScrubEnd={exploration.finishScrubbing}
        />
      </ReviewWorkspace>
      <DialogPresence>{exporting && <GameExportDialog id={id} fen={displayed.fen} orientation={orientation} onClose={() => setExporting(false)} />}</DialogPresence>
    </div>
  );
}
