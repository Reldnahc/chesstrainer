import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FlipVertical2,
} from "lucide-react";
import type { GameExploration } from "./useGameExploration";

export default function ReviewControls({
  exploration,
}: {
  exploration: GameExploration;
}) {
  const {
    branch, cursor, current, maximum, firstPly, navigate, step, selectStep, flip,
  } = exploration;
  return (
    <div
      className="game-board-controls"
      role="group"
      aria-label="Game navigation"
    >
      <button
        aria-label="First move"
        title="First move of the original game"
        disabled={!branch && cursor.ply === firstPly}
        onClick={() => navigate(firstPly)}
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
