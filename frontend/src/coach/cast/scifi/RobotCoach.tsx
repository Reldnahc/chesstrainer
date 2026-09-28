import { useId } from "react";
import type { CoachArtworkProps, CoachExpression } from "../../model";
import Accents from "../../studies/Accents";
import { CastHands } from "./CastHands";
import { castPoses, poseStyle, type CastPose } from "./poses";
import "../../studies/motion.css";
import "./scifi.css";

function RobotDisplay({ pose, expression }: { pose: CastPose; expression: CoachExpression }) {
  const alarm = expression === "blunder";
  const brilliant = expression === "brilliant";
  const color = alarm ? "#f5b493" : "#a7dfcd";
  return (
    <>
      {([35, 65] as const).map((x, index) => (
        <g key={x} transform={`translate(${x} 46)`}>
          <g className="cast-lens">
            <circle r="10" fill="#354e55" stroke="#617d7e" strokeWidth="1.2" />
            <g className="coach-eyes">
              <g className="study-gaze">
                <g transform={`translate(${pose.gaze[0] * 0.6} ${pose.gaze[1] * 0.6})`}>
                  {brilliant ? (
                    <>
                      <path d="m0-8 2.5 5.5L8 0 2.5 2.5 0 8-2.5 2.5-8 0-2.5-2.5Z" fill={color} />
                      <circle r="2" fill="#f3f0cb" className="study-eye-glint" />
                    </>
                  ) : pose.closed ? (
                    <path d="M-6 0q6-6 12 0" stroke={color} strokeWidth="2.8" strokeLinecap="round" fill="none" />
                  ) : alarm ? (
                    <>
                      <rect x="-2" y="-7" width="4" height="8" rx="1" fill={color} />
                      <circle cy="5" r="2" fill={color} />
                    </>
                  ) : (
                    <>
                      <rect x="-5.5" y={-6 * pose.eye} width="11" height={12 * pose.eye} rx="3" fill={color} transform={`rotate(${pose.brows[index] * 0.45})`} />
                      <path className="study-eye-glint" d="M-3-3h2" stroke="#fff9d9" strokeWidth="1.2" strokeLinecap="round" />
                    </>
                  )}
                </g>
              </g>
            </g>
            <path d="M-10-3v-3l3-3M10 3v3L7 9" stroke="#e2c597" strokeWidth="1.3" fill="none" />
          </g>
        </g>
      ))}
      <g stroke={color} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {pose.mouth === "round" ? (
          <rect x="45" y="63" width="10" height="9" rx="2" />
        ) : pose.mouth === "grin" ? (
          <path d="M39 62v4l4 5h14l4-5v-4M45 65h10" />
        ) : pose.mouth === "concern" ? (
          <path d="M41 69v-3l3-3h12l3 3v3" />
        ) : pose.mouth === "wince" ? (
          <path d="m41 67 4-3 5 4 5-4 4 3" />
        ) : pose.mouth === "flat" ? (
          <path d="M41 67h18" />
        ) : (
          <path d="m41 65 3 4h12l3-4" />
        )}
      </g>
    </>
  );
}

export default function RobotCoach({ expression }: CoachArtworkProps) {
  const original = castPoses[expression];
  const pose = {
    ...original,
    hands: expression === "brilliant" ? "resolve" as const : original.hands,
  };
  const screen = useId();
  const status = expression === "blunder" || expression === "mistake" ? "#e9a385" : "#a4d9c3";
  return (
    <svg
      viewBox="0 0 100 125"
      className="coach-artwork study-artwork cast-scifi cast-robot"
      style={poseStyle(pose, 0.45)}
      aria-hidden="true"
      focusable="false"
    >
      <Accents expression={expression} />
      <g className="study-body">
        <g className="study-body-idle">
          <path d="M38 74h24v17H38Z" fill="#586a70" />
          <path d="M39 78h22m-22 5h22" stroke="#8fa2a5" strokeWidth="2" />
          <rect x="24" y="86" width="52" height="34" rx="12" fill="#b9bbae" />
          <path d="M29 91v20q0 5 6 5h31" stroke="#e2dbc5" strokeWidth="2" fill="none" />
          <rect x="38" y="96" width="25" height="16" rx="4" fill="#4b6369" />
          <circle cx="44" cy="104" r="3" fill={status} />
          <path d="M52 101h6m-6 5h4" stroke="#c5d6c2" strokeWidth="1.5" strokeLinecap="round" />
          <g className="study-head">
            <g className="study-head-idle">
              <g className="study-head-pose">
                <g className="cast-antenna">
                  <path d="M50 21V12l7-5" fill="none" stroke="#849da1" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="59" cy="6" r="4" fill={status} />
                  <circle cx="58" cy="5" r="1.2" fill="#e9f1d6" />
                </g>
                <rect x="9" y="39" width="11" height="21" rx="4" fill="#7d8e8e" />
                <rect x="80" y="39" width="11" height="21" rx="4" fill="#7d8e8e" />
                <path d="M12 43v13m76-13v13" stroke="#b8c4b7" strokeWidth="2" strokeLinecap="round" />
                <rect x="17" y="20" width="66" height="60" rx="18" fill="#c9c7b4" />
                <path d="M23 38V34q0-9 12-9h29" fill="none" stroke="#ece2cc" strokeWidth="2.5" strokeLinecap="round" />
                <rect x="22" y="29" width="56" height="46" rx="12" fill="#243840" />
                <RobotDisplay pose={pose} expression={expression} />
                <defs><clipPath id={screen}><rect x="22" y="29" width="56" height="46" rx="12" /></clipPath></defs>
                <g clipPath={`url(#${screen})`}>
                  <g className="cast-scanline">
                    <path d="M24 39h52" stroke="#d4efce" strokeWidth="1.5" />
                    <path d="M24 37h52" stroke="#d4efce" strokeWidth="4" opacity=".1" />
                  </g>
                </g>
                <circle cx="28" cy="24" r="1" fill="#788c8c" />
                <circle cx="72" cy="24" r="1" fill="#788c8c" />
              </g>
            </g>
          </g>
          {pose.hands === "book" && (
            <g>
              <rect x="28" y="91" width="44" height="24" rx="3" fill="#334b56" stroke="#8eabad" strokeWidth="2" />
              <path d="M34 97h16m-16 5h30m-30 5h23" stroke="#a8d8c7" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
          <CastHands pose={pose.hands} skin="#c9c7b4" sleeve="#758b8b" joint="#d9c598" />
        </g>
      </g>
    </svg>
  );
}
