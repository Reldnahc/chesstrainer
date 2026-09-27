import { useId, type CSSProperties } from "react";
import type { CoachArtworkProps } from "../model";
import { familyPose, handPoses, type Gesture } from "./poses";
import "./classic.css";

export default function ClassicCoach({
  expression,
  family,
}: CoachArtworkProps) {
  const eyeClip = useId();
  const pose = familyPose(expression, family);
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
                {pose.blush && (
                  <g fill="#df9783" opacity=".3">
                    <ellipse cx="24" cy="51" rx="5" ry="2.5" />
                    <ellipse cx="56" cy="51" rx="5" ry="2.5" />
                  </g>
                )}
                <g
                  className="coach-brows"
                  fill="none"
                  stroke="#797469"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                >
                  <path className="coach-brow-left" d={pose.brows[0]} />
                  <path className="coach-brow-right" d={pose.brows[1]} />
                </g>
                <g className="coach-eyes">
                  {pose.closedEyes ? (
                    <g
                      fill="none"
                      stroke="#393c42"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    >
                      <path
                        d={
                          expression === "mistake"
                            ? "M26 42q4 3 8-1"
                            : "M26 43q4-5 8 0"
                        }
                      />
                      <path
                        d={
                          expression === "mistake"
                            ? "M46 41q4 4 8 1"
                            : "M46 43q4-5 8 0"
                        }
                      />
                    </g>
                  ) : (
                    <>
                      <ellipse
                        cx="30"
                        cy="42"
                        rx="4.2"
                        ry={pose.eye}
                        fill="#fff7e8"
                      />
                      <ellipse
                        cx="50"
                        cy="42"
                        rx="4.2"
                        ry={pose.eye}
                        fill="#fff7e8"
                      />
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
                  stroke="#c79572"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <g className="coach-mouth">
                  <path
                    d={pose.mouth}
                    fill="#75473e"
                    stroke="#75473e"
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
                    ["brilliant", "winning", "recovered"].includes(
                      expression,
                    ) && <path d="M36 65q4-3 8 0-4 3-8 0" fill="#d58c7e" />}
                </g>
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

function Arm({
  side,
  hand: [x, y, angle],
  gesture,
}: {
  side: "left" | "right";
  hand: [number, number, number];
  gesture: Gesture;
}) {
  const left = side === "left";
  const shoulder = left ? 18 : 62;
  const elbow = left ? 10 : 70;
  const fist = gesture === "fist" || gesture === "win";
  return (
    <g className={`coach-arm coach-arm-${side}`}>
      <path
        d={`M${shoulder} 78Q${elbow} 92 ${x} ${y + 5}`}
        fill="none"
        stroke="#526e66"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <g transform={`translate(${x} ${y}) rotate(${angle})`}>
        <path d="M-4 5h8v3h-8Z" fill="#a2b5a9" />
        <g
          className="coach-hand"
          fill="#f2c5a0"
          stroke="#dba47f"
          strokeWidth=".65"
          strokeLinejoin="round"
        >
          <path
            d={
              fist
                ? "M-4 3V-3q0-3 3-3h4q3 0 3 3v6q-4 4-10 0Z"
                : "M-4 4v-8q0-3 1.8-3 1 0 1 2v-2q0-2 1.5-2T2-7v1q0-2 1.5-2T5-6V0q2-4 3-2t-4 7Z"
            }
          />
          {fist && <path d="M-2-4v3m3-3v3m3-3v3" fill="none" />}
        </g>
      </g>
    </g>
  );
}
