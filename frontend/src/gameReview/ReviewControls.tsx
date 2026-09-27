import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CornerUpLeft,
  FlipVertical2,
} from "lucide-react";
import type { GameExploration } from "./useGameExploration";

export default function ReviewControls({
  exploration,
}: {
  exploration: GameExploration;
}) {
  const { branch, current, maximum, returnToGame, step, selectStep, flip } =
    exploration;
  return (
    <div
      className="game-board-controls"
      role="group"
      aria-label="Game navigation"
    >
      <button
        className="game-return"
        aria-label="Back to game"
        title="Back to game (Escape)"
        disabled={!branch}
        onClick={returnToGame}
      >
        <CornerUpLeft size={16} />
        <span>Game</span>
      </button>
      <button
        aria-label="First move"
        disabled={current === 0}
        onClick={() => selectStep(0)}
      >
        <ChevronsLeft size={19} />
      </button>
      <button
        aria-label="Previous move"
        disabled={current === 0}
        onClick={() => step(-1)}
      >
        <ChevronLeft size={19} />
      </button>
      <span className="game-move-counter">
        <span>{current}</span> / <span>{maximum}</span>
      </span>
      <button
        aria-label="Next move"
        disabled={current === maximum}
        onClick={() => step(1)}
      >
        <ChevronRight size={19} />
      </button>
      <button
        aria-label="Last move"
        disabled={current === maximum}
        onClick={() => selectStep(maximum)}
      >
        <ChevronsRight size={19} />
      </button>
      <button aria-label="Flip board" onClick={flip}>
        <FlipVertical2 size={17} />
      </button>
    </div>
  );
}
