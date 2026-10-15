import registry from "./banks/registry.json" with {type: "json"};

// Recorded takes whose words are false where their meaning can fire. Selection
// keeps them silent, so the written line (or the next clip, or the grade take)
// stands in; nothing here changes a recording. COACH_DIALOGUE.md lists each one
// under "Recorded lines that would need new takes". Keys are voice IDs (bank folders).

const voiceOf = new Map(registry.banks.map(bank => [bank.coachId, bank.voiceId]));
/** The recorded voice of a coach, or null for a coach without a bank. */
export const coachVoice = (coachId: string | null | undefined) => voiceOf.get(coachId ?? "") ?? null;

/** Takes false wherever their meaning plays, by meaning ID (sentence and piece-named
 * alternatives included). Empty since the Oct 15 re-recordings; a take found false
 * later goes here until its replacement is recorded. */
export const ALWAYS_FALSE: Readonly<Record<string, readonly string[]>> = {};

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
  return !!voice && id.split(/[|+]/).some(part => !!ALWAYS_FALSE[voice]?.includes(part));
}
