import { ArrowUpRight, BookOpen, Check, Eye, RotateCw, Star, type LucideIcon } from "lucide-react";

// Pictographic symbols are icons: phones can draw arrow and check characters as emoji.
const symbols: Record<string, string> = {
  Brilliant: "!!", Great: "!", Inaccuracy: "?!", Mistake: "?", Blunder: "??",
};
const icons: Record<string, LucideIcon> = {
  Good: Check, Accepted: Check, Miss: ArrowUpRight, Retry: RotateCw, Book: BookOpen, Revealed: Eye,
};

export default function MoveSymbol({ label }: { label: string }) {
  if (label === "Best") return <Star className="move-star" size="1em" fill="currentColor" strokeWidth={0} aria-hidden="true" />;
  const Icon = icons[label];
  return Icon ? <Icon className="move-star" size="1em" strokeWidth={label === "Book" || label === "Revealed" ? 2 : 2.75} aria-hidden="true" /> : symbols[label] ?? "";
}
