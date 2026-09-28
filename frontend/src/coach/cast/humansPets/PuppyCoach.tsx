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
  fur: "#bd885b",
  dark: "#795540",
  light: "#d8aa79",
  muzzle: "#f0e5d1",
  nose: "#493a38",
  iris: "#9b7955",
  accent: "#729e92",
  brow: "#674936",
  paw: "#ead9bb",
};

export default function PuppyCoach({ expression }: CoachArtworkProps) {
  const original = animalPoses[expression];
  const pose: AnimalPose = {
    ...original,
    eye: original.eye + 0.5,
    paws: expression === "brilliant" ? "celebrate" : original.paws,
  };
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament": 1.05,
  } as CSSProperties;

  return (
    <svg
      viewBox="0 0 100 125"
      className="coach-artwork study-artwork study-dog study-puppy"
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
                d="M72 107q14-1 16-13 1-8-4-13"
                fill="none"
                stroke={palette.fur}
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M87 90q1-5-3-9"
                fill="none"
                stroke={palette.muzzle}
                strokeWidth="10"
                strokeLinecap="round"
              />
            </g>
          </g>
          <path d="M22 117V101q0-19 28-21 28 2 28 21v16Z" fill={palette.fur} />
          <path
            d="M39 83q11 3 22 0l5 17-7 18H41l-7-18Z"
            fill={palette.muzzle}
          />
          <ellipse cx="29" cy="116" rx="13" ry="6" fill={palette.paw} />
          <ellipse cx="71" cy="116" rx="13" ry="6" fill={palette.paw} />
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
                        <path
                          d="M28 23Q7 15 7 41l-1 22q1 20 13 17 12-3 11-27Z"
                          fill="#795540"
                        />
                        <path
                          d="M20 30Q12 37 13 57q0 14 6 15"
                          fill="none"
                          stroke="#9b6e4c"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                      </g>
                    </g>
                  </g>
                ))}
                <path
                  d="M18 43Q18 13 50 15q32-2 32 28v15Q82 83 50 86 18 83 18 58Z"
                  fill={palette.fur}
                />
                <path
                  d="M20 39q1-18 22-22 1 9-6 18-7 10-17 18Z"
                  fill="#8b6044"
                />
                <path
                  d="M59 17q20 3 22 22l1 14q-13-1-21-12-6-9-2-24Z"
                  fill="#946544"
                />
                <path
                  d="M46 16h8q-5 15 0 27l5 9-18 1 5-10q5-12 0-27Z"
                  fill={palette.muzzle}
                />
                <path
                  d="M27 71q23 11 46 0-5 13-23 15-18-2-23-15Z"
                  fill={palette.muzzle}
                />
                <g transform="translate(0 3)">
                  <AnimalFace
                    pose={pose}
                    palette={palette}
                    dog
                    muzzleShape="M30 57q0-12 20-9 20-3 20 9v7Q66 78 50 78 34 78 30 64Z"
                  />
                </g>
              </g>
            </g>
          </g>
          <path d="M30 82q20 9 40 0l-1 7q-19 8-38 0Z" fill={palette.accent} />
          <path
            d="M33 85q17 7 34 0"
            fill="none"
            stroke="#aac0a8"
            strokeWidth="1"
          />
          <circle cx="50" cy="94" r="4.4" fill="#d5b56d" />
          <path
            d="m48 94 1.4 1.3 2.7-3"
            fill="none"
            stroke="#9a7842"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pose.paws === "book" && <Book color={palette.accent} />}
          <AnimalPaws pose={pose} palette={palette} mittens />
        </g>
      </g>
    </svg>
  );
}
