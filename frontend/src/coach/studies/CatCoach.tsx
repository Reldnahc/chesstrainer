import type { CSSProperties } from "react";
import type { CoachArtworkProps } from "../model";
import { animalPose, tailTransform } from "./animalPoses";
import AnimalFace, { type AnimalPalette } from "./AnimalFace";
import AnimalPaws from "./AnimalPaws";
import Accents from "./Accents";
import Book from "./Book";
import "./motion.css";

const palettes: Record<string, AnimalPalette> = {
  tabby: {
    fur: "#c88947",
    dark: "#905d37",
    light: "#e8b873",
    muzzle: "#f6e3ba",
    nose: "#895653",
    iris: "#879b5b",
    accent: "#647f6b",
    brow: "#704e34",
  },
  tuxedo: {
    fur: "#3b4147",
    dark: "#252a32",
    light: "#89958f",
    muzzle: "#eee7d3",
    nose: "#b17b7e",
    iris: "#9ebe9b",
    accent: "#ba9860",
    brow: "#aaa997",
    lid: "#aaa997",
  },
  calico: {
    fur: "#eed9b6",
    dark: "#aa7d59",
    light: "#fff0d1",
    muzzle: "#fff2d8",
    nose: "#b5726a",
    iris: "#84969b",
    accent: "#679491",
    brow: "#665044",
  },
  black: {
    fur: "#2c303b",
    dark: "#1c202a",
    light: "#7e8b9d",
    muzzle: "#3c424f",
    nose: "#b5a0aa",
    iris: "#d9b054",
    accent: "#9b7081",
    brow: "#a0a5b1",
    lid: "#a0a5b1",
    paw: "#49515f",
    lip: "#b48e98",
  },
};

export default function CatCoach({ expression, family }: CoachArtworkProps) {
  const look = family in palettes ? family : "tabby";
  const palette = palettes[look];
  const pose = animalPose(expression, look === "tuxedo");
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament":
      look === "tuxedo" ? 0.65 : look === "calico" ? 1.1 : 0.9,
  } as CSSProperties;
  return (
    <svg
      viewBox="0 0 100 125"
      className={`coach-artwork study-artwork study-cat study-${look}`}
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
                d="M69 107q22 0 18-17-3-12 4-19 8-9 0-15"
                stroke={palette.fur}
                strokeWidth="11"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M91 71q8-9 0-15"
                stroke={look === "tuxedo" ? palette.muzzle : palette.dark}
                strokeWidth="11"
                fill="none"
                strokeLinecap="round"
              />
            </g>
          </g>
          <path d="M23 117V93q0-21 27-21t27 21v24Z" fill={palette.fur} />
          <path
            d="M32 76q18 9 36 0l-3 16-6-3-9 18-9-18-6 3Z"
            fill={palette.muzzle}
          />
          {look === "tabby" && (
            <path
              d="m24 94 8 3m-8 5 7 2m45-10-8 3m8 5-7 2"
              stroke={palette.dark}
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
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
                          d={
                            look === "black"
                              ? "M17 36 11 3q14 3 22 26Z"
                              : look === "tuxedo"
                                ? "M15 36 9 5q16 1 26 22Z"
                                : "M14 37 10 9q15-3 26 20Z"
                          }
                          fill={
                            look === "calico" && right ? "#41464a" : palette.fur
                          }
                        />
                        <path
                          d="m17 29-3-14q9 1 15 12Z"
                          fill={
                            look === "black"
                              ? "#786674"
                              : look === "tuxedo"
                                ? "#a87d7b"
                                : "#d59682"
                          }
                        />
                        <path
                          d="m17 29 4-6 5 8"
                          fill={palette.muzzle}
                          opacity=".65"
                        />
                      </g>
                    </g>
                  </g>
                ))}
                <path
                  d={
                    look === "black"
                      ? "M22 31Q34 21 50 24q18-2 28 7l5 20-5 2 3 6-8 1Q63 78 50 79 37 78 27 60l-8-1 3-6-5-2Z"
                      : look === "tuxedo"
                        ? "M20 32Q28 21 50 23q22-2 30 9l4 17-5 3 3 7-8 1Q66 78 50 80 34 78 26 60l-8-1 3-7-5-3Z"
                        : "M19 32Q28 23 50 24q22-1 31 8l3 16-5 4 5 6-9 2Q66 78 50 80 34 78 25 60l-9-2 5-6-5-4Z"
                  }
                  fill={palette.fur}
                />
                {look === "black" && (
                  <path
                    d="M24 32q7-5 15-5m22 0q9 0 15 5M22 49l4 4m48 0 4-4"
                    stroke="#626b7b"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
                {look === "tabby" && (
                  <g fill={palette.dark}>
                    <path d="m39 25 4 10 4-11 3 13 3-13 4 11 4-10-1 13-10 2-10-2Z" />
                    <path d="m19 41 8 3-8 3m1 4 9 3-7 3m59-16-8 3 8 3m-1 4-9 3 7 3" />
                  </g>
                )}
                {look === "tuxedo" && (
                  <path
                    d="M48 30q-5 13-10 19l-3 9q15 16 30 0l-3-9Q54 37 52 30Z"
                    fill={palette.muzzle}
                  />
                )}
                {look === "calico" && (
                  <>
                    <path
                      d="M19 33q7-7 18-8 11 6 9 21-8 8-19 5l-9-4Z"
                      fill="#c48a4d"
                    />
                    <path
                      d="M64 26q14 2 17 12l-2 16q-11 2-17-7-5-12 2-21Z"
                      fill="#494b49"
                    />
                  </>
                )}
                <AnimalFace pose={pose} palette={palette} />
              </g>
            </g>
          </g>
          <path d="m30 77 20 7 20-7-7 16-13 9-13-9Z" fill={palette.accent} />
          <path
            d="m37 84 13 6 13-6"
            stroke={palette.light}
            strokeWidth=".9"
            fill="none"
            opacity=".65"
          />
          {pose.paws === "book" && <Book color={palette.accent} />}
          <AnimalPaws
            pose={pose}
            palette={palette}
            mittens={look === "tuxedo" || look === "calico"}
          />
        </g>
      </g>
    </svg>
  );
}
