import { useId, type ReactNode } from "react";
import { useEyeClosure } from "../../CoachFaceContext";
import type { AnimalPose } from "../../studies/animalPoses";

// A muzzle-free face keeps the same expression vocabulary as the existing rigs,
// while each creature owns its silhouette, proportions, and physical gestures.
export default function FantasyFace({
  pose,
  ink,
  iris,
  mouthColor = ink,
  kind = "soft",
  muzzle,
}: {
  pose: AnimalPose;
  ink: string;
  iris: string;
  mouthColor?: string;
  kind?: "soft" | "watchful" | "bright";
  muzzle?: ReactNode;
}) {
  const clip = useId();
  const closedEyes = useEyeClosure(pose.closed);
  const eyeWidth = kind === "watchful" ? 4.7 : kind === "bright" ? 6 : 5.3;
  return (
    <>
      <g
        className="study-brows"
        stroke={ink}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      >
        <path d={pose.brows[0]} />
        <path d={pose.brows[1]} />
      </g>
      <g className="animal-eyes" data-eye-state={closedEyes ? "closed" : "open"}>
        {closedEyes ? (
          <g stroke={ink} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d={`M30 43q5 ${pose.mouth === "concern" ? 5 : -6} 10 0`} />
            <path d={`M60 43q5 ${pose.mouth === "concern" ? 5 : -6} 10 0`} />
          </g>
        ) : (
          <>
            <defs>
              <clipPath id={clip}>
                {[35, 65].map((x) => (
                  <ellipse key={x} cx={x} cy="43" rx={eyeWidth} ry={pose.eye} />
                ))}
              </clipPath>
            </defs>
            {[35, 65].map((x) => (
              <ellipse
                key={x}
                cx={x}
                cy="43"
                rx={eyeWidth}
                ry={pose.eye}
                fill="#fff9e9"
              />
            ))}
            <g clipPath={`url(#${clip})`}>
              <g className="study-gaze">
                <g transform={`translate(${pose.gaze.join(" ")})`}>
                  {[35, 65].map((x) => (
                    <g key={x}>
                      <ellipse
                        cx={x}
                        cy="43"
                        rx={eyeWidth - 1}
                        ry={pose.eye}
                        fill={iris}
                      />
                      <ellipse
                        cx={x}
                        cy="43"
                        rx={kind === "watchful" ? 2 : 2.5}
                        ry={Math.max(2.7, pose.eye - 0.7)}
                        fill={ink}
                      />
                      <circle
                        className="study-eye-glint"
                        cx={x - 1.1}
                        cy="41.5"
                        r="1.25"
                        fill="#fffdf5"
                      />
                    </g>
                  ))}
                </g>
              </g>
            </g>
          </>
        )}
      </g>
      {muzzle}
      <g
        className="fantasy-mouth"
        stroke={mouthColor}
        fill="none"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pose.mouth === "smile" && <path d="M43 60q7 7 14 0" />}
        {pose.mouth === "ponder" && <path d="M45 62q5 1 10-2" />}
        {pose.mouth === "concern" && <path d="M43 65q7-6 14 0" />}
        {pose.mouth === "oh" && (
          <ellipse cx="50" cy="63" rx="4.3" ry="6" fill={mouthColor} />
        )}
        {pose.mouth === "grin" && (
          <>
            <path d="M40 58q10 5 20 0-1 13-10 13T40 58Z" fill={mouthColor} />
            <path d="M43 60q7 2 14 0l-1 3H44Z" fill="#fff5dc" stroke="none" />
            <path d="M45 68q5-4 10 0-5 4-10 0" fill="#df9a91" stroke="none" />
          </>
        )}
      </g>
    </>
  );
}
