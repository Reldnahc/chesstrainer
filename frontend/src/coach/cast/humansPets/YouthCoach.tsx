import type { CSSProperties, ReactNode } from "react";
import { ArtworkSvg, BodyRig, HeadRig } from "../../ArtworkRig";
import type { CoachArtworkProps } from "../../model";
import HumanFeatures, { type HumanFaceStyle } from "../../human/HumanFeatures";
import HumanSpeechMouth, { type HumanSpeechPalette } from "../../human/HumanSpeechMouth";
import Arm from "../../human/Arm";
import { handPoses, poses, withRestingGesture, type Gesture, type Pose } from "../../human/poses";
import Accents from "../../studies/Accents";
import Book from "../../studies/Book";
import "../../studies/motion.css";

export type YouthLook = {
  id: "boy" | "girl";
  skin: string;
  shade: string;
  sleeve: string;
  cuff: string;
  hair: string;
  speech: HumanSpeechPalette;
  face: HumanFaceStyle;
  resting: Gesture;
  clothing: ReactNode;
  backHair?: ReactNode;
  frontHair: ReactNode;
};

const youthMouthColor = "#65392f";

// The children share the established expression vocabulary, with their own
// proportions and gesture choices rather than scaled-down adult silhouettes.
export default function YouthCoach({
  expression,
  look,
}: Pick<CoachArtworkProps, "expression"> & { look: YouthLook }) {
  const source = withRestingGesture(poses[expression], expression, look.resting);
  const pose: Pose = {
    ...source,
    eye: source.eye + 0.35,
    gesture:
      expression === "brilliant"
        ? look.id === "boy"
          ? "fist"
          : "clap"
        : source.gesture,
    tilt: source.tilt * (look.id === "girl" ? 0.9 : 1),
  };
  const hands = handPoses[pose.gesture];
  const armColors = {
    skin: look.skin,
    shade: look.shade,
    sleeve: look.sleeve,
    cuff: look.cuff,
  };
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament": look.id === "boy" ? 1.05 : 0.95,
  } as CSSProperties;

  return (
    <ArtworkSvg
      viewBox="-6 -8 92 115"
      className={`coach-artwork study-artwork study-human study-youth study-${look.id}`}
      style={vars}
    >
      <g transform="translate(-6 -8) scale(.92)">
        <Accents expression={expression} />
      </g>
      <BodyRig>
        {look.clothing}
        <path d="M33 63h14v11q-7 7-14 0Z" fill={look.shade} />
        <path d="M34 64h12v8q-6 5-12 0Z" fill={look.skin} />
        <HeadRig>
          {look.backHair}
          <ellipse cx="15.5" cy="43" rx="4.5" ry="6" fill={look.shade} />
          <ellipse cx="64.5" cy="43" rx="4.5" ry="6" fill={look.shade} />
          <path
            d="M14 32Q13 5 40 5T66 32v13q0 19-26 24Q14 64 14 45Z"
            fill={look.skin}
          />
          <path
            d="M16 44q1 14 11 19M64 44q-1 14-11 19"
            stroke={look.shade}
            strokeWidth="1"
            fill="none"
            opacity=".45"
          />
          {look.frontHair}
          <HumanFeatures
            expression={expression}
            pose={pose}
            glasses={false}
            browColor={look.hair}
            noseColor={look.shade}
            mouthColor={youthMouthColor}
            face={look.face}
            mouth={<HumanSpeechMouth pose={pose} expression={expression}
              mouthColor={youthMouthColor} palette={look.speech} />}
          />
          {look.id === "boy" && (
            <g fill="#8c4f39" opacity=".6">
              <circle cx="22" cy="49" r=".7" />
              <circle cx="26" cy="51" r=".65" />
              <circle cx="57" cy="49" r=".7" />
              <circle cx="54" cy="52" r=".65" />
            </g>
          )}
        </HeadRig>
        <Arm
          side="left"
          hand={hands.left}
          gesture={pose.gesture}
          {...armColors}
        />
        <Arm
          side="right"
          hand={hands.right}
          gesture={pose.gesture}
          {...armColors}
        />
        {pose.gesture === "book" && (
          <g transform="translate(0 12) scale(.8)">
            <Book color={look.sleeve} />
          </g>
        )}
      </BodyRig>
    </ArtworkSvg>
  );
}
