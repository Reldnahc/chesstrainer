import { BookOpen, Eye, Star } from "lucide-react";

const symbols: Record<string, string> = {
  Brilliant: "!!", Great: "!", Good: "✓", Inaccuracy: "?!",
  Mistake: "?", Miss: "↗", Blunder: "??", Accepted: "✓", Retry: "↻",
};

export default function MoveSymbol({ label }: { label: string }) {
  if (label === "Book") return <BookOpen className="move-star" size="1em" strokeWidth={2} aria-hidden="true" />;
  if (label === "Revealed") return <Eye className="move-star" size="1em" aria-hidden="true" />;
  return label === "Best"
    ? <Star className="move-star" size="1em" fill="currentColor" strokeWidth={0} aria-hidden="true" />
    : symbols[label] ?? "";
}
