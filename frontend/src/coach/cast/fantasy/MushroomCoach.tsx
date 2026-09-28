import type { CoachArtworkProps } from "../../model";
import { animalPose, type AnimalPose } from "../../studies/animalPoses";
import FantasyFace from "./FantasyFace";
import FantasyShell, { FantasyHead } from "./FantasyShell";

function Fronds({ pose }: { pose: AnimalPose }) {
  const high =
    pose.paws === "cheeks" || pose.paws === "celebrate" || pose.paws === "pair";
  const offer = pose.paws === "offer";
  const chin = pose.paws === "chin";
  return (
    <g stroke="#737c50" strokeWidth="2.5" strokeLinecap="round" fill="none">
      <g className="fantasy-frond-left">
        <path d={high ? "M31 94Q12 98 17 77" : "M31 94Q19 108 14 96"} />
        <path
          d={high ? "M17 80q-10-8-9 3 6 4 9-3Z" : "M15 99q-9-2-7 6 8 1 7-6Z"}
          fill="#8b9b60"
          stroke="none"
        />
      </g>
      <g className="study-paw-right fantasy-frond-right">
        <path
          d={
            high
              ? "M69 94q19 4 14-17"
              : chin
                ? "M69 94q2-10-12-7"
                : offer
                  ? "M69 94q17 9 17-9"
                  : "M69 94q12 14 17 2"
          }
        />
        <path
          d={
            high
              ? "M83 80q10-8 9 3-6 4-9-3Z"
              : chin
                ? "M60 88q-8 3-8-4 6-4 8 4Z"
                : offer
                  ? "M86 88q8-9 9-1-3 7-9 1Z"
                  : "M85 99q9-2 7 6-8 1-7-6Z"
          }
          fill="#8b9b60"
          stroke="none"
        />
      </g>
    </g>
  );
}

export default function MushroomCoach({ expression }: CoachArtworkProps) {
  const pose = animalPose(expression, false);
  return (
    <FantasyShell
      expression={expression}
      pose={{ ...pose, tilt: pose.tilt * 0.6, lift: pose.lift * 0.7 }}
      character="mushroom"
      temperament={0.65}
    >
      <ellipse cx="50" cy="119" rx="31" ry="3.5" fill="#777e4f" opacity=".25" />
      <path
        d="M26 117q-9-11-14-5 5 3 8 9h12m43-4q9-11 13-5-6 4-8 9H68"
        fill="#71864f"
      />
      <FantasyHead>
        <path
          d="M31 43h38q-3 28 5 59 4 18-24 18t-24-18q8-31 5-59Z"
          fill="#e0cf9f"
          stroke="#b9aa7d"
          strokeWidth="1.4"
        />
        <path
          d="M37 53q-2 31-5 47-3 13 10 14"
          stroke="#f3e5bb"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M62 51q2 13 3 23"
          stroke="#c1ae7e"
          strokeWidth="1.3"
          fill="none"
          opacity=".7"
        />
        <g className="fantasy-cap">
          <path
            d="M5 47Q9 17 33 12q16-7 34 2 25 9 28 33-9 13-45 13T5 47Z"
            fill="#a45245"
            stroke="#803f39"
            strokeWidth="1.4"
          />
          <path d="M5 47Q48 34 95 47 84 60 50 60T5 47Z" fill="#cba87e" />
          <path
            d="m20 50 14 7m-1-10 11 11m8-12-1 12m18-11-12 11m25-9-16 8"
            stroke="#ae8667"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M15 36q7-16 19-18"
            stroke="#c67c5d"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse
            cx="28"
            cy="32"
            rx="7"
            ry="4.5"
            transform="rotate(-25 28 32)"
            fill="#e6d2a7"
          />
          <ellipse
            cx="56"
            cy="21"
            rx="9"
            ry="5"
            transform="rotate(10 56 21)"
            fill="#e8d3ac"
          />
          <ellipse
            cx="76"
            cy="36"
            rx="6"
            ry="4"
            transform="rotate(29 76 36)"
            fill="#dfc69c"
          />
          <ellipse cx="47" cy="37" rx="3.5" ry="2.5" fill="#dbbb92" />
        </g>
        <g transform="translate(10 38) scale(.8)">
          <FantasyFace pose={pose} ink="#665340" iris="#9c915b" />
        </g>
        <Fronds pose={pose} />
        {expression === "book" && (
          <g>
            <path d="m32 95 18 3 18-3v15l-18 4-18-4Z" fill="#6c7850" />
            <path d="m35 95 15 3 15-3v12l-15 3-15-3Z" fill="#eee0ac" />
            <path d="M50 98v12" stroke="#b9b581" />
          </g>
        )}
      </FantasyHead>
    </FantasyShell>
  );
}
