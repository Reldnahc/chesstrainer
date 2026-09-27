import AnimalFace from "./AnimalFace";
import type { AnimalPose } from "./animalPoses";
import { dogPalettes, type DogLook } from "./dogLooks";

export default function DogHead({
  look,
  pose,
}: {
  look: DogLook;
  pose: AnimalPose;
}) {
  const palette = dogPalettes[look];
  const golden = look === "sunny" || look === "gentle";
  return (
    <g className="study-head">
      <g className="study-head-idle">
        <g className="study-head-pose">
          {[false, true].map((right) => (
            <g
              key={String(right)}
              transform={right ? "translate(100 0) scale(-1 1)" : undefined}
            >
              <g
                transform={`rotate(${(right ? -pose.ears[1] : pose.ears[0]) * (golden ? 0.5 : 0.7)} 25 30)`}
              >
                <g
                  className={`study-ear-motion study-ear-${right ? "right" : "left"}`}
                >
                  {golden ? (
                    <>
                      <path
                        d={
                          look === "gentle"
                            ? "M27 19Q8 21 9 48l-2 11 4-2 1 12 4-4q0 8 7 9 12-13 12-30Z"
                            : "M28 19Q12 15 9 36L6 56l5-2-1 12 5-3 1 9 5-6q1 7 5 7 10-13 8-35Z"
                        }
                        fill={palette.dark}
                      />
                      <path
                        d="M24 28q-7 10-8 27l4-3-1 11q10-8 10-29Z"
                        fill={palette.fur}
                      />
                      <path
                        d="M22 33q-5 11-4 15"
                        stroke={palette.light}
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        fill="none"
                        opacity=".65"
                      />
                    </>
                  ) : look === "corgi" ? (
                    <>
                      <path
                        d="M16 39Q2 27 7 9q2-10 11-4 14 8 18 24Z"
                        fill={palette.fur}
                      />
                      <path d="M17 31Q9 22 12 10q10 3 17 19Z" fill="#c98e7b" />
                      <path d="m17 32 5-8 4 7" fill={palette.light} />
                    </>
                  ) : (
                    <>
                      <path
                        d={
                          right
                            ? "M17 38Q10 24 16 13q5-8 14-3 8 6 6 21l-9 6Z"
                            : "M17 37Q9 20 16 4q10 0 20 25Z"
                        }
                        fill={palette.dark}
                      />
                      <path
                        d={
                          right
                            ? "M16 14q5-8 14-3l4 7-12 14q-6-9-6-18Z"
                            : "M19 29q-5-10-1-17l11 16Z"
                        }
                        fill={right ? "#525866" : "#987c83"}
                      />
                      <path d="m20 31 4-6 5 6" fill={palette.light} />
                    </>
                  )}
                </g>
              </g>
            </g>
          ))}
          <path
            d={
              golden
                ? "M22 37q0-21 28-21t28 21v15l4 9-7 2Q69 83 50 84 31 83 25 63l-7-2 4-9Z"
                : look === "corgi"
                  ? "M19 38q1-18 31-18t31 18v12l6 7-8 4Q68 80 50 82 32 80 21 61l-8-4 6-7Z"
                  : "M25 35q0-17 25-18t25 18l3 17 7 6-8 1 6 10-10-2Q64 84 50 86 36 84 27 67l-10 2 6-10-8-1 7-6Z"
            }
            fill={palette.fur}
          />
          {golden && (
            <path
              d="M30 24q6-11 17-8l2-5 6 5 6-2 8 13q-19-7-39-3Z"
              fill={palette.light}
            />
          )}
          {look === "gentle" && (
            <>
              <path
                d="M26 35q7-8 17-2m14 0q10-6 17 2"
                stroke={palette.muzzle}
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
              <path d="M50 28q-7 12-6 23h12q1-11-6-23Z" fill={palette.light} />
            </>
          )}
          {look === "corgi" && (
            <>
              <path
                d="M48 21h4l4 27q10 7 24 4-10 27-30 30-20-3-30-30 14 3 24-4Z"
                fill={palette.muzzle}
              />
              <path
                d="M27 31q7-5 13 0m20 0q7-5 13 0"
                stroke={palette.light}
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
            </>
          )}
          {look === "collie" && (
            <>
              <path
                d="M46 18q3-1 6 0l6 31 13 11-4 10Q59 84 50 86 41 84 33 70l-4-10 13-11Z"
                fill={palette.muzzle}
              />
              <path
                d="M28 32q5-8 11-5m22 0q6-3 11 5m-49 24 5 3m44 0 5-3"
                stroke={palette.light}
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
          <AnimalFace
            pose={pose}
            palette={palette}
            dog
            muzzleShape={
              look === "corgi"
                ? "M29 58q0-10 21-10t21 10Q71 78 50 79 29 78 29 58Z"
                : look === "collie"
                  ? "M35 57q0-11 15-11t15 11v9q-3 16-15 17-12-1-15-17Z"
                  : undefined
            }
          />
          {look === "gentle" && (
            <g fill="none" stroke="#687267" strokeWidth="1.5">
              <ellipse cx="36" cy="43" rx="9" ry="8" />
              <ellipse cx="64" cy="43" rx="9" ry="8" />
              <path d="M45 41q5-3 10 0m-35-2 7 2m46 0 7-2" />
            </g>
          )}
        </g>
      </g>
    </g>
  );
}
