import type { CSSProperties } from "react";
import { ArtworkSvg, BodyRig, HeadRig } from "../ArtworkRig";
import type { CoachArtworkProps } from "../model";
import HumanFeatures, { type HumanFaceStyle } from "../human/HumanFeatures";
import HumanSpeechMouth from "../human/HumanSpeechMouth";
import Arm from "../human/Arm";
import { poses, handPoses, withRestingGesture, type Gesture, type Pose } from "../human/poses";
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
    resting: "fold",
    head: "M17 35Q17 11 40 12 63 10 63 35v12Q61 69 40 72 19 69 17 47Z",
    // Lined, upturned almond eyes under strong angled brows: direct and sure.
    face: {
      shape: "upturned", width: 4.5, iris: "#4f6b3f", irisRadius: 2.3, liner: "flick",
      brows: { weight: 2.5, arch: 1.1, angle: 9, offset: 0.5 },
    },
  },
  analyst: {
    skin: "#aa7052",
    shade: "#895336",
    coat: "#cebd99",
    sleeve: "#b29f80",
    cuff: "#ece0bd",
    hair: "#30272b",
    speech: { cavity: "#593430", lip: "#a06856", tongue: "#bf7f76" },
    resting: "steeple",
    head: "M18 35Q18 11 40 12 62 11 62 35v12Q60 71 40 74 20 71 18 47Z",
    // Calm, slightly lowered lids and thin level brows behind her own frames.
    face: {
      shape: "almond", width: 4.3, height: 0.88, iris: "#3a2418", irisRadius: 2.3,
      lid: 0.22, skin: "#aa7052", liner: "line",
      brows: { weight: 1.7, arch: 0.35 }, nose: "long",
    },
  },
  spark: {
    skin: "#eac09c",
    shade: "#cf9c7b",
    coat: "#995b67",
    sleeve: "#834e5c",
    cuff: "#d6ac98",
    hair: "#322b3a",
    speech: { cavity: "#653c36", lip: "#d2917f", tongue: "#d3958a" },
    resting: "fist",
    head: "M17 36Q16 11 40 12 64 11 63 36v10Q62 68 40 70 18 68 17 46Z",
    // Wide-open eyes and high arched brows, always halfway to excitement.
    face: {
      shape: "round", width: 4.4, height: 1.15, iris: "#6a4a2e", irisRadius: 2.5,
      liner: "line", sparkle: true,
      brows: { weight: 2.1, arch: 1.6, offset: -0.8 }, nose: "button",
    },
  },
  blonde: {
    skin: "#eac5a5",
    shade: "#c99976",
    coat: "#7398ac",
    sleeve: "#608396",
    cuff: "#c4d9da",
    hair: "#a7864c",
    speech: { cavity: "#653c36", lip: "#d09682", tongue: "#d3958a" },
    resting: "rest",
    head: "M17 35Q17 11 40 12 63 10 63 35v13Q62 66 40 71 18 66 17 48Z",
    // Soft, gently downturned blue-grey eyes and light, easy brows.
    face: {
      shape: "downturned", width: 4.5, iris: "#5f89a8", irisRadius: 2.5,
      crease: "#c99976", lash: true,
      brows: { weight: 1.9, arch: 0.7, angle: -6 },
    },
  },
} satisfies Record<WomanLook, Record<string, unknown> & { resting: Gesture; head: string; face: HumanFaceStyle }>;

// HumanFeatures' shared lip color, named so the authored and speaking mouths agree.
const womanMouthColor = "#75473e";

export default function WomanCoach({ expression, family }: CoachArtworkProps) {
  const look: WomanLook =
    family === "analyst" || family === "spark" || family === "blonde"
      ? family
      : "captain";
  const color = palettes[look];
  const source = withRestingGesture(poses[expression], expression, color.resting);
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
          <path d={color.head} fill={color.skin} />
          <WomanHair look={look} front />
          <circle cx="17.4" cy="50" r="2.1" fill="#e8c276" />
          <circle cx="62.6" cy="50" r="2.1" fill="#e8c276" />
          <HumanFeatures
            pose={pose}
            expression={expression}
            browColor={color.hair}
            glasses={false}
            face={color.face}
            mouth={<HumanSpeechMouth pose={pose} expression={expression}
              mouthColor={womanMouthColor} palette={color.speech} />}
          />
          {look === "analyst" && <CatEyeGlasses />}
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

// Marisol's own burgundy frames, keeping the shared glasses class so the idle
// glasses gesture and reaction transforms still find them.
function CatEyeGlasses() {
  return (
    <g className="coach-glasses" fill="none" stroke="#6b2f3a" strokeWidth="1.9" strokeLinejoin="round">
      <path d="M36 37.5Q30 36 22.5 35.2Q23 47.5 30 47.5Q35.5 47.5 36 37.5Z" />
      <path d="M44 37.5Q50 36 57.5 35.2Q57 47.5 50 47.5Q44.5 47.5 44 37.5Z" />
      <path d="M36 39.5q4-2 8 0M22.5 36l-5 1.5m40-1.5 5 1.5" strokeWidth="1.5" />
      <path className="coach-lens-glint" d="m25.5 39 3-1m19 1 3-1" stroke="#fff" strokeWidth="1.2" opacity=".5" />
    </g>
  );
}
