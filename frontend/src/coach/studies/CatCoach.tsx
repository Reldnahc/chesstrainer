import type { CSSProperties } from "react";
import { ArtworkSvg, BodyRig, HeadRig } from "../ArtworkRig";
import type { CoachArtworkProps } from "../model";
import { animalPose, tailTransform } from "./animalPoses";
import AnimalFace, { type AnimalPalette } from "./AnimalFace";
import AnimalPaws from "./AnimalPaws";
import Accents from "./Accents";
import Book from "./Book";
import "./motion.css";

type CatLook = "tuxedo" | "black";
const palettes: Record<CatLook, AnimalPalette> = {
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
  // An unknown family draws the collection's default cat.
  const look: CatLook = family === "black" ? "black" : "tuxedo";
  const palette = palettes[look];
  const pose = animalPose(expression, look === "tuxedo");
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament": look === "tuxedo" ? 0.65 : 0.9,
  } as CSSProperties;
  return (
    <ArtworkSvg
      viewBox="0 0 100 125"
      className={`coach-artwork study-artwork study-cat study-${look}`}
      style={vars}
    >
      <Accents expression={expression} />
      <BodyRig>
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
        <path d="M32 76q18 9 36 0l-3 16-6-3-9 18-9-18-6 3Z" fill={palette.muzzle} />
        <HeadRig>
          {[false, true].map(right => (
            <g key={String(right)} transform={right ? "translate(100 0) scale(-1 1)" : undefined}>
              <g transform={`rotate(${right ? -pose.ears[1] : pose.ears[0]} 25 31)`}>
                <g className={`study-ear-motion study-ear-${right ? "right" : "left"}`}>
                  <path
                    d={look === "black" ? "M17 36 11 3q14 3 22 26Z" : "M15 36 9 5q16 1 26 22Z"}
                    fill={palette.fur}
                  />
                  <path
                    d="m17 29-3-14q9 1 15 12Z"
                    fill={look === "black" ? "#786674" : "#a87d7b"}
                  />
                  <path d="m17 29 4-6 5 8" fill={palette.muzzle} opacity=".65" />
                </g>
              </g>
            </g>
          ))}
          <path
            d={
              look === "black"
                ? "M22 31Q34 21 50 24q18-2 28 7l5 20-5 2 3 6-8 1Q63 78 50 79 37 78 27 60l-8-1 3-6-5-2Z"
                : "M20 32Q28 21 50 23q22-2 30 9l4 17-5 3 3 7-8 1Q66 78 50 80 34 78 26 60l-8-1 3-7-5-3Z"
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
          {look === "tuxedo" && (
            <path d="M48 30q-5 13-10 19l-3 9q15 16 30 0l-3-9Q54 37 52 30Z" fill={palette.muzzle} />
          )}
          <AnimalFace pose={pose} palette={palette} />
        </HeadRig>
        <path d="m30 77 20 7 20-7-7 16-13 9-13-9Z" fill={palette.accent} />
        <path
          d="m37 84 13 6 13-6"
          stroke={palette.light}
          strokeWidth=".9"
          fill="none"
          opacity=".65"
        />
        {pose.paws === "book" && <Book color={palette.accent} />}
        <AnimalPaws pose={pose} palette={palette} mittens={look === "tuxedo"} />
      </BodyRig>
    </ArtworkSvg>
  );
}
