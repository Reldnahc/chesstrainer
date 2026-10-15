/** Silence between two recorded sentences that play as one coach line. */
export const SEQUENCE_GAP_SECONDS = 0.25;
export const SEQUENCE_SEPARATOR = '+';
/** Existing whole recordings spoken back to back as one playback. */
export const sequenceRecordingId = (ids: readonly string[]) => ids.join(SEQUENCE_SEPARATOR);
/** Alternatives for one sentence, best first; a coach plays the first it has recorded. */
export const ALTERNATIVE_SEPARATOR = '|';

/** Resolves "a|b+c" to one concrete id per sentence: for each sentence, the first
 * alternative the first test accepts, else the first the next test accepts.
 * Null when any sentence has no accepted alternative. Every alternative-aware
 * lookup (playback, bubble text, mouth timing) resolves through this one rule. */
export function resolveSentences(id: string, ...accepts: readonly ((id: string) => boolean)[]): string[] | null {
  const parts = id.split(SEQUENCE_SEPARATOR).map(part => {
    const alternatives = part.split(ALTERNATIVE_SEPARATOR);
    for (const accept of accepts) {
      const found = alternatives.find(accept);
      if (found) return found;
    }
    return undefined;
  });
  return parts.every((part): part is string => !!part) ? parts : null;
}
