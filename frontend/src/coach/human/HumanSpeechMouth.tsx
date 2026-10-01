import { OrganicSpeechMouth, SpeechMouthLayer } from "../SpeechMouthLayer";
import type { CoachExpression } from "../model";
import { HumanMouth } from "./HumanFeatures";
import type { Pose } from "./poses";
import "./speech.css";

/** Lip, interior and tongue tones that keep a speaking mouth in one coach's palette. */
export type HumanSpeechPalette = {
  cavity: string;
  lip: string;
  tongue: string;
  teeth?: string;
};

// Walter's aligned aperture sits at the shared human face coordinates: a 14-unit
// mouth with its upper lip on y=58.5 and its jaw at y=66.5. Every other human face
// uses the same HumanFeatures geometry, so the same placement keeps their speech
// in step with his while the colors stay the character's own. The mouth slot
// restores the exact authored HumanMouth whenever playback is silent or Still.
export const humanSpeechPlacement = { x: 40, y: 58.5, width: 14, height: 8 } as const;

const concerned: readonly CoachExpression[] = ["inaccuracy", "mistake", "blunder", "missed", "losing"];
const thoughtful: readonly CoachExpression[] = ["thinking", "uncertain", "check"];

export function humanSpeechMood(expression: CoachExpression) {
  return concerned.includes(expression) ? "concern" : thoughtful.includes(expression) ? "neutral" : "smile";
}

export default function HumanSpeechMouth({ pose, expression, mouthColor, palette }: {
  pose: Pose;
  expression: CoachExpression;
  mouthColor: string;
  palette: HumanSpeechPalette;
}) {
  return (
    <SpeechMouthLayer className="human-speech-mouth"
      authored={<HumanMouth pose={pose} expression={expression} mouthColor={mouthColor} />}>
      <OrganicSpeechMouth {...humanSpeechPlacement} mood={humanSpeechMood(expression)}
        palette={{
          cavity: palette.cavity,
          outline: mouthColor,
          lip: palette.lip,
          tongue: palette.tongue,
          teeth: palette.teeth ?? "#fff3dc",
        }} />
    </SpeechMouthLayer>
  );
}
