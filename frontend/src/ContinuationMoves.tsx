import Button from "./Button";
import "./continuation-moves.css";

type ContinuationMove = { san: string; before_fen: string };

export default function ContinuationMoves({ label, moves, selectedIndex, startSelected, disabled = false, numbered = false, onStart, onSelect }: {
  label: string;
  moves: readonly ContinuationMove[];
  selectedIndex: number | null;
  startSelected: boolean;
  disabled?: boolean;
  numbered?: boolean;
  onStart: () => void;
  onSelect: (index: number) => void;
}) {
  return <div className="continuation-moves" role="group" aria-label={label}>
    <Button size="compact" disabled={disabled} aria-current={startSelected ? "step" : undefined} onClick={onStart}>Start</Button>
    {moves.map((move, index) => {
      const position = numbered ? move.before_fen.split(" ") : null;
      const prefix = position ? `${position[5]}${position[1] === "w" ? "." : "…"} ` : "";
      return <Button size="compact" key={index} disabled={disabled} aria-current={selectedIndex === index ? "step" : undefined}
        onClick={() => onSelect(index)}>{prefix}{move.san}</Button>;
    })}
  </div>;
}
