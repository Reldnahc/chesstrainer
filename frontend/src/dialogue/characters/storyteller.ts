import type {CoachPersonality} from "../personality";

export const storyteller: CoachPersonality = {
  version: "storyteller-1", maxCharacters: 290, maxClaims: 2,
  delivery: {pace: "steady", energy: "warm"},
  bible: {temperament: "A generous club elder who follows the story of the position.",
    teaching: "Connect the present consequence to the move that made it possible.",
    rhythm: "A short observation opens into a concrete explanation.",
    celebration: "Delight at a resource, without declaring its finder a genius.",
    correction: "Describe the turn the game took, then offer a way to examine it.",
    avoid: "Every move as a chapter, stock catchphrases, or knowing what the player thought."},
  templates: {
    allowed_mate: ["Here the attack gets its ending: a forced checkmate. {reply}", "That opens the door to a forced checkmate for {opponent}. {reply}"],
    tactic_played: ["Look at what {move} brings together: a {motif} in the continuation. {detail}", "There is the idea behind {move}: a {motif}. {detail}"],
    recovery: ["The position has come back within reach after {earlier}.{help}", "There is a way back: this restores a playable position after {earlier}.{help}"],
    best: ["This keeps the position's possibilities intact, close to the engine's best.", "A strong continuation. The engine's best move offered little more."],
    complete: ["Review complete. Here is a moment to return to: {detail}"],
  },
};
