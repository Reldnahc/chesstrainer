import { useId } from "react";
import type { CoachArtworkProps } from "../../model";
import { OrganicSpeechMouth } from "../../SpeechMouthLayer";
import { animalPose } from "../../studies/animalPoses";
import FantasyFace from "./FantasyFace";
import FantasyShell, { FantasyHead } from "./FantasyShell";

export default function GhostCoach({ expression }: CoachArtworkProps) {
  const pose = animalPose(expression, false);
  const cut = useId();
  const open = ["brilliant", "winning", "encouraging", "explaining"].includes(
    expression,
  );
  const worried = expression === "blunder";
  const body = worried
    ? "M24 62V45q0-23 26-23t26 23v17q17-22 19-7 1 9-15 31l5 21q-8-6-14 5-11-7-20 3-9-9-20-3-7-9-17-5l6-21Q4 64 5 55q2-15 19 7Z"
    : open
      ? "M24 65V45q0-23 26-23t26 23v20q11 4 19-5 5 17-17 27l7 20q-8-6-14 5-11-7-20 3-9-9-20-3-7-9-17-5l7-20Q0 77 5 60q8 9 19 5Z"
      : "M24 62V45q0-23 26-23t26 23v17q2 16 13 27-9 5-13-2l9 20q-8-6-14 5-11-7-20 3-9-9-20-3-7-9-17-5l10-20q-5 7-14 2 12-11 14-27Z";
  return (
    <FantasyShell
      expression={expression}
      pose={{ ...pose, tilt: pose.tilt * 0.5, lift: pose.lift * 0.6 }}
      character="ghost"
      temperament={0.55}
    >
      <ellipse cx="50" cy="121" rx="24" ry="2.8" fill="#86a8b2" opacity=".16" />
      <FantasyHead>
        <defs>
          <clipPath id={`${cut}-upper`}><rect width="100" height="92" /></clipPath>
          <clipPath id={`${cut}-lower`}><rect y="92" width="100" height="33" /></clipPath>
        </defs>
        <g clipPath={`url(#${cut}-upper)`}>
          <path
            d={body}
            fill="#d5e4df"
            fillOpacity=".93"
            stroke="#9bcbc8"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </g>
        <g className="coach-idle-hem fantasy-ghost-hem">
          <g clipPath={`url(#${cut}-lower)`}>
            <path
              d={body}
              fill="#d5e4df"
              fillOpacity=".93"
              stroke="#9bcbc8"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              className="fantasy-hem"
              d="M24 92q9 8 16 4 12 7 25 0 8 3 15-4l5 15q-8-6-14 5-11-7-20 3-9-9-20-3-7-9-17-5Z"
              fill="#9ac4c3"
              opacity=".6"
            />
          </g>
        </g>
        <path
          d="M31 39q5-11 18-11"
          stroke="#f5f6dd"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity=".9"
        />
        <g transform="translate(0 9)">
          <FantasyFace
            pose={pose}
            ink="#405267"
            iris="#8d9aae"
            mouthColor="#52647b"
            kind="watchful"
            speakingMouth={
              <OrganicSpeechMouth x={50} y={60} width={14} height={11}
                palette={{ cavity: "#405267", outline: "#52647b" }}
                teeth={false} tongue={false} />
            }
          />
        </g>
        <path
          d="M37 85q13 6 26 0"
          fill="none"
          stroke="#91b6b9"
          strokeWidth="1"
          opacity=".65"
        />
        {pose.paws === "chin" && (
          <path
            d="M74 90q-14 1-19-9-3-6 2-7 7 0 7 7"
            stroke="#9bcbc8"
            strokeWidth="1.3"
            fill="#d5e4df"
          />
        )}
        {expression === "book" && (
          <g>
            <path d="m29 87 21 3 21-3v18l-21 3-21-3Z" fill="#687c94" />
            <path d="m32 87 18 3 18-3v14l-18 3-18-3Z" fill="#e6e9d6" />
            <path
              d="M50 90v14m-14-12 9 2m10 0 9-2"
              fill="none"
              stroke="#a4b6b6"
              strokeWidth="1"
            />
          </g>
        )}
      </FantasyHead>
    </FantasyShell>
  );
}
