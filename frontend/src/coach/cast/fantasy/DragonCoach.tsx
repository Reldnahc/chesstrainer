import { useId, type CSSProperties } from "react";
import { useEyeClosure } from "../../CoachFaceContext";
import type { CoachArtworkProps } from "../../model";
import { animalPoses, type AnimalPose } from "../../studies/animalPoses";
import Book from "../../studies/Book";
import "../../studies/motion.css";
import "./fantasy.css";

function DragonArms({ pose }: { pose: AnimalPose }) {
  const left =
    pose.paws === "cheeks"
      ? [22, 65, -15]
      : pose.paws === "celebrate"
        ? [18, 70, -25]
        : pose.paws === "pair"
          ? [34, 87, 0]
          : pose.paws === "book"
            ? [27, 103, 5]
            : [27, 109, 12];
  const right =
    pose.paws === "cheeks"
      ? [78, 65, 15]
      : pose.paws === "celebrate"
        ? [82, 70, 25]
        : pose.paws === "chin"
          ? [64, 78, -20]
          : pose.paws === "offer"
            ? [79, 91, 45]
            : pose.paws === "pair"
              ? [66, 87, 0]
              : pose.paws === "book"
                ? [73, 103, -5]
                : [73, 109, -12];
  return (
    <>
      {[left, right].map(([x, y, angle], index) => (
        <g
          key={index}
          className={`study-paw study-paw-${index ? "right" : "left"}`}
        >
          <path
            d={`M${index ? 73 : 27} 96Q${index ? 84 : 16} 100 ${x} ${y + 3}`}
            fill="none"
            stroke="#2d756b"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <g transform={`translate(${x} ${y}) rotate(${angle})`}>
            <path d="M-6 7q-2-6-1-11 1-5 7-5t7 5q1 5-1 11Z" fill="#418e7c" />
            <path d="m-5-4 1-4 2 4m2-1 1-4 2 4m1 1 1-3 1 4" fill="#e4d09b" />
            <path
              d="M-3 4h6"
              stroke="#6eab8a"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        </g>
      ))}
    </>
  );
}

