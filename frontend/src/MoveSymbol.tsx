import { Star } from "lucide-react";

const symbols: Record<string, string> = {
  Brilliant: "!!", Great: "!", Good: "✓", Inaccuracy: "?!",
  Mistake: "?", Miss: "↗", Blunder: "??",
};

export default function MoveSymbol({ label }: { label: string }) {
  return label === "Best"
    ? <Star className="move-star" size="1em" fill="currentColor" strokeWidth={0} aria-hidden="true" />
    : symbols[label] ?? "";
}
