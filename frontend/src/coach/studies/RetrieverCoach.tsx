import type { CSSProperties } from "react";
import type { CoachArtworkProps } from "../model";
import { animalPose, tailTransform } from "./animalPoses";
import AnimalFace, { type AnimalPalette } from "./AnimalFace";
import AnimalPaws from "./AnimalPaws";
import Accents from "./Accents";
import Book from "./Book";
import "./motion.css";

const palettes: Record<string, AnimalPalette> = {
  sunny: {
    fur: "#d8a150",
    dark: "#ac783b",
    light: "#ecc080",
    muzzle: "#f3d7a5",
    nose: "#42322b",
    iris: "#8c6949",
    accent: "#618b98",
    brow: "#9c6939",
  },
  gentle: {
    fur: "#dfc087",
    dark: "#b59662",
    light: "#f0d8aa",
    muzzle: "#f8e7c6",
    nose: "#574137",
    iris: "#927a56",
    accent: "#80917a",
    brow: "#a88658",
  },
  scout: {
    fur: "#c1843f",
    dark: "#915c32",
    light: "#e2ab67",
    muzzle: "#efc790",
    nose: "#422f27",
    iris: "#816343",
    accent: "#6f8970",
    brow: "#825631",
  },
};

export default function RetrieverCoach({
  expression,
  family,
}: CoachArtworkProps) {
  const look = family in palettes ? family : "sunny";
  const palette = palettes[look];
  const pose = animalPose(expression, look === "gentle");
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament": look === "gentle" ? 0.6 : look === "scout" ? 1.1 : 1,
  } as CSSProperties;
  return (
    <svg
      viewBox="0 0 100 125"
      className={`coach-artwork study-artwork study-dog study-${look}`}
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
                d="M68 110q19-7 23-22l-1-13 5 5-1-14q11 22-1 36l-3-1 1 7-8-2-3 7Z"
                fill={palette.light}
              />
              <path
                d="M76 108q13-8 18-18"
                stroke={palette.fur}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </g>
          </g>
          <path d="M20 120V96q0-23 30-24 30 1 30 24v24Z" fill={palette.fur} />
          <path
            d="m27 82 8-5h30l8 5-6 6 4 5-8 1-1 13-8-4-4 10-4-10-8 4-1-13-8-1 4-5Z"
            fill={palette.muzzle}
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
                      transform={`rotate(${(right ? -pose.ears[1] : pose.ears[0]) * 0.5} 25 30)`}
                    >
                      <g
                        className={`study-ear-motion study-ear-${right ? "right" : "left"}`}
                      >
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
                      </g>
                    </g>
                  </g>
                ))}
                <path
                  d={
                    look === "scout"
                      ? "M23 36q0-20 27-20t27 20v17l3 8-7 1Q65 83 50 84 35 83 27 62l-7-1 3-8Z"
                      : "M22 37q0-21 28-21t28 21v15l4 9-7 2Q69 83 50 84 31 83 25 63l-7-2 4-9Z"
                  }
                  fill={palette.fur}
                />
                <path
                  d={
                    look === "scout"
                      ? "M30 25q4-13 17-10l-1-5q12 0 17 11-18-2-33 4Z"
                      : "M30 24q6-11 17-8l2-5 6 5 6-2 8 13q-19-7-39-3Z"
                  }
                  fill={palette.light}
                />
                {look === "gentle" && (
                  <>
                    <path
                      d="M26 35q7-8 17-2m14 0q10-6 17 2"
                      stroke={palette.muzzle}
                      strokeWidth="5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M50 28q-7 12-6 23h12q1-11-6-23Z"
                      fill={palette.light}
                    />
                  </>
                )}
                <AnimalFace pose={pose} palette={palette} dog />
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
          <path d="m29 81 21 6 21-6-5 17-16 11-16-11Z" fill={palette.accent} />
          <path
            d="m36 87 14 6 14-6m-14 6v10"
            stroke={palette.muzzle}
            strokeWidth="1"
            opacity=".6"
            fill="none"
          />
          <circle cx="50" cy="90" r="2" fill="#e4c38a" />
          {pose.paws === "book" && <Book color={palette.accent} />}
          <AnimalPaws pose={pose} palette={palette} />
        </g>
      </g>
    </svg>
  );
}
