import type { CSSProperties } from "react";
import type { CoachArtworkProps } from "../../model";
import AnimalFace, { type AnimalPalette } from "../../studies/AnimalFace";
import AnimalPaws from "../../studies/AnimalPaws";
import {
  animalPoses,
  tailTransform,
  type AnimalPose,
} from "../../studies/animalPoses";
import Accents from "../../studies/Accents";
import Book from "../../studies/Book";
import "../../studies/motion.css";

const palette: AnimalPalette = {
  fur: "#899aa9",
  dark: "#586b7e",
  light: "#c5d1d5",
  muzzle: "#e0e6df",
  nose: "#9a747c",
  iris: "#9fad72",
  accent: "#bd845b",
  brow: "#4f5b6b",
  paw: "#c6d3d6",
};

export default function KittenCoach({ expression }: CoachArtworkProps) {
  const original = animalPoses[expression];
  const pose: AnimalPose = {
    ...original,
    eye: original.eye + 0.6,
    tilt: original.tilt * 1.1,
    paws: expression === "brilliant" ? "offer" : original.paws,
  };
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament": 1.05,
  } as CSSProperties;

  return (
    <svg
      viewBox="0 0 100 125"
      className="coach-artwork study-artwork study-cat study-kitten"
      style={vars}
      aria-hidden="true"
      focusable="false"
    >
      <Accents expression={expression} />
      <g className="study-body">
        <g className="study-body-idle">
          <g transform={tailTransform(pose)}>
            <g className="study-tail">
              <path
                d="M71 111q20 0 17-18-2-11 1-15 6-8 1-13"
                fill="none"
                stroke={palette.fur}
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="m87.5 101 1-4m-.2-13 .8-4m.9-10-1-4"
                fill="none"
                stroke={palette.dark}
                strokeWidth="8"
                strokeLinecap="round"
              />
            </g>
          </g>
          <path d="M27 118v-17q0-20 23-21 23 1 23 21v17Z" fill={palette.fur} />
          <path d="M38 82q12 6 24 0l-3 23-9 10-9-10Z" fill={palette.muzzle} />
          <path
            d="m28 102 7 2m-7 4 7 2m37-8-7 2m7 4-7 2"
            stroke={palette.dark}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <g className="study-head">
            <g className="study-head-idle">
              <g className="study-head-pose">
                {[false, true].map((right) => (
                  <g
                    key={String(right)}
                    transform={
                      right ? "translate(100 0) scale(-1 1)" : undefined
                    }
                  >
                    <g
                      transform={`rotate(${right ? -pose.ears[1] : pose.ears[0]} 25 31)`}
                    >
                      <g
                        className={`study-ear-motion study-ear-${right ? "right" : "left"}`}
                      >
                        <path d="M13 42 9 9Q20 4 36 28Z" fill={palette.fur} />
                        <path d="M17 32 14 14q10 2 16 13Z" fill="#bd9697" />
                        <path d="m15 33 6-9 5 10" fill={palette.muzzle} />
                        <path d="m10 10-1-4 4 3" fill={palette.dark} />
                      </g>
                    </g>
                  </g>
                ))}
                <path
                  d="M14 37Q22 20 50 24q28-4 36 13l1 19-5 3 4 7-10 1Q66 86 50 87 34 86 24 67l-10-1 4-7-5-3Z"
                  fill={palette.fur}
                />
                <path
                  d="m40 25 4 11 6-10 6 10 4-11-2 16-8-5-8 5Z"
                  fill={palette.dark}
                />
                <path
                  d="m15 43 8 3-8 3m1 6 8 2-6 3m67-17-8 3 8 3m-1 6-8 2 6 3"
                  fill={palette.dark}
                />
                <path
                  d="M28 66q22 11 44 0-8 19-22 21-14-2-22-21Z"
                  fill={palette.muzzle}
                />
                <g transform="translate(0 5)">
                  <AnimalFace pose={pose} palette={palette} />
                </g>
              </g>
            </g>
          </g>
          <path d="M34 84q16 7 32 0v6q-16 7-32 0Z" fill={palette.accent} />
          <path
            d="M52 91q6-7 10-4l-1 8q-5 1-9-4m0 0q-7-7-10-4l1 8q5 1 9-4Z"
            fill="#d1a174"
          />
          <circle cx="52" cy="91" r="2" fill="#af784e" />
          {pose.paws === "book" && <Book color={palette.accent} />}
          <AnimalPaws pose={pose} palette={palette} mittens />
        </g>
      </g>
    </svg>
  );
}
