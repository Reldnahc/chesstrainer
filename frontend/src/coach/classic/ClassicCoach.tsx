import type { CSSProperties } from "react";
import type { CoachArtworkProps } from "../model";
import { poses, handPoses } from "../human/poses";
import Arm from "../human/Arm";
import HumanFeatures from "../human/HumanFeatures";
import "./classic.css";

export default function ClassicCoach({ expression }: CoachArtworkProps) {
  const pose = poses[expression];
  const hands = handPoses[pose.gesture];
  const vars = {
    "--pose-tilt": `${pose.tilt}deg`,
    "--pose-lift": `${pose.lift}px`,
  } as CSSProperties;
  return (
    <svg
      viewBox="-6 -8 92 115"
      className="coach-artwork"
      aria-hidden="true"
      focusable="false"
      style={vars}
    >
      <g
        className="coach-accents"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pose.accent === "stars" && (
          <g
            className="coach-stars"
            fill="#f3d59b"
            stroke="#f3d59b"
            strokeWidth=".7"
          >
            <path d="m9 22 1.8 4.8L16 29l-5.2 1.6L9 36l-1.7-5.4L2 29l5.3-2.2Z" />
            <path d="m69 9 1.4 4.2L75 15l-4.6 1.5L69 21l-1.5-4.5L63 15l4.5-1.8Z" />
            <path d="m74 43 1 2.8 3 1.2-3 1-1 3-1-3-3-1 3-1.2Z" />
          </g>
        )}
        {pose.accent === "rays" && (
          <g className="coach-rays" stroke="#dfac96" strokeWidth="2.2">
            <path d="M7 18 3 14M9 10 8 5M73 27l5-2" />
          </g>
        )}
        {pose.accent === "question" && (
          <g className="coach-question" stroke="#bdcac4" strokeWidth="2">
            <path d="M70 22q0-5 4-4t-1 7v2" />
            <circle cx="73" cy="31" r=".8" fill="#bdcac4" stroke="none" />
          </g>
        )}
        {pose.accent === "check" && (
          <path
            className="coach-check-accent"
            d="m9 36-5 5 5 5"
            stroke="#bdcac4"
            strokeWidth="2"
          />
        )}
      </g>
      <g className="coach-body-motion">
        <g className="coach-body-idle">
          <path d="M9 103V83Q10 66 29 66H51Q70 66 71 83V103Z" fill="#5d7770" />
          <path d="M40 83v20" stroke="#526b65" strokeWidth="1.2" />
          <path d="m29 68 11 15 11-15-3-10H32Z" fill="#eab18a" />
          <path
            d="m27 69 13 14-9 10-10-20m32-4L40 83l9 10 10-20"
            fill="#91aa9d"
          />
          <path
            d="m29 73 11 10 11-10"
            fill="none"
            stroke="#b3c4b7"
            strokeWidth=".8"
          />
          <g className="coach-head-motion">
            <g className="coach-head-idle">
              <g className="coach-head-pose">
                <ellipse cx="17" cy="43" rx="4" ry="7" fill="#eab18a" />
                <ellipse cx="63" cy="43" rx="4" ry="7" fill="#eab18a" />
                <ellipse cx="40" cy="39" rx="24" ry="29" fill="#f2c5a0" />
                <path
                  d="M16 37Q8 5 35 6Q67 0 65 39L57 29Q43 33 29 19L22 38Z"
                  fill="#dad4ca"
                />
                <path
                  d="M21 17Q27 8 38 10M47 10q10 0 14 10"
                  fill="none"
                  stroke="#f1ece2"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M20 52Q30 60 40 57Q50 60 60 52Q55 76 40 75Q25 74 20 52Z"
                  fill="#dad4ca"
                />
                <path
                  d="M31 70q9 6 19-1"
                  fill="none"
                  stroke="#c5c2ba"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
                <HumanFeatures pose={pose} expression={expression} />
              </g>
            </g>
          </g>
          <Arm side="left" hand={hands.left} gesture={pose.gesture} />
          <Arm side="right" hand={hands.right} gesture={pose.gesture} />
          {pose.gesture === "book" && (
            <g className="coach-book">
              <path
                d="M23 78q10-2 17 3 7-5 17-3v18q-10-2-17 2-7-4-17-2Z"
                fill="#b99b6a"
                stroke="#7f7055"
                strokeWidth="1"
              />
              <path
                d="M26 77q8 0 14 4 6-4 14-4v16q-8 0-14 4-6-4-14-4Z"
                fill="#eadbc0"
              />
              <path
                d="M40 82v14M29 83l7 2m-7 3 7 2m8-5 7-2m-7 7 7-2"
                stroke="#b8a68c"
                strokeWidth="1"
              />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
