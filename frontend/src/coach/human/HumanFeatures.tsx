import { useId } from "react";
import { useEyeClosure } from "../CoachFaceContext";
import type { CoachExpression } from "../model";
import type { Pose } from "./poses";

export default function HumanFeatures({
  pose,
  expression,
  browColor = "#797469",
  noseColor = "#c79572",
  mouthColor = "#75473e",
  glasses = true,
}: {
  pose: Pose;
  expression: CoachExpression;
  browColor?: string;
  noseColor?: string;
  mouthColor?: string;
  glasses?: boolean;
}) {
  const eyeClip = useId();
  const closedEyes = useEyeClosure(pose.closedEyes);
  return (
    <>
      {pose.blush && (
        <g fill="#df9783" opacity=".3">
          <ellipse cx="24" cy="51" rx="5" ry="2.5" />
          <ellipse cx="56" cy="51" rx="5" ry="2.5" />
        </g>
      )}
      <g
        className="coach-brows"
        fill="none"
        stroke={browColor}
        strokeWidth="2.3"
        strokeLinecap="round"
      >
        <path className="coach-brow-left" d={pose.brows[0]} />
        <path className="coach-brow-right" d={pose.brows[1]} />
      </g>
      <g className="coach-eyes" data-eye-state={closedEyes ? "closed" : "open"}>
        {closedEyes ? (
          <g
            fill="none"
            stroke="#393c42"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <path
              d={expression === "mistake" ? "M26 42q4 3 8-1" : "M26 43q4-5 8 0"}
            />
            <path
              d={expression === "mistake" ? "M46 41q4 4 8 1" : "M46 43q4-5 8 0"}
            />
          </g>
        ) : (
          <>
            <ellipse cx="30" cy="42" rx="4.2" ry={pose.eye} fill="#fff7e8" />
            <ellipse cx="50" cy="42" rx="4.2" ry={pose.eye} fill="#fff7e8" />
            <defs>
              <clipPath id={eyeClip}>
                <ellipse cx="30" cy="42" rx="4.2" ry={pose.eye} />
                <ellipse cx="50" cy="42" rx="4.2" ry={pose.eye} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${eyeClip})`}>
              <g className="coach-gaze">
                <g transform={`translate(${pose.gaze.join(" ")})`}>
                  <ellipse
                    cx="30"
                    cy="42"
                    rx="2"
                    ry={Math.min(2.5, pose.eye - 0.4)}
                    fill="#393c42"
                  />
                  <ellipse
                    cx="50"
                    cy="42"
                    rx="2"
                    ry={Math.min(2.5, pose.eye - 0.4)}
                    fill="#393c42"
                  />
                  <circle cx="29.4" cy="41.2" r=".65" fill="#fff" />
                  <circle cx="49.4" cy="41.2" r=".65" fill="#fff" />
                </g>
              </g>
            </g>
          </>
        )}
      </g>
      <path
        d="M39 43q-2 7 1 7h2"
        fill="none"
        stroke={noseColor}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g className="coach-mouth">
        <path
          d={pose.mouth}
          fill={mouthColor}
          stroke={mouthColor}
          strokeWidth=".65"
          strokeLinejoin="round"
        />
        {pose.open &&
          [
            "brilliant",
            "great",
            "winning",
            "recovered",
            "encouraging",
            "explaining",
          ].includes(expression) && (
            <path d="M34 56q6 2 12 0l-1 3H35Z" fill="#fff7e8" />
          )}
        {pose.open &&
          ["brilliant", "winning", "recovered"].includes(expression) && (
            <path d="M36 65q4-3 8 0-4 3-8 0" fill="#d58c7e" />
          )}
      </g>
      {glasses && (
        <g
          className="coach-glasses"
          fill="none"
          stroke="#393c42"
          strokeWidth="2.2"
        >
          <rect x="22" y="35" width="15" height="13" rx="4.5" />
          <rect x="43" y="35" width="15" height="13" rx="4.5" />
          <path d="M37 40q3-2 6 0M17 37l5 2m36 0 5-2" />
          <path
            className="coach-lens-glint"
            d="m25 39 3-1m19 1 3-1"
            stroke="#fff"
            strokeWidth="1.3"
            opacity=".55"
          />
        </g>
      )}
    </>
  );
}
