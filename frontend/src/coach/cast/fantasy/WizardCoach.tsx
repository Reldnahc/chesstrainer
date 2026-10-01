import { useId, type CSSProperties } from "react";
import { ArtworkSvg, BodyRig, HeadRig } from "../../ArtworkRig";
import { useEyeClosure } from "../../CoachFaceContext";
import type { CoachArtworkProps } from "../../model";
import { OrganicSpeechMouth, SpeechMouthLayer } from "../../SpeechMouthLayer";
import { animalPoses, type AnimalPose } from "../../studies/animalPoses";
import Book from "../../studies/Book";
import "../../studies/motion.css";
import "./fantasy.css";

function ScholarHands({ pose }: { pose: AnimalPose }) {
  const left =
    pose.paws === "cheeks"
      ? [22, 73, -20]
      : pose.paws === "celebrate"
        ? [18, 75, -35]
        : pose.paws === "pair"
          ? [34, 92, -18]
          : pose.paws === "book"
            ? [27, 104, 0]
            : [26, 109, 8];
  const right =
    pose.paws === "cheeks"
      ? [78, 73, 20]
      : pose.paws === "chin"
        ? [61, 85, -20]
        : pose.paws === "celebrate"
          ? [82, 75, 35]
          : pose.paws === "pair"
            ? [66, 92, 18]
            : pose.paws === "offer"
              ? [78, 96, 50]
              : pose.paws === "book"
                ? [73, 104, 0]
                : [74, 109, -8];
  return (
    <>
      {[left, right].map(([x, y, angle], index) => (
        <g
          key={index}
          className={`study-paw study-paw-${index ? "right" : "left"}`}
        >
          <g className={`coach-idle-${index ? "rightArm" : "leftArm"}`}>
            <path
              d={`M${index ? 77 : 23} 107Q${index ? 86 : 14} 104 ${x} ${y + 4}`}
              stroke="#555384"
              strokeWidth="13"
              fill="none"
              strokeLinecap="round"
            />
            {/* The thumb is authored for screen-right; keep placement outside the reflection. */}
            <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${index ? 1 : -1} 1)`}>
              <path d="M-6 7h12v6H-6Z" fill="#c3a566" />
              <path
                d="M-5 7q-4-4-3-8 1-3 4-1v-4q0-4 4-4 6 0 7 6L6 7Z"
                fill="#dba786"
                stroke="#ad775d"
                strokeWidth=".8"
                strokeLinejoin="round"
              />
              <path d="M-4 1q3 0 4 3" fill="none" stroke="#b57f64" />
            </g>
          </g>
        </g>
      ))}
    </>
  );
}

export default function WizardCoach({ expression }: CoachArtworkProps) {
  const pose = animalPoses[expression];
  const closedEyes = useEyeClosure(pose.closed);
  const eyeMask = useId();
  const vars = {
    "--study-tilt": `${pose.tilt * 0.65}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament": 0.7,
  } as CSSProperties;
  return (
    <ArtworkSvg
      viewBox="0 0 100 125"
      className="coach-artwork study-artwork fantasy-artwork fantasy-wizard"
      style={vars}
    >
      {(expression === "brilliant" || expression === "winning") && (
        <g className="study-stars" fill="#eed596">
          <path d="m10 45 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm78-31 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" />
          <circle cx="87" cy="54" r="1.5" />
        </g>
      )}
      <BodyRig>
        <path
          d="M15 121q2-24 10-32 9-10 25-10t25 10q8 8 10 32Z"
          fill="#414464"
        />
        <path d="M31 85 50 101 69 85l-8 36H39Z" fill="#686698" />
        <path d="m31 88 9 31m29-31-9 31" stroke="#c3a566" strokeWidth="2" />
        <path d="M49 107h2v10h-2Z" fill="#d6bd80" />
        <circle
          cx="50"
          cy="109"
          r="3"
          fill="#80bab6"
          stroke="#ddc894"
          strokeWidth="1.5"
        />
        <HeadRig>
          <path
            d="M25 45q-9 17-2 36l9 5 5-32Zm50 0q9 17 2 36l-9 5-5-32Z"
            fill="#bbbcc5"
          />
          <ellipse cx="24" cy="63" rx="5" ry="8" fill="#c58f72" />
          <ellipse cx="76" cy="63" rx="5" ry="8" fill="#c58f72" />
          <path
            d="M26 46q0-20 24-20t24 20v24q-3 22-24 23-21-1-24-23Z"
            fill="#dfb394"
          />
          <g className="coach-idle-hem fantasy-beard">
            <path
              d="M29 67q6 5 7 12l14 5 14-5q1-7 7-12l3 11-6 13-8 2-10 15-10-15-8-2-6-13Z"
              fill="#e6e3d9"
            />
            <path
              d="m32 83 9 9m27-9-9 9m-9-4v12"
              stroke="#bdbec5"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
          <g transform="translate(0 14)">
            <g
              className="study-brows"
              stroke="#efeee5"
              strokeWidth="4"
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
                    <ellipse
                      key={x}
                      cx={x}
                      cy="43"
                      rx="6"
                      ry={pose.eye * 0.75}
                    />
                  ))}
                </clipPath>
              </defs>
              {closedEyes ? (
                <g
                  stroke="#59493e"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                >
                  <path
                    d={`M30 43q5 ${pose.mouth === "concern" ? 4 : -4} 10 0m20 0q5 ${pose.mouth === "concern" ? 4 : -4} 10 0`}
                  />
                </g>
              ) : (
                <>
                  {[35, 65].map((x) => (
                    <ellipse
                      key={x}
                      cx={x}
                      cy="43"
                      rx="6"
                      ry={pose.eye * 0.75}
                      fill="#fff7e6"
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
                              rx="2.6"
                              ry={Math.min(3.3, pose.eye * 0.7)}
                              fill="#496661"
                            />
                            <circle
                              cx={x}
                              cy="43"
                              r="1.4"
                              fill="#2a3537"
                            />
                            <circle
                              className="study-eye-glint"
                              cx={x - 0.8}
                              cy="41.7"
                              r=".9"
                              fill="#fff"
                            />
                          </g>
                        ))}
                      </g>
                    </g>
                  </g>
                </>
              )}
            </g>
            <g
              className="coach-glasses"
              fill="none"
              stroke="#9d7b43"
              strokeWidth="1.5"
            >
              <path d="M27 46h17q0 8-8.5 8T27 46Zm29 0h17q0 8-8.5 8T56 46Zm-12 1q6-4 12 0m-29-1-4-1m50 1 4-1" />
            </g>
          </g>
          <path d="M47 58q-1 8-4 11 6 5 13 0-4-4-4-11" fill="#d7a07f" />
          <g
            className="study-muzzle"
            stroke="#8f6758"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          >
            <SpeechMouthLayer authored={
              <>
                {pose.mouth === "oh" && (
                  <ellipse cx="50" cy="78" rx="4" ry="5.2" fill="#694c48" />
                )}
                {pose.mouth === "grin" && (
                  <path d="M41 75q9 4 18 0-2 10-9 10t-9-10Z" fill="#694c48" />
                )}
                {pose.mouth === "smile" && <path d="M43 77q7 6 14 0" />}
                {pose.mouth === "concern" && <path d="M44 80q6-4 12 0" />}
                {pose.mouth === "ponder" && <path d="M45 78q4 1 9-1" />}
              </>
            }>
              <OrganicSpeechMouth x={50} y={77} width={14} height={8}
                palette={{ cavity: "#694c48", outline: "#8f6758", teeth: "#fff5dc", tongue: "#bd786e", lip: "#dfb394" }} />
            </SpeechMouthLayer>
          </g>
          <path
            d="M50 70q-11-6-16 5 10 3 16-3 6 6 16 3-5-11-16-5Z"
            fill="#f2eee3"
          />
          <g className="study-hair-motion">
            <path
              d="M23 43 43 8q7-8 20-4-6 6-2 16l16 24Z"
              fill="#555484"
            />
            <path
              d="M43 9q-1 13-9 28h29L57 20q-2-8 1-13Z"
              fill="#68689c"
            />
            <path d="M23 38q28-7 53 1l3 9q-27-7-58 0Z" fill="#b39559" />
            <path
              d="M15 47q1-7 34-8 35 0 37 9-25 8-52 3-11-1-19-4Z"
              fill="#414362"
            />
            <path
              d="M53 17a7 7 0 1 0 5 11 7 7 0 0 1-5-11"
              fill="#ebd28e"
            />
            <path
              d="m38 31 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z"
              fill="#dac484"
            />
          </g>
        </HeadRig>
        {pose.paws === "book" && <Book color="#76645c" />}
        <ScholarHands pose={pose} />
      </BodyRig>
    </ArtworkSvg>
  );
}
