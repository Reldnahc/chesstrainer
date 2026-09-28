import { Chessboard, type Arrow } from "react-chessboard";
import { useEffect, useId, useRef, useState } from "react";
import type { LegalMove, Promotion } from "./api";
import MoveSymbol from "./MoveSymbol";
import { MOVE_DURATION_MS } from "./reviewMotion";
import { useInterfaceMotion } from "./MotionProvider";

export default function Board({
  fen,
  orientation,
  legalMoves = [],
  disabled,
  onMove,
  highlights = [],
  roles = {},
  arrows,
  quality,
  feedback,
}: {
  arrows?: Arrow[];
  quality?: { square: string; label: string; accessibleLabel?: string };
  feedback?: "retry";
  fen: string;
  orientation: "white" | "black";
  legalMoves?: LegalMove[];
  highlights?: string[];
  roles?: Record<string, string[]>;
  disabled?: boolean;
  onMove?: (from: string, to: string, promotion?: Promotion) => void;
}) {
  const motion = useInterfaceMotion();
  const boardId = "board-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
    choices: Promotion[];
  } | null>(null);
  const promotionTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
    window.clearTimeout(promotionTimer.current);
    return () => window.clearTimeout(promotionTimer.current);
  }, [fen, disabled]);
  const interactive = !disabled && !promotion;
  const moves =
    interactive && selected
      ? legalMoves.filter((move) => move.from_square === selected)
      : [];
  const destinations = new Map(moves.map((move) => [move.to_square, move]));
  const selectable = (square: string) =>
    legalMoves.some((move) => move.from_square === square);
  function choose(from: string, to: string, fromDrop = false) {
    if (!interactive) return;
    setSelected(null);
    // Only display/submit moves supplied by the server. Grading revalidates them.
    const matches = legalMoves.filter(
      (move) => move.from_square === from && move.to_square === to,
    );
    if (!matches.length) return;
    const choices = matches.flatMap((move) =>
      move.promotion ? [move.promotion] : [],
    );
    if (choices.length) {
      // Dnd-kit suppresses document clicks for 50 ms after a drag. Present the
      // actionable dialog after that guard ends, so its first click is not lost.
      if (fromDrop)
        promotionTimer.current = window.setTimeout(
          () => setPromotion({ from, to, choices }),
          70,
        );
      else setPromotion({ from, to, choices });
    } else onMove?.(from, to);
  }
  return (
    <div className="board-shell" data-feedback={feedback}>
      <Chessboard
        options={{
          id: boardId,
          position: fen,
          boardOrientation: orientation,
          arrows,
          allowDragging: interactive,
          animationDurationInMs: MOVE_DURATION_MS,
          showAnimations: motion === "natural",
          canDragPiece: ({ square }) => !!square && selectable(square),
          darkSquareStyle: { backgroundColor: "var(--board-dark)" },
          lightSquareStyle: { backgroundColor: "var(--board-light)" },
          darkSquareNotationStyle: {
            color: "#f5f6f8",
            fontFamily: "var(--mono)",
            fontWeight: 500,
          },
          lightSquareNotationStyle: {
            color: "#35404d",
            fontFamily: "var(--mono)",
            fontWeight: 500,
          },
          boardStyle: { borderRadius: "2px" },
          squareRenderer: ({ square, children }) => (
            <div
              title={Object.entries(roles)
                .filter(([, squares]) => squares.includes(square))
                .map(([role]) => role.replaceAll("_", " "))
                .join(", ")}
              data-pattern-square={
                Object.values(roles).some((squares) => squares.includes(square))
                  ? square
                  : undefined
              }
              className={`board-square-content${interactive && selected === square ? " selected" : ""}${highlights.includes(square) ? " playback-highlight" : ""}${Object.entries(
                roles,
              )
                .filter(([, squares]) => squares.includes(square))
                .map(
                  ([role]) =>
                    ` pattern-${role.includes("attacker") ? "attacker" : role.includes("defender") || role.includes("blocker") ? "defender" : "target"}`,
                )
                .join("")}`}
            >
              {children}
              {quality?.square === square && (
                <span
                  key={fen + quality.label}
                  className={`board-quality label-${quality.label.toLowerCase()}`}
                  aria-label={
                    quality.accessibleLabel || `Move rating: ${quality.label}`
                  }
                >
                  <MoveSymbol label={quality.label} />
                </span>
              )}
              {destinations.has(square) && (
                <span
                  aria-hidden="true"
                  data-legal-destination={square}
                  className={`legal-move-marker ${destinations.get(square)!.capture ? "capture" : "quiet"}`}
                />
              )}
            </div>
          ),
          onPieceDrag: ({ square }) => {
            if (interactive) setSelected(square);
          },
          onPieceDragCancel: () => setSelected(null),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (targetSquare) choose(sourceSquare, targetSquare, true);
            else setSelected(null);
            return false;
          },
          onSquareClick: ({ square }) => {
            if (!interactive) return;
            if (selected === square) setSelected(null);
            else if (selectable(square)) setSelected(square);
            else if (selected) choose(selected, square);
          },
        }}
      />
      {promotion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose promotion"
          className="promotion"
        >
          <h3>Promote to</h3>
          <div className="button-row">
            {(
              [
                ["q", "Queen"],
                ["r", "Rook"],
                ["b", "Bishop"],
                ["n", "Knight"],
              ] as const
            )
              .filter(([value]) => promotion.choices.includes(value))
              .map(([value, name]) => (
                <button
                  key={value}
                  onClick={() => {
                    onMove?.(promotion.from, promotion.to, value);
                    setPromotion(null);
                  }}
                >
                  {name}
                </button>
              ))}
            <button onClick={() => setPromotion(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
