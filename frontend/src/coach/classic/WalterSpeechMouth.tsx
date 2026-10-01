import { useId } from "react";
import { HumanMouth } from "../human/HumanFeatures";
import type { Pose } from "../human/poses";
import type { CoachExpression } from "../model";

// Playback owns the smoothed speech values on the avatar. This component keeps
// Walter's geometry in SVG, with no React render or new animation per syllable.
export default function WalterSpeechMouth({ pose, expression }: {
  pose: Pose;
  expression: CoachExpression;
}) {
  const apertureId = useId();
  const concerned = ["inaccuracy", "mistake", "blunder", "missed", "losing"].includes(expression);
  const thoughtful = ["thinking", "uncertain", "check"].includes(expression);
  const upperCurve = concerned ? 57.7 : thoughtful ? 58.5 : 59.5;
  const closedCurve = concerned ? 56.9 : thoughtful ? 58.7 : 61;
  const aperture = `M33 58.5 Q40 ${upperCurve} 47 58.5 C46.5 63 43.9 66 40 66 C36.1 66 33.5 63 33 58.5Z`;

  return <>
    <g className="walter-authored-mouth">
      <HumanMouth pose={pose} expression={expression} />
    </g>
    <g className="walter-speech-mouth" data-speech-mouth="walter">
      <defs>
        <clipPath id={apertureId} clipPathUnits="userSpaceOnUse">
          <path className="walter-speech-aperture" d={aperture} />
        </clipPath>
      </defs>
      <path className="walter-speech-closed" d={`M33 58.5 Q40 ${closedCurve} 47 58.5`}
        fill="none" stroke="#75473e" strokeWidth=".9" strokeLinecap="round" />
      <g className="walter-speech-opening">
        <path className="walter-speech-aperture" d={aperture} fill="#653c36" />
        <g clipPath={`url(#${apertureId})`}>
          <path className="walter-speech-teeth"
            d={`M32.5 58.2 Q40 ${upperCurve - 0.3} 47.5 58.2 L46.8 60.3 Q40 61.2 33.2 60.3Z`}
            fill="#fff3dc" />
          <path className="walter-speech-tongue" d="M35.6 65.7 Q40 62.9 44.4 65.7 L44 68H36Z"
            fill="#bd786e" />
        </g>
        <path className="walter-speech-aperture" d={aperture} fill="none"
          stroke="#75473e" strokeWidth=".65" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </g>
    </g>
  </>;
}
