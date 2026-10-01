import type { CSSProperties } from "react";
import { ArtworkSvg, BodyRig, HeadRig } from "../ArtworkRig";
import { useEyeClosure } from "../CoachFaceContext";
import type { CoachArtworkProps } from "../model";
import HumanFeatures from "../human/HumanFeatures";
import HumanSpeechMouth from "../human/HumanSpeechMouth";
import Arm from "../human/Arm";
import { poses, handPoses, type Pose } from "../human/poses";
import WomanHair, { type WomanLook } from "./WomanHair";
import Accents from "./Accents";
import Book from "./Book";
import "./motion.css";

const palettes = {
  captain: {
    skin: "#dca57d",
    shade: "#bd825e",
    coat: "#397d79",
    sleeve: "#326c69",
    cuff: "#bad1bd",
    hair: "#654033",
    speech: { cavity: "#653c36", lip: "#c58874", tongue: "#ce9182" },
  },
  analyst: {
    skin: "#aa7052",
    shade: "#895336",
    coat: "#cebd99",
    sleeve: "#b29f80",
    cuff: "#ece0bd",
    hair: "#30272b",
    speech: { cavity: "#593430", lip: "#a06856", tongue: "#bf7f76" },
  },
  spark: {
    skin: "#eac09c",
    shade: "#cf9c7b",
    coat: "#995b67",
    sleeve: "#834e5c",
    cuff: "#d6ac98",
    hair: "#322b3a",
    speech: { cavity: "#653c36", lip: "#d2917f", tongue: "#d3958a" },
  },
  blonde: {
    skin: "#eac5a5",
    shade: "#c99976",
    coat: "#7398ac",
    sleeve: "#608396",
    cuff: "#c4d9da",
    hair: "#a7864c",
    speech: { cavity: "#653c36", lip: "#d09682", tongue: "#d3958a" },
  },
};

// HumanFeatures' shared lip color, named so the authored and speaking mouths agree.
const womanMouthColor = "#75473e";

export default function WomanCoach({ expression, family }: CoachArtworkProps) {
  const look: WomanLook =
    family === "analyst" || family === "spark" || family === "blonde"
      ? family
      : "captain";
  const color = palettes[look];
  const source = poses[expression];
  const pose: Pose = {
    ...source,
    tilt: source.tilt * (look === "analyst" ? 0.65 : 1),
    gesture:
      look === "analyst" && expression === "blunder"
        ? "chin"
        : look === "analyst" && expression === "brilliant"
          ? "clap"
          : look === "spark" && expression === "brilliant"
            ? "fist"
            : source.gesture,
    mouth:
      look === "analyst" && expression === "brilliant"
        ? poses.great.mouth
        : source.mouth,
  };
  const hands = handPoses[pose.gesture];
  const closedEyes = useEyeClosure(pose.closedEyes);
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament":
      look === "analyst" ? 0.6 : look === "spark" ? 1.15 : 0.9,
  } as CSSProperties;
  return (
    <ArtworkSvg
      viewBox="-6 -8 92 115"
      className={`coach-artwork study-artwork study-human study-woman study-${look}`}
      style={vars}
    >
      <g transform="translate(-6 -8) scale(.92)">
        <Accents expression={expression} />
      </g>
      <BodyRig>
        <path d="M9 103V84Q11 67 28 67h24q18 0 20 17v19Z" fill={color.coat} />
        <path d="m28 68 12 18 12-18-6-9H34Z" fill={color.skin} />
        <path
          d="m28 70 12 15 12-15-1 33H29Z"
          fill={look === "spark" ? "#e3bb70" : "#f1e4cb"}
        />
        <path
          d="m27 68 13 17-11 18H13V83q0-11 14-15m26 0L40 85l11 18h19V83q-1-11-17-15Z"
          fill={color.coat}
        />
        {look === "captain" && (
          <path
            d="m27 68 7 8-4 6 10 3-11 9m24-26-7 8 4 6-10 3 11 9"
            stroke="#6eaaa0"
            strokeWidth="1.2"
            fill="none"
          />
        )}
        {look === "analyst" && (
          <path d="M32 80v23m16-23v23" stroke="#a38d72" strokeWidth="1.2" />
        )}
        {look === "blonde" && (
          <g>
            <path d="M24 70q16 16 32 0l7 33H17Z" fill={color.coat} />
            <path
              d="M25 72q15 15 30 0M38 84v19m4-18v18"
              fill="none"
              stroke="#b5cdd3"
              strokeWidth="1.1"
            />
            <path d="M49 91h10v8H49Z" fill="#608396" />
          </g>
        )}
        <HeadRig>
          <WomanHair look={look} />
          <ellipse cx="17" cy="43" rx="3.6" ry="6.3" fill={color.shade} />
          <ellipse cx="63" cy="43" rx="3.6" ry="6.3" fill={color.shade} />
          <path
            d="M17 35Q17 11 40 12 63 10 63 35v12Q61 69 40 72 19 69 17 47Z"
            fill={color.skin}
          />
          <WomanHair look={look} front />
          <circle cx="17.4" cy="50" r="2.1" fill="#e8c276" />
          <circle cx="62.6" cy="50" r="2.1" fill="#e8c276" />
          <HumanFeatures
            pose={pose}
            expression={expression}
            browColor={color.hair}
            glasses={look === "analyst"}
            mouth={<HumanSpeechMouth pose={pose} expression={expression}
              mouthColor={womanMouthColor} palette={color.speech} />}
          />
          {!closedEyes && (
            <path
              d="m25 41-1.3-1m30 1 1.3-1"
              stroke={color.hair}
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          )}
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
