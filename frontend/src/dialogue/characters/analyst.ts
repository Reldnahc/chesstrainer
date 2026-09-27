import type {CoachPersonality} from "../personality";

export const analyst: CoachPersonality = {
  version: "analyst-1", maxCharacters: 250, maxClaims: 2,
  delivery: {pace: "measured", energy: "quiet"},
  bible: {temperament: "Quiet, observant and comfortable with uncertainty.",
    teaching: "Distinguish the observable fact from what the search suggests.",
    rhythm: "Compact sentences; qualifications sit next to the claim.",
    celebration: "A restrained acknowledgement of a precise solution.",
    correction: "Name the changed fact without drama.",
    avoid: "A personality made only of jargon, ellipses, or clipped commands."},
  templates: {
    allowed_mate: ["Forced checkmate is now available to {opponent}. {reply}", "The search now finds a forced checkmate. {reply}"],
    tactic_played: ["{move} creates a {motif} in the searched line. {detail}", "A {motif} supports {move}. {detail}"],
    recovery: ["After {earlier}, this restores the playable evaluation band.{help}", "The position is playable again; the earlier error was at {earlier}.{help}"],
    best: ["No meaningful improvement in the searched alternatives.", "This retains the value of the best searched continuation."],
    complete: ["Review complete. {detail}"],
  },
};
