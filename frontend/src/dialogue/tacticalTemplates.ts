import type {Claim} from "./model";

export const tacticalScopes = ["played_immediate", "played_possible", "allowed_immediate", "allowed_possible",
  "missed_immediate", "missed_possible"] as const;
export type TacticalScope = typeof tacticalScopes[number];
export type TacticalPresentationKey = `tactic_${TacticalScope}_${"none" | "fork" | "material" | "capture_followup"}` |
  `tactic_${"allowed" | "missed"}_${"immediate" | "possible"}_capture_candidate` | "tactic_played_capture";
export type ScopedTacticalSlots = {
  motif?: string; move?: string; best?: string; opponent?: string;
  action?: string; targets?: string; capture?: string; piece?: string; gain?: "material gain";
};

const join = (items: string[]) => items.length === 2 ? items.join(" and ") : items.join(", ");
const motifNames: Record<string, string> = {
  "hanging piece": "loose piece", "undefended capture": "capture of a loose piece",
  "removing defender": "removal of a defender", "promotion awareness": "promotion",
  "back rank": "back-rank mate", "trapped piece": "trapped piece",
};
const noun = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;

/** Select a meaning, not a sentence. Original claim slots and evidence stay intact. */
export function tacticalPresentation(item: Claim): {code: TacticalPresentationKey; slots: ScopedTacticalSlots} | null {
  const role = item.code === "tactic_played" ? "played" : item.code === "tactic_allowed" ? "allowed"
    : item.code === "tactic_missed" ? "missed" : null;
  if (!role || !item.tactic) return null;
  const {tactic} = item;
  const motif = noun(item.slots.motif);
  const slots: ScopedTacticalSlots = {
    motif: motif ? motifNames[motif] ?? motif : undefined,
    move: noun(item.slots.move), best: noun(item.slots.best), opponent: noun(item.slots.opponent),
    ...(tactic.action ? {action: noun(tactic.action)} : {}),
  };
  const scope: TacticalScope = `${role}_${tactic.timing}`;
  const effect = tactic.effect;
  if (effect.kind === "fork") return {code: `tactic_${scope}_fork`, slots: {...slots, targets: join(effect.targets)}};
  if (effect.kind === "material") return {code: `tactic_${scope}_material`, slots: {...slots, gain: "material gain"}};
  if (effect.kind === "capture") {
    const captureSlots = {...slots, capture: noun(effect.san), piece: noun(effect.piece)};
    // A capture has its own timing. A finding can reference the board before a
    // root capture without making that already-played capture hypothetical.
    if (role === "played" && effect.ply === 1 && effect.san === item.slots.move)
      return {code: "tactic_played_capture", slots: captureSlots};
    if (role === "missed" && effect.ply === 1 && effect.san === item.slots.best || role === "allowed" && effect.ply === 2)
      return {code: `tactic_${role as "allowed" | "missed"}_${tactic.timing}_capture_candidate`, slots: captureSlots};
    if (effect.ply > 1) return {code: `tactic_${scope}_capture_followup`, slots: captureSlots};
  }
  return {code: `tactic_${scope}_none`, slots};
}
