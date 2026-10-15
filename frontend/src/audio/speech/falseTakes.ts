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

/** Recovery takes that credit this move or the learner with restoring the game
 * (a move never raises its own evaluation; the opponent's moves did), assisted
 * takes that also call the other side's Mistakes small, and Wisp's repeated-issue
 * take, whose "earlier moments" assumes more than one. Their rewrites are in each
 * bank's revisions/false-takes-v1.json; remove a voice here once it is re-recorded. */
export const AWAITING_RERECORDING: Readonly<Record<string, readonly string[]>> = {
  alfie: ["recovery"], arjun: ["recovery"], bandit: ["recovery"], biscuit: ["recovery", "recovery-assisted"],
  button: ["recovery", "recovery-assisted"], celeste: ["recovery"], ember: ["recovery"], felix: ["recovery"],
  ingrid: ["recovery"], jun: ["recovery"], mateo: ["recovery", "recovery-assisted"], monty: ["recovery"],
  orin: ["recovery"], percy: ["recovery"], pickle: ["recovery"], reka: ["recovery-assisted"],
  tala: ["recovery", "recovery-assisted"], tamar: ["recovery"], waffles: ["recovery"],
  walter: ["recovery", "recovery-assisted"], winston: ["recovery"], wisp: ["recovery", "repeated-issue"],
  ziggy: ["recovery", "recovery-assisted"],
};

/** Book takes saying the opening has a name. Our catalogue has no name for some
 * positions, and there they sit out (gameSelection.ts). */
export const NAMED_OPENING_TAKES: Readonly<Record<string, readonly string[]>> = {
  felix: ["book-opening-follow-8"], pip: ["book-opening-entry-2"], reka: ["book-opening-entry-2", "book-opening-entry-3"],
  tala: ["book-opening-entry-2", "book-opening-entry-3"], tamar: ["book-opening-entry-1", "book-opening-entry-3"],
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
    if (AWAITING_RERECORDING[voice]?.includes(part)) return true;
    if (part === "opening-departure") return SILENT_DEPARTURE_VOICES.has(voice);
    const backRank = /^tactic-back-rank-(played|allowed|missed)(-[a-z]+)?$/.exec(part)?.[1] as Role | undefined;
    return !!backRank && !!OWN_PIECES_BLOCK_ESCAPE[voice]?.includes(backRank);
  });
}
