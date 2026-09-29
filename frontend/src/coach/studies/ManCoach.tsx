import type { CSSProperties } from "react";
import { ArtworkSvg, BodyRig, HeadRig } from "../ArtworkRig";
import type { CoachArtworkProps } from "../model";
import ClassicCoach from "../classic/ClassicCoach";
import HumanFeatures from "../human/HumanFeatures";
import Arm from "../human/Arm";
import { poses, handPoses } from "../human/poses";
import ManHair, { type ManLook } from "./ManHair";
import Accents from "./Accents";
import Book from "./Book";
import "./motion.css";

const palettes = {
  host: {
    skin: "#98654b",
    shade: "#754732",
    hair: "#302a2a",
    coat: "#b77856",
    sleeve: "#986247",
    cuff: "#e2b489",
    shirt: "#e4d5b5",
    nose: "#754732",
    mouth: "#512f29",
  },
  expert: {
    skin: "#d9ae89",
    shade: "#ba8967",
    hair: "#424247",
    coat: "#53677c",
    sleeve: "#45586d",
    cuff: "#97aaaf",
    shirt: "#c9d6cc",
    nose: "#b28263",
    mouth: "#75473e",
  },
  partner: {
    skin: "#bf895e",
    shade: "#996644",
    hair: "#373032",
    coat: "#506d68",
    sleeve: "#d1b082",
    cuff: "#ead0a5",
    shirt: "#e8ca95",
    nose: "#96603f",
    mouth: "#694039",
  },
};

export default function ManCoach(props: CoachArtworkProps) {
  if (props.family === "storyteller") return <ClassicCoach {...props} />;
  return <NewManCoach {...props} />;
}

function NewManCoach({ expression, family }: CoachArtworkProps) {
  const look: ManLook =
    family === "expert" || family === "partner" ? family : "host";
  const color = palettes[look];
  const source = poses[expression];
  const pose = {
    ...source,
    tilt: source.tilt * (look === "expert" ? 0.7 : 1),
  };
  const hands = handPoses[pose.gesture];
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament":
      look === "expert" ? 0.7 : look === "partner" ? 1.05 : 0.9,
  } as CSSProperties;
  return (
    <ArtworkSvg
      viewBox="-6 -8 92 115"
      className={`coach-artwork study-artwork study-human study-man study-${look}`}
      style={vars}
    >
      <g transform="translate(-6 -8) scale(.92)">
        <Accents expression={expression} />
      </g>
      <BodyRig>
        <path d="M8 103V84Q9 67 28 67h24q19 0 20 17v19Z" fill={color.coat} />
        <path d="m29 68 11 17 11-17-4-9H33Z" fill={color.shade} />
        <path d="M28 72q12 14 24 0l5 31H23Z" fill={color.shirt} />
        {look === "host" && (
          <g>
            <path
              d="m28 68 9 14-5 21H9V83q0-10 19-15m24 0-9 14 5 21h23V83q0-10-19-15Z"
              fill={color.coat}
            />
            <path
              d="m28 70-5 10 8-2m21-8 5 10-8-2M18 88h10v9H18Z"
              fill="none"
              stroke="#d49c74"
              strokeWidth="1.3"
            />
            <circle cx="46" cy="91" r="1" fill={color.shirt} />
            <circle cx="47" cy="100" r="1" fill={color.shirt} />
          </g>
        )}
        {look === "expert" && (
          <g>
            <path d="m27 68 13 18 13-18 8 35H19Z" fill={color.coat} />
            <path
              d="m27 70 13 16 13-16M40 86v17"
              fill="none"
              stroke="#a3b4b8"
              strokeWidth="1.4"
            />
            <path d="M39 88h2v4h-2Z" fill="#d7c6a1" />
            <path d="M25 99h8m14 0h8" stroke="#394d61" strokeWidth="1.5" />
          </g>
        )}
        {look === "partner" && (
          <g>
            <path d="m26 69 14 17 14-17 8 34H18Z" fill={color.coat} />
            <path
              d="m27 70 13 16 13-16m-13 16v17"
              fill="none"
              stroke="#83a39a"
              strokeWidth="1.3"
            />
            <path d="m30 72 4 10 6-5 6 5 4-10" fill={color.shirt} />
            {[89, 96].map((y) => (
              <circle key={y} cx="42" cy={y} r="1" fill="#dbbd85" />
            ))}
          </g>
        )}
        <HeadRig>
          <ellipse cx="17" cy="43" rx="3.8" ry="6.5" fill={color.shade} />
          <ellipse cx="63" cy="43" rx="3.8" ry="6.5" fill={color.shade} />
          <path
            d={
              look === "host"
                ? "M17 34Q16 12 40 12t23 22v19q-2 20-23 21-21-1-23-21Z"
                : look === "expert"
                  ? "M17 33q0-21 23-21t23 21v17Q61 70 40 74 19 70 17 50Z"
                  : "M18 34q-1-22 22-22t22 22v17Q60 72 40 76 20 72 18 51Z"
            }
            fill={color.skin}
          />
          <ManHair look={look} />
          {look === "host" && (
            <g fill={color.hair}>
              <path d="M17 49 23 54l2 9q15 10 30 0l2-9 6-5v4q-2 20-23 21-21-1-23-21Z" />
              <path d="M29 54q6-4 11 0 5-4 11 0l-1 3q-6-1-10-2-4 1-10 2Z" />
            </g>
          )}
          {look === "expert" && (
            <path
              d="m23 48 4 1m26 0 4-1M28 65q12 8 24 0"
              fill="none"
              stroke={color.shade}
              strokeWidth=".9"
              strokeLinecap="round"
            />
          )}
          {look === "partner" && (
            <g fill={color.hair}>
              <path d="M18 48 23 51l3 12 6 4q8 4 16 0l6-4 3-12 5-3v3Q60 72 40 76 20 72 18 51Z" />
              <path d="M29 55q3-5 11-2 8-3 11 2l-2 3q-6-3-9-3-3 0-9 3Z" />
            </g>
          )}
          <HumanFeatures
            pose={pose}
            expression={expression}
            browColor={color.hair}
            noseColor={color.nose}
            mouthColor={color.mouth}
            glasses={false}
          />
        </HeadRig>
        <Arm
          side="left"
          hand={hands.left}
          gesture={pose.gesture}
          {...color}
        />
        <Arm
          side="right"
          hand={hands.right}
          gesture={pose.gesture}
          {...color}
        />
        {pose.gesture === "book" && (
          <g transform="translate(0 12) scale(.8)">
            <Book color={color.coat} />
          </g>
        )}
      </BodyRig>
    </ArtworkSvg>
  );
}
