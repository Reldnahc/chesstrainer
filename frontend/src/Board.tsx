import { Chessboard, defaultArrowOptions, type Arrow, type PieceHandlerArgs } from "react-chessboard";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { LegalMove, Promotion } from "./api";
import Button from "./Button";
import DialogPresence from "./DialogPresence";
import MoveSymbol from "./MoveSymbol";
import { MOVE_DURATION_MS } from "./reviewMotion";
import { useInterfaceMotion } from "./MotionProvider";
import useModalDialog from "./useModalDialog";

type PromotionChoice = { from: string; to: string; choices: Promotion[] };

/** Chess.com's annotation colours: right-click marks a square red, Shift green,
 * Ctrl (or Cmd) yellow and Alt blue; right-drag draws an arrow, yellow by
 * default, Ctrl red, Shift green and Alt blue. Left-click clears both. */
type MarkColor = "red" | "green" | "yellow" | "blue";
type Modifiers = { altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };
const DRAWN_ARROWS = {
  ...defaultArrowOptions,
  colors: { default: "#ffaa00", shift: "#4caf50", ctrl: "#f44336", alt: "#2f80ed", meta: "#f44336" },
};
// The library resolves arrow modifiers in this order too.
function markColor(keys: Modifiers): MarkColor {
  return keys.altKey ? "blue" : keys.shiftKey ? "green" : keys.ctrlKey || keys.metaKey ? "yellow" : "red";
}

// react-chessboard's default arrow opacity.
const ARROW_OPACITY = 0.65;

/** A colour's own transparency would fade the stem and the head separately, so
 * the stem shows darker where it runs under the head. Draw the arrow in the
 * opaque colour and fade the whole arrow at once instead. */
function arrowFades(boardId: string, arrows: Arrow[]) {
  const rules: string[] = [];
  const opaque = arrows.map((arrow, index) => {
    const match = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(arrow.color);
    if (!match) return arrow;
    const opacity = (ARROW_OPACITY * Number.parseInt(match[2], 16)) / 255;
    // The library draws the given arrows first, in order, and names each head after its index.
    rules.push(`.board-shell path[marker-end="url(#${boardId}-arrowhead-${index}-${arrow.startSquare}-${arrow.endSquare})"]`
      + `{opacity:${opacity.toFixed(3)}}`);
    return { ...arrow, color: `#${match[1]}` };
  });
  return { opaque, style: rules.join("") };
}

function PromotionDialog({ board, promotion, onChoose, onClose }: {
  board: RefObject<HTMLDivElement | null>;
  promotion: PromotionChoice;
  onChoose: (value: Promotion) => void;
  onClose: () => void;
}) {
  const dialog = useModalDialog(onClose, board);
  useLayoutEffect(() => {
    const element = dialog.ref.current!;
    const anchor = board.current!;
    const position = () => {
      const bounds = anchor.getBoundingClientRect();
      // eslint-disable-next-line react-hooks/immutability -- the element is the dialog DOM node behind the hook's ref; positioning it in a layout effect is intended
      const styles = getComputedStyle(element);
      const inlineInset = Number.parseFloat(styles.getPropertyValue("--promotion-inline-inset"));
      const blockInset = Number.parseFloat(styles.getPropertyValue("--promotion-block-inset"));
      const width = Math.min(bounds.width * (1 - inlineInset * 2), window.innerWidth - 16);
      element.style.width = `${width}px`;
      element.style.left = `${Math.max(8, Math.min(bounds.left + bounds.width * inlineInset, window.innerWidth - width - 8))}px`;
      element.style.top = `${Math.max(8, Math.min(bounds.top + bounds.height * blockInset, window.innerHeight - element.offsetHeight - 8))}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    observer.observe(element);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [board, dialog.ref]);

  return (
    <dialog {...dialog} aria-label="Choose promotion" className="promotion">
      <h3>Promote to</h3>
      <div className="button-row">
        {([
          ["q", "Queen"],
          ["r", "Rook"],
          ["b", "Bishop"],
          ["n", "Knight"],
        ] as const)
          .filter(([value]) => promotion.choices.includes(value))
          .map(([value, name]) => (
            <Button size="compact" key={value} onClick={() => onChoose(value)}>
              {name}
            </Button>
          ))}
        <Button size="compact" onClick={onClose}>Cancel</Button>
      </div>
    </dialog>
  );
}

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
  const board = useRef<HTMLDivElement>(null);
  const boardId = "board-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fades = arrowFades(boardId, arrows ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<PromotionChoice | null>(null);
  const [marks, setMarks] = useState<Record<string, MarkColor>>({});
  // The square where the right button went down. A mark needs the release on
  // that same square; Linux and macOS open the context menu on the press, so
  // marking from contextmenu would mark the start square of every drawn arrow.
  const rightPress = useRef<string | null>(null);
  // Drawn marks belong to a position, as the library's drawn arrows do.
  useEffect(() => setMarks({}), [fen]);
  const promotionTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
    window.clearTimeout(promotionTimer.current);
    return () => window.clearTimeout(promotionTimer.current);
  }, [fen, disabled]);
  const interactive = !disabled && !promotion;
  const interactiveRef = useRef(interactive);
  useLayoutEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);
  // react-chessboard retains its drag-start callback until the position changes.
  // Lessons can unlock the same position, so read the current input state here.
  const onPieceDrag = useCallback(({ square }: PieceHandlerArgs) => {
    if (interactiveRef.current) setSelected(square);
  }, []);
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
    <div ref={board} tabIndex={-1} className="board-shell" data-feedback={feedback}
      onContextMenu={(event) => event.preventDefault()}>
      {fades.style && <style>{fades.style}</style>}
      <Chessboard
        options={{
          id: boardId,
          position: fen,
          boardOrientation: orientation,
          arrows: fades.opaque,
          arrowOptions: DRAWN_ARROWS,
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
              data-mark={marks[square]}
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
          onPieceDrag,
          onPieceDragCancel: () => setSelected(null),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (targetSquare) choose(sourceSquare, targetSquare, true);
            else setSelected(null);
            return false;
          },
          onSquareMouseDown: ({ square }, event) => {
            if (event.button === 0) setMarks((current) => (Object.keys(current).length ? {} : current));
            if (event.button === 2) rightPress.current = square;
          },
          onSquareMouseUp: ({ square }, event) => {
            if (event.button !== 2) return;
            const pressed = rightPress.current;
            rightPress.current = null;
            if (pressed !== square) return;
            const color = markColor(event);
            setMarks(({ [square]: previous, ...rest }) => (previous === color ? rest : { ...rest, [square]: color }));
          },
          onSquareClick: ({ square }) => {
            if (!interactive) return;
            if (selected === square) setSelected(null);
            else if (selectable(square)) setSelected(square);
            else if (selected) choose(selected, square);
          },
        }}
      />
      <DialogPresence>{promotion && (
        <PromotionDialog
          board={board}
          promotion={promotion}
          onChoose={(value) => {
            onMove?.(promotion.from, promotion.to, value);
            setPromotion(null);
          }}
          onClose={() => setPromotion(null)}
        />
      )}</DialogPresence>
    </div>
  );
}
