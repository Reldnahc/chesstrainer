import type { CoachArtworkProps } from "../../model";
import { animalPose } from "../../studies/animalPoses";
import FantasyFace from "./FantasyFace";
import FantasyShell, { FantasyHead } from "./FantasyShell";

export default function SlimeCoach({ expression }: CoachArtworkProps) {
  const pose = animalPose(expression, false);
  const startled = expression === "blunder";
  const delighted = expression === "brilliant" || expression === "winning";
  const subdued = expression === "losing" || expression === "mistake";
  const body = startled
    ? "M16 106q-5-17 9-29V56q0-29 25-29t25 29v21q14 12 9 29-3 10-17 8-17 8-34 0-14 2-17-8Z"
    : delighted
      ? "M10 99q-8-15 1-22 6-4 13 3 1-43 26-43t26 43q7-7 13-3 9 7 1 22-1 17-19 16-21 7-42 0-19 1-19-16Z"
      : subdued
        ? "M9 104q0-13 13-21 2-34 28-34t28 34q13 8 13 21-1 14-20 12-21 5-42 0-19 2-20-12Z"
        : "M12 103q-1-12 12-22 0-44 26-44t26 44q13 10 12 22-1 14-18 12-20 7-40 0-17 2-18-12Z";
  return (
    <FantasyShell
      expression={expression}
      pose={{ ...pose, tilt: pose.tilt * 0.55 }}
      character="slime"
      temperament={1.05}
    >
      <ellipse cx="50" cy="117" rx="32" ry="4" fill="#385249" opacity=".3" />
      <FantasyHead>
        <path d={body} fill="#76cba6" stroke="#469781" strokeWidth="1.7" />
        <path
          className="coach-idle-hem fantasy-slime-rim"
          d="M21 99q-1 9 13 10 16 7 34 0 12 1 13-7-7 5-17 3-14 6-29 0-10 1-14-6Z"
          fill="#54ae92"
        />
        <path
          d={
            startled
              ? "M35 42q6-9 16-8"
              : subdued
                ? "M35 63q6-9 16-8"
                : "M35 51q6-9 16-8"
          }
          stroke="#d5f5c4"
          strokeWidth="5.5"
          strokeLinecap="round"
          fill="none"
          opacity=".8"
        />
        <ellipse cx="27" cy="91" rx="5" ry="3" fill="#b7edc4" opacity=".5" />
        <g transform={`translate(0 ${subdued ? 27 : startled ? 14 : 20})`}>
          <FantasyFace pose={pose} ink="#244c42" iris="#426857" kind="bright" />
          <g fill="#e5bfa0" opacity=".65">
            <ellipse cx="26" cy="54" rx="4" ry="2.4" />
            <ellipse cx="74" cy="54" rx="4" ry="2.4" />
          </g>
        </g>
        {pose.paws === "chin" && (
          <path
            d="M74 102q-15 3-20-5-4-7 2-10 6-3 9 8"
            fill="#88d4b2"
            stroke="#469781"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
        {pose.paws === "offer" && (
          <path
            className="study-paw-right"
            d="M76 101q14-1 13-14 0-6-5-5-4 1-3 7"
            fill="#88d4b2"
            stroke="#469781"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
        {expression === "book" && (
          <g transform="translate(0 2)">
            <path d="m28 95 22 3 22-3v16l-22 3-22-3Z" fill="#4e8172" />
            <path d="m31 95 19 3 19-3v13l-19 3-19-3Z" fill="#e7e3b5" />
            <path d="M50 99v12" stroke="#a4b49a" />
          </g>
        )}
      </FantasyHead>
    </FantasyShell>
  );
}
