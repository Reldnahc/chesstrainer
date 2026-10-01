import type {ClaimWording} from "./personality";
import {tacticalScopes, type TacticalPresentationKey, type TacticalScope} from "./tacticalTemplates";

/** Author complete factual sentences here, outside the evidence projection.
 * Scope and effects are mandatory; neither can be relegated to an optional cue. */
export type TacticalAuthoring = {
  scope: Record<TacticalScope, string>;
  fork: {actual: string; possible: string};
  material: string;
  capture: {candidate: string; followup: string};
  playedCapture: {fact: string; consequence: string};
};
export type TacticalWordings = Record<TacticalPresentationKey, readonly ClaimWording[]>;

/** Build static authored templates, never English-valued runtime fact slots. */
export function authorTacticalWordings(author: TacticalAuthoring): TacticalWordings {
  const result = {} as TacticalWordings;
  for (const scope of tacticalScopes) {
    const fact = author.scope[scope];
    result[`tactic_${scope}_none`] = [{fact}];
    result[`tactic_${scope}_fork`] = [{fact, consequence: scope === "played_immediate" ? author.fork.actual : author.fork.possible}];
    result[`tactic_${scope}_material`] = [{fact, consequence: author.material}];
    result[`tactic_${scope}_capture_followup`] = [{fact, consequence: author.capture.followup}];
    if (scope !== "played_immediate" && scope !== "played_possible")
      result[`tactic_${scope}_capture_candidate`] = [{fact, consequence: author.capture.candidate}];
  }
  result.tactic_played_capture = [author.playedCapture];
  return result;
}

const neutral = authorTacticalWordings({
  scope: {
    played_immediate: "After {move}, there is a {motif}.",
    played_possible: "After {move}, a {motif} is a possibility, depending on the replies.",
    allowed_immediate: "{opponent} can reply with {action}: there is a {motif}.",
    allowed_possible: "The possible idea for {opponent} is a {motif}, depending on the replies.",
    missed_immediate: "With {best}, there would be a {motif}.",
    missed_possible: "{best} offers a possible {motif}, depending on the replies.",
  },
  fork: {actual: "The {targets} are attacked together.", possible: "The {targets} would be attacked together."},
  material: "A {gain} is possible, but it depends on how both sides follow up.",
  capture: {candidate: "{capture} would capture a {piece}.", followup: "One possible follow-up is {capture}, capturing a {piece}."},
  playedCapture: {fact: "The idea to notice with {move} is a {motif}.", consequence: "{capture} captures a {piece}."},
});

// The neutral references establish each key's required slots for validWording.
export const neutralTacticalTemplates = {} as Record<TacticalPresentationKey, readonly string[]>;
for (const key of Object.keys(neutral) as TacticalPresentationKey[]) {
  neutralTacticalTemplates[key] = neutral[key].map(option => typeof option === "string" ? option
    : [option.fact, option.consequence].filter(Boolean).join(" "));
}
