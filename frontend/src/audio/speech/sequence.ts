/** Silence between two recorded sentences that play as one coach line. */
export const SEQUENCE_GAP_SECONDS = 0.25;
export const SEQUENCE_SEPARATOR = '+';
/** Existing whole recordings spoken back to back as one playback. */
export const sequenceRecordingId = (ids: readonly string[]) => ids.join(SEQUENCE_SEPARATOR);
