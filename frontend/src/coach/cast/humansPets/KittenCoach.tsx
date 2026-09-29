import type { CoachArtworkProps } from "../../model";
import type { AnimalPalette } from "../../studies/AnimalFace";
import AnimalPaws from "../../studies/AnimalPaws";
import { animalPoses, tailTransform, type AnimalPose } from "../../studies/animalPoses";
import Book from "../../studies/Book";
import { AnimalFrame, AnimalHead } from "../animals/AnimalParts";
import KittenFace from "./KittenFace";

const palette: AnimalPalette = {
  fur: "#a7bac8", dark: "#6f879d", light: "#e2e9e7",
  muzzle: "#f4eee0", nose: "#bc878a", iris: "#79aeb5",
  accent: "#81a799", brow: "#526c80", paw: "#e2e9e7",
};

export default function KittenCoach({ expression }: CoachArtworkProps) {
  const original = animalPoses[expression];
  const pose: AnimalPose = {
    ...original,
    eye: original.eye * 1.05 + 3,
    tilt: original.tilt * .85,
    paws: expression === "brilliant" ? "offer" : original.paws,
  };
  return (
    <AnimalFrame name="kitten" expression={expression} pose={pose} temperament={1.05}>
      <g transform={tailTransform(pose)}>
        <g className="study-tail">
          <path d="M69 112q17 2 17-10 0-8-7-9-6 0-5 5" fill="none"
            stroke={palette.fur} strokeWidth="9" strokeLinecap="round" />
          <path d="M79 93q-6 0-5 5" fill="none"
            stroke={palette.muzzle} strokeWidth="9" strokeLinecap="round" />
        </g>
      </g>
      <path className="kitten-body-silhouette" d="M30 116v-9q0-21 20-22 20 1 20 22v9q-20 9-40 0Z" fill={palette.fur} />
      <ellipse cx="50" cy="105" rx="12" ry="14" fill={palette.muzzle} />
      <ellipse cx="31" cy="117" rx="11" ry="5" fill={palette.light} />
      <ellipse cx="69" cy="117" rx="11" ry="5" fill={palette.light} />
      <path d="m26 115 0 3m6-3v3m36-3v3m6-3v3" stroke={palette.dark} strokeWidth=".8" strokeLinecap="round" />
      <AnimalHead>
        {[false, true].map(right => (
          <g key={String(right)} transform={right ? "translate(100 0) scale(-1 1)" : undefined}>
            <g transform={`rotate(${right ? -pose.ears[1] : pose.ears[0]} 25 31)`}>
              <g className={`study-ear-motion study-ear-${right ? "right" : "left"}`}>
                <path d="M12 45Q6 23 12 10q3-6 12 2l17 20Z" fill={palette.fur} />
                <path d="M17 36q-5-16-2-21 9 1 18 15Z" fill="#d5a7ab" />
                <path d="m17 37 4-10 3 7 5-3 2 10Z" fill={palette.muzzle} />
              </g>
            </g>
          </g>
        ))}
        <path className="kitten-head-silhouette"
          d="M12 48Q12 24 50 25t38 23q6 11 2 20l-4-1 2 6-6 1q-8 18-32 19-24-1-32-19l-6-1 2-6-4 1q-4-10 2-20Z"
          fill={palette.fur} />
        <path d="M20 68q5-4 14 0 8 6 16 6t16-6q9-4 14 0-5 21-30 23-25-2-30-23Z" fill={palette.muzzle} />
        <g fill={palette.dark} opacity=".8">
          <path d="M42 27q-1 6 4 11l1-10Z" />
          <path d="M50 26q-2 8 0 13 4-6 4-13Z" />
          <path d="m58 28-5 10q7-3 9-9Z" />
          <path d="m13 59 8 3-7 2m73-5-8 3 7 2" />
        </g>
        <KittenFace pose={pose} palette={palette} />
      </AnimalHead>
      <path d="M35 90q15 6 30 0l-1 4q-14 5-28 0Z" fill={palette.accent} />
      <circle cx="50" cy="97" r="3.3" fill="#e4bc70" />
      <path d="M48 97h4m-2 0v2" stroke="#ad864e" strokeWidth=".8" strokeLinecap="round" />
      {pose.paws === "book" && <Book color={palette.accent} />}
      <AnimalPaws pose={pose} palette={palette} mittens positions={
        pose.paws === "cheeks" ? [[21, 76, -12], [79, 76, 12]]
          : pose.paws === "chin" ? [[30, 107, -8], [54, 86, -25]] : undefined
      } />
    </AnimalFrame>
  );
}
