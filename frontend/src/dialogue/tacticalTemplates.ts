import type {Claim} from "./model";

const join = (items: string[]) => items.length === 2 ? items.join(" and ") : items.join(", ");
const motifNames: Record<string, string> = {
  "hanging piece": "loose piece", "undefended capture": "capture of a loose piece",
  "removing defender": "removal of a defender", "promotion awareness": "promotion",
  "back rank": "back-rank mate", "trapped piece": "trapped piece",
};

/** Scope is mandatory data in the rendered fact, never an optional character cue. */
export function tacticalPresentation(item: Claim): {code: string; slots: Claim["slots"]} | null {
  const role = item.code === "tactic_played" ? "played" : item.code === "tactic_allowed" ? "allowed"
    : item.code === "tactic_missed" ? "missed" : null;
  if (!role || !item.tactic) return null;
  const {tactic, slots} = item;
  const motif = motifNames[String(slots.motif)] ?? String(slots.motif);
  const idea = `${/^[aeiou]/i.test(motif) ? "an" : "a"} ${motif}`;
  const immediate = tactic.timing === "immediate";
  const effect = tactic.effect;
  const actualCapture = effect.kind === "capture" && role === "played" && effect.ply === 1 && effect.san === slots.move;
  const setup = actualCapture ? `The idea to notice with ${slots.move} is ${idea}.` : role === "played"
    ? immediate ? `After ${slots.move}, there is ${idea}.` : `${idea[0].toUpperCase()}${idea.slice(1)} is one possibility to watch for after ${slots.move}.`
    : role === "allowed"
      ? immediate ? `${slots.opponent} can reply with ${tactic.action}: there is ${idea}.` : `Watch for ${idea} that ${slots.opponent} could use.`
      : immediate ? `With ${slots.best}, there would be ${idea}.` : `${slots.best} offers a possible ${motif}, depending on the replies.`;
  let detail = "";
  if (effect.kind === "fork") {
    const targets = join(effect.targets);
    detail = immediate && role === "played" ? `The ${targets} are attacked together.`
      : `The ${targets} would be attacked together.`;
  } else if (effect.kind === "material") {
    // This is the material change at one finite PV's endpoint, not proof that the
    // motif wins against every defense or that the mover is ahead in material.
    detail = "A material gain is possible, but it depends on how both sides follow up.";
  } else if (effect.kind === "capture") {
    // Captures have their own move timing. A loose-piece finding references the
    // board before the capture, so its frame is not proof of a future capture.
    detail = actualCapture
      ? `${effect.san} captures a ${effect.piece}.`
      : role === "missed" && effect.ply === 1 && effect.san === slots.best || role === "allowed" && effect.ply === 2
        ? `${effect.san} would capture a ${effect.piece}.`
        : effect.ply > 1 ? `One possible follow-up is ${effect.san}, capturing a ${effect.piece}.` : "";
  }
  return {code: "tactic_witness", slots: {setup, detail}};
}

export const tacticalTemplate = ["{setup} {detail}"] as const;
