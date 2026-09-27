import type { Schema } from "../api";
import type { Game } from "./types";

export const momentNames: Record<Schema["NarrativeMoment"]["kind"], string> = {
  opening: "Opening", turning_point: "Turning point", best_find: "Strong find",
  hard_find: "Difficult find", missed_opportunity: "Missed chance", defense: "Key defense",
  recovery: "Recovery", repeated_issue: "Recurring motif", conversion: "Conversion",
  erosion: "Gradual slide", conclusion: "Game result",
};

export function moveLabel(game: Game, ply: number) {
  const frame = game.frames[ply];
  return frame ? `${frame.number}${frame.actor === "black" ? "..." : "."} ${frame.san}` : `Ply ${ply}`;
}

export function momentText(moment: Schema["NarrativeMoment"], game: Game) {
  const f = moment.facts;
  const side = f.side === "black" ? "Black" : "White";
  const at = moment.plies.length ? moveLabel(game, moment.plies.at(-1)!) : "";
  const from = moment.plies.length ? moveLabel(game, moment.plies[0]) : "";
  switch (moment.kind) {
    case "opening": return f.name
      ? `${f.name}${f.departure_ply ? `; the game leaves the catalogue at ${at}` : ""}. Book recognition is not a quality grade.`
      : `The game leaves the opening catalogue at ${at}.`;
    case "turning_point": return `${at} was the largest reviewed concession${f.mate_transition ? ", involving a forced-mate transition" : ""}.`;
    case "best_find": return `${side}'s ${at} is a strong move worth revisiting.`;
    case "hard_find": return `${side} found ${at}, a challenging engine choice in the human-model assessment.`;
    case "missed_opportunity": return `${side} had a concrete chance at ${at}.`;
    case "defense": return `${at} was the only good defense among the searched alternatives.`;
    case "recovery": return `${side} recovered a playable position at ${at} after the error at ${from}.`;
    case "repeated_issue": return `${String(f.motif).replaceAll("_", " ")} appears again at ${at}, among ${f.occurrence} supported occurrences for ${side}.`;
    case "conversion": return `${side} kept the searched advantage from ${from} through the recorded win.`;
    case "erosion": return `Several small concessions by ${side}, from ${from} to ${at}, added up to a worse position.`;
    case "conclusion": {
      const result = f.result === "1-0" ? "White won" : f.result === "0-1" ? "Black won" : f.result === "1/2-1/2" ? "The game was drawn" : "No result was recorded";
      const endings: Record<string, string> = {checkmate: "checkmate", stalemate: "stalemate", insufficient_material: "insufficient material", seventyfive_moves: "the 75-move rule", fivefold_repetition: "fivefold repetition"};
      return `${result}${f.termination ? ` by ${endings[String(f.termination)] ?? String(f.termination).replaceAll("_", " ")}` : f.source === "pgn" ? " (recorded result)" : ""}.`;
    }
  }
}

export function completionText(game: Game) {
  const story = game.narrative;
  if (!story?.complete) return null;
  const takeaway = story.moments.find((m) => story.takeaways.includes(m.id));
  return takeaway ? `Review complete. ${momentText(takeaway, game)}` : "Review complete. Select a move or move a piece to explore an alternative.";
}