export default function DragonCoach({ expression }: CoachArtworkProps) {
  const pose = animalPoses[expression];
  const closedEyes = useEyeClosure(pose.closed);
  const eyeMask = useId();
  const openWings = expression === "brilliant" || expression === "winning";
  const tucked = expression === "losing" || expression === "mistake";
  const vars = {
    "--study-tilt": `${pose.tilt * 0.7}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament": 0.85,
  } as CSSProperties;
  return (
    <svg
      viewBox="0 0 100 125"
      className="coach-artwork study-artwork fantasy-artwork fantasy-dragon"
      style={vars}
      aria-hidden="true"
      focusable="false"
    >
      <g className="study-body">
        <g className="study-body-idle">
          {[false, true].map((right) => (
            <g
              key={String(right)}
              transform={right ? "translate(100 0) scale(-1 1)" : undefined}
            >
              <g
                transform={`rotate(${openWings ? 9 : tucked ? -12 : -2} 28 103)`}
              >
                <g
                  className={`fantasy-wing fantasy-wing-${right ? "right" : "left"}`}
                >
                  <g className="coach-idle-wings">
                    <path
                      d="M28 106Q7 102 5 81L4 57q18 8 28 29Z"
                      fill="#254f4e"
                    />
                    <path
                      d="M8 64q14 9 19 23l-1 14q-3-12-12-10 1-9-6-12Z"
                      fill="#b17669"
                    />
                    <path
                      d="M8 64q9 16 18 36M13 81l10 13"
                      stroke="#734e51"
                      strokeWidth="1.4"
                      fill="none"
                    />
                    <path d="m4 58 1-5 4 10" fill="#d8c693" />
                  </g>
                </g>
              </g>
            </g>
          ))}
          <path d="M22 120V99q0-25 28-27 28 2 28 27v21Z" fill="#327568" />
          <path d="M36 82q14 5 28 0l3 38H33Z" fill="#bcb578" />
          <path
            d="M36 93q14 5 28 0m-29 10q15 5 30 0m-31 10q16 5 32 0"
            fill="none"
            stroke="#8a9767"
            strokeWidth="1.5"
          />
          <g className="study-head">
            <g className="study-head-idle">
              <g className="study-head-pose">
                <path
                  d="M29 29Q16 17 22 4q3 13 15 17Zm42 0Q84 17 78 4q-3 13-15 17Z"
                  fill="#d7c58e"
                />
                <path
                  d="M29 25q-8-8-7-15m49 15q8-8 7-15"
                  stroke="#a59c73"
                  strokeWidth="1.5"
                  fill="none"
                />
                {[false, true].map((right) => (
                  <g
                    key={String(right)}
                    transform={
                      right ? "translate(100 0) scale(-1 1)" : undefined
                    }
                  >
                    <g
                      transform={`rotate(${pose.ears[right ? 1 : 0] * 0.5} 24 40)`}
                    >
                      <g
                        className={`study-ear-motion study-ear-${right ? "right" : "left"}`}
                      >
                        <path d="M28 36 11 26l2 13-4 5 15 8Z" fill="#367d70" />
                        <path d="m23 38-8-6 2 9-3 3 10 3Z" fill="#b17b6c" />
                      </g>
                    </g>
                  </g>
                ))}
                <path
                  d="M21 40q0-21 29-24 29 3 29 24l-2 23q-5 21-27 24-22-3-27-24Z"
                  fill="#438a77"
                />
                <path
                  d="m50 17-6 10 6 6 6-6Zm-9 17 9 7 9-7-9 2Z"
                  fill="#82b28b"
                />
                <path d="m24 58-5 5 7 1m50-6 5 5-7 1" fill="#2d6b60" />
                <g
                  className="study-brows"
                  stroke="#214e48"
                  strokeWidth="3.3"
                  strokeLinecap="round"
                  fill="none"
                >
                  <path d={pose.brows[0]} />
                  <path d={pose.brows[1]} />
                </g>
                <g className="animal-eyes coach-eyes" data-eye-state={closedEyes ? "closed" : "open"}>
                  <defs>
                    <clipPath id={eyeMask}>
                      {[35, 65].map((x) => (
                        <ellipse key={x} cx={x} cy="43" rx="7" ry={pose.eye} />
                      ))}
                    </clipPath>
                  </defs>
                  {closedEyes ? (
                    <path
                      d={`M28 43q7 ${pose.mouth === "concern" ? 5 : -6} 14 0m16 0q7 ${pose.mouth === "concern" ? 5 : -6} 14 0`}
                      stroke="#173f3b"
                      strokeWidth="2.2"
                      fill="none"
                      strokeLinecap="round"
                    />
                  ) : (
                    <>
                      {[35, 65].map((x) => (
                        <ellipse
                          key={x}
                          cx={x}
                          cy="43"
                          rx="7"
                          ry={pose.eye}
                          fill="#edd086"
                          stroke="#2c5b50"
                          strokeWidth=".9"
                        />
                      ))}
                      <g clipPath={`url(#${eyeMask})`}>
                        <g className="study-gaze">
                          <g transform={`translate(${pose.gaze.join(" ")})`}>
                            {[35, 65].map((x) => (
                              <g key={x}>
                                <ellipse
                                  cx={x}
                                  cy="43"
                                  rx="2.1"
                                  ry={Math.max(2.8, pose.eye - 0.6)}
                                  fill="#233e39"
                                />
                                <circle
                                  className="study-eye-glint"
                                  cx={x - 1.5}
                                  cy="41"
                                  r="1.2"
                                  fill="#fff6cf"
                                />
                              </g>
                            ))}
                          </g>
                        </g>
                      </g>
                    </>
                  )}
                </g>
                <path
                  d="M31 57q2-9 10-7h18q8-2 10 7l4 10q0 13-23 14-23-1-23-14Z"
                  fill="#88aa7d"
                />
                <path
                  d="M38 58q2-3 4-1m16 0q2-2 4 1"
                  stroke="#426853"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <g
                  className="study-muzzle"
                  stroke="#365748"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                >
                  {pose.mouth === "smile" && <path d="M34 68q16 11 32-1" />}
                  {pose.mouth === "ponder" && <path d="M39 71q10 3 21-2" />}
                  {pose.mouth === "concern" && <path d="M37 74q13-7 26 0" />}
                  {pose.mouth === "oh" && (
                    <ellipse cx="50" cy="70" rx="7" ry="7" fill="#3c5149" />
                  )}
                  {pose.mouth === "grin" && (
                    <path
                      d="M34 66q16 7 32 0-3 14-16 14T34 66Z"
                      fill="#3c5149"
                    />
                  )}
                </g>
                {(pose.mouth === "grin" || pose.mouth === "smile") && (
                  <path d="m36 69 4 6 2-4m16 0 2 4 4-6" fill="#f0e2b8" />
                )}
                <path
                  d="m29 48-3 4m45-4 3 4"
                  stroke="#79ab87"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </g>
          {pose.paws === "book" && <Book color="#976752" />}
          <DragonArms pose={pose} />
        </g>
      </g>
      {openWings && (
        <g className="study-stars" fill="#e5c582">
          <path d="m7 19 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm84 16 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" />
        </g>
      )}
    </svg>
  );
}
