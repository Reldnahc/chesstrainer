import registry from "./banks/registry.json" with {type: "json"};

// Recorded takes whose words are false where their meaning can fire. Selection
// keeps them silent, so the written line (or the next clip, or the grade take)
// stands in; nothing here changes a recording. COACH_DIALOGUE.md lists each one
// under "Recorded lines that would need new takes". Keys are voice IDs (bank folders).

const voiceOf = new Map(registry.banks.map(bank => [bank.coachId, bank.voiceId]));
/** The recorded voice of a coach, or null for a coach without a bank. */
export const coachVoice = (coachId: string | null | undefined) => voiceOf.get(coachId ?? "") ?? null;

type Role = "played" | "allowed" | "missed";

/** The departure fires after the game's last move in our opening catalogue, which
 * can be a main-line theory move. These takes say theory, the known opening,
 * preparation or a documented line ends there, or that everything after is new. */
export const SILENT_DEPARTURE_VOICES: ReadonlySet<string> = new Set([
  "arjun", "biscuit", "ember", "felix", "femi", "ingrid", "jun", "marisol", "mateo", "monty", "pip", "reka", "tala", "ziggy",
]);

/** Back-rank takes saying the king's own pieces occupy or block its escape squares.
 * A back-rank mate checks along the king's rank, so the square beside the king
 * toward the checker is empty or the checker itself, never the king's own piece:
 * the claim cannot hold in any back-rank mate. Their rook and queen variants share
 * the wording. "Boxed in" or "behind its own pieces" takes are true and stay. */
export const OWN_PIECES_BLOCK_ESCAPE: Readonly<Record<string, readonly Role[]>> = {
  alfie: ["played"], arjun: ["played"], bandit: ["played"], button: ["allowed"], ember: ["allowed"],
  felix: ["allowed"], femi: ["played", "missed"], ingrid: ["played"], jun: ["played", "missed"],
  marisol: ["played", "missed"], percy: ["played"], pickle: ["allowed"], rivet: ["played", "allowed"],
  tala: ["allowed"], winston: ["played"], wisp: ["allowed"], ziggy: ["allowed"],
};

/** Double-attack takes naming two targets or two things attacked. A double check,
 * which the double-attack meaning also voices, attacks one target: the king. */
export const TWO_TARGETS: Readonly<Record<string, readonly Role[]>> = {
  button: ["allowed"], felix: ["missed"], fergus: ["played", "allowed", "missed"], jun: ["played"],
  mateo: ["played"], monty: ["played", "allowed", "missed"], pickle: ["missed"], tamar: ["allowed"],
};

/** Chance-taken takes calling the opponent's error small ("a small gift", "a little
 * gap"); after a Blunder or a Miss that is false, so only those takes sit out. */
export const SMALL_ERROR_TAKES: Readonly<Record<string, readonly string[]>> = {
  celeste: ["chance-taken"], mateo: ["chance-taken"], pickle: ["chance-taken"],
};

/** Whether this coach's recorded take for a selected meaning (or any sentence or
 * piece-named alternative of it) is false wherever it plays. */
export function alwaysFalseTake(coachId: string | null | undefined, id: string): boolean {
  const voice = coachVoice(coachId);
  return !!voice && id.split(/[|+]/).some(part => {
    if (part === "opening-departure") return SILENT_DEPARTURE_VOICES.has(voice);
    const backRank = /^tactic-back-rank-(played|allowed|missed)(-[a-z]+)?$/.exec(part)?.[1] as Role | undefined;
    return !!backRank && !!OWN_PIECES_BLOCK_ESCAPE[voice]?.includes(backRank);
  });
}
