import type { CSSProperties } from "react";
import { ArtworkSvg, BodyRig } from "../ArtworkRig";
import type { CoachArtworkProps } from "../model";
import { animalPose, tailTransform } from "./animalPoses";
import AnimalPaws from "./AnimalPaws";
import DogHead from "./DogHead";
import { dogLook, dogPalettes } from "./dogLooks";
import Accents from "./Accents";
import Book from "./Book";
import "./motion.css";

export default function DogCoach({ expression, family }: CoachArtworkProps) {
  const look = dogLook(family);
  const palette = dogPalettes[look];
  const pose = animalPose(expression, look === "gentle");
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament": look === "gentle" ? 0.6 : look === "corgi" ? 1.1 : 1,
  } as CSSProperties;
  return (
    <ArtworkSvg
      viewBox="0 0 100 125"
      className={`coach-artwork study-artwork study-dog study-${look}`}
      style={vars}
    >
      <Accents expression={expression} />
      <BodyRig>
        <g transform={tailTransform(pose)}>
          <g className="study-tail">
            {look === "corgi" ? (
              <>
                <path
                  d="M69 110q25-1 25-25 0-9-5-15-13 4-8 19 4 8-15 11Z"
                  fill={palette.fur}
                />
                <path
                  d="M89 70q-9 3-10 10l14 7q3-10-4-17Z"
                  fill={palette.muzzle}
                />
              </>
            ) : (
              <>
                <path
                  d="M68 110q19-7 23-22l-1-13 5 5-1-14q11 22-1 36l-3-1 1 7-8-2-3 7Z"
                  fill={look === "collie" ? palette.fur : palette.light}
                />
                <path
                  d="M76 108q13-8 18-18"
                  stroke={look === "collie" ? palette.light : palette.fur}
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Cover the fur contour so it stops at the white tip. */}
                {look === "collie" && (
                  <path
                    d="m94 66 1 14-5-5 1 13-1 4 9 1q2-13-5-27Z"
                    fill={palette.muzzle}
                  />
                )}
              </>
            )}
          </g>
        </g>
        <path
          d={
            look === "corgi"
              ? "M17 120V99q0-25 33-25t33 25v21Z"
              : look === "collie"
                ? "M22 120V97q0-23 28-25 28 2 28 25v23Z"
                : "M20 120V96q0-23 30-24 30 1 30 24v24Z"
          }
          fill={palette.fur}
        />
        <path
          d={
            look === "corgi"
              ? "M30 79h40l-4 24-7 17H41l-7-17Z"
              : "m27 82 8-5h30l8 5-6 6 4 5-8 1-1 13-8-4-4 10-4-10-8 4-1-13-8-1 4-5Z"
          }
          fill={palette.muzzle}
        />
        <DogHead look={look} pose={pose} />
        {look === "collie" ? (
          <g>
            <path d="m29 81 21 6 21-6-1 9-20 6-20-6Z" fill={palette.accent} />
            <circle cx="50" cy="94" r="5" fill="#d6b778" />
            <path d="m50 91 2 3-2 3-2-3Z" fill="#aa884d" />
          </g>
        ) : (
          <>
            <path
              d="m29 81 21 6 21-6-5 17-16 11-16-11Z"
              fill={palette.accent}
            />
            <path
              d="m36 87 14 6 14-6m-14 6v10"
              stroke={palette.muzzle}
              strokeWidth="1"
              opacity=".6"
              fill="none"
            />
            <circle cx="50" cy="90" r="2" fill="#e4c38a" />
          </>
        )}
        {pose.paws === "book" && <Book color={palette.accent} />}
        <AnimalPaws
          pose={pose}
          palette={palette}
          mittens={look === "corgi" || look === "collie"}
        />
      </BodyRig>
    </ArtworkSvg>
  );
}
