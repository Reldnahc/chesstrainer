import { useId } from "react";
import type { CoachExpression } from "../model";
import "./aligned-speech.css";

// One articulated aperture serves every aligned speech shape. The clock owner
// blends numeric controls; teeth remain fixed-size behind the same moving clip.
// Walter's expression still owns his lip corners, eyes, brows and acting.
export default function WalterAlignedMouth({ expression }: { expression: CoachExpression }) {
  const apertureId = useId();
  const concerned = ["inaccuracy", "mistake", "blunder", "missed", "losing"].includes(expression);
  const thoughtful = ["thinking", "uncertain", "check"].includes(expression);
  const upperCurve = concerned ? 57.7 : thoughtful ? 58.5 : 59.5;
  const closedCurve = concerned ? 56.9 : thoughtful ? 58.7 : 61;
  const aperture = `M33 58.5 Q40 ${upperCurve} 47 58.5 C47.4 63.2 44 66.5 40 66.5 C36 66.5 32.6 63.2 33 58.5Z`;

  return <g className="walter-aligned-mouth" data-speech-mouth="walter-aligned">
    <defs>
      <clipPath id={apertureId} clipPathUnits="userSpaceOnUse">
        <path className="walter-aligned-aperture" d={aperture} />
      </clipPath>
    </defs>
    <g className="walter-aligned-closed">
      <path className="walter-aligned-lip-line" d={`M33 58.5 Q40 ${closedCurve} 47 58.5`}
        fill="none" stroke="#75473e" strokeLinecap="round" />
      <path className="walter-aligned-pressure" d={`M35.5 60.3 Q40 ${closedCurve + 1} 44.5 60.3`}
        fill="none" stroke="#ae7869" strokeWidth=".65" strokeLinecap="round" />
    </g>
    <g className="walter-aligned-opening">
      <path className="walter-aligned-aperture" d={aperture} fill="#653c36" />
      <g clipPath={`url(#${apertureId})`}>
        <path className="walter-aligned-tongue-floor"
          d="M35.4 66.1 Q40 63.4 44.6 66.1 L44.3 68H35.7Z" fill="#b57469" />
        <path className="walter-aligned-tongue-tip"
          d="M37 65Q36.6 61.5 37.6 60.4Q40 58.5 42.4 60.4Q43.4 61.5 43 65Z"
          fill="#ce9182" />
        <path className="walter-aligned-teeth"
          d={`M32.5 58.2 Q40 ${upperCurve - 0.3} 47.5 58.2 L46.8 60.1 Q40 60.8 33.2 60.1Z`}
          fill="#fff3dc" />
        <path className="walter-aligned-lip-bite"
          d="M32 61.9Q34.9 59.2 38 59.9Q40 60.5 42 59.9Q45.1 59.2 48 61.9V65H32Z"
          fill="#ba8173" stroke="#8b564b" strokeWidth=".45" />
      </g>
      <path className="walter-aligned-aperture" d={aperture} fill="none"
        stroke="#75473e" strokeWidth=".65" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </g>
  </g>;
}
