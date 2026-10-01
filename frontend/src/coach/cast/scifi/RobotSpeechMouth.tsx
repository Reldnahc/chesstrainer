import { useId } from "react";
import "./speech.css";

/** Rivet speaks through a segmented display, using the shared audio-clock controls. */
export default function RobotSpeechMouth({color}: {color: string}) {
  const aperture = useId();
  return <g className="robot-speech-mouth" data-speech-mouth="robot-display">
    <defs><clipPath id={aperture} clipPathUnits="userSpaceOnUse">
      <rect className="robot-speech-aperture" x="37" y="62" width="26" height="10" rx="1.5" />
    </clipPath></defs>
    <g className="robot-speech-closed">
      <path d="M40 66h20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="square" />
      <path className="robot-speech-pressure" d="M43 68h14" fill="none" stroke={color} strokeWidth="1" />
    </g>
    <g className="robot-speech-opening">
      <rect className="robot-speech-aperture" x="37" y="62" width="26" height="10" rx="1.5"
        fill="#142b33" stroke={color} strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      <g clipPath={`url(#${aperture})`} fill={color}>
        <g className="robot-speech-bars" opacity=".64">
          {[39, 44, 49, 54, 59].map(x => <rect key={x} x={x} y="63" width="2" height="8" rx=".3" />)}
        </g>
        <path className="robot-speech-toprow" d="M37 63h26" stroke={color} strokeWidth="1.8" />
        <rect className="robot-speech-center" x="48.5" y="63" width="3" height="8" />
        <path className="robot-speech-clamp" d="M37 67h26" stroke={color} strokeWidth="2" />
        <path d="M37 65h26m-26 4h26" stroke="#142b33" strokeWidth=".85" />
      </g>
    </g>
  </g>;
}
