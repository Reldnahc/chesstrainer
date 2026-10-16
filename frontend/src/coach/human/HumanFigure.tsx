import type { ComponentProps, ReactNode } from "react";
import { HeadRig, StudyFrame } from "../ArtworkRig";
import type { CoachExpression } from "../model";
import Accents from "../studies/Accents";
import Book from "../studies/Book";
import Arm from "./Arm";
import HumanFeatures from "./HumanFeatures";
import HumanSpeechMouth, { type HumanSpeechPalette } from "./HumanSpeechMouth";
import { handPoses, type Pose } from "./poses";

type ArmColors = { skin: string; shade: string; sleeve: string; cuff: string };
type FeatureColors = Pick<ComponentProps<typeof HumanFeatures>, "browColor" | "noseColor" | "mouthColor" | "face">;

/** The shared human figure: frame, accents, body, head with its features and
 * speaking mouth, both arms and the book. Each coach supplies its own clothing,
 * head silhouette and hair; pose resolution stays with the coach. */
export default function HumanFigure({
  className,
  expression,
  pose,
  temperament,
  body,
  head,
  overFeatures,
  features,
  speech,
  arms,
  bookColor,
}: {
  className: string;
  expression: CoachExpression;
  pose: Pose;
  temperament: number;
  /** Clothing and neck, drawn under the head. */
  body: ReactNode;
  /** Everything on the head drawn under the features: back hair, ears, face, front hair. */
  head: ReactNode;
  /** Drawn over the features, such as freckles or glasses. */
  overFeatures?: ReactNode;
  features: FeatureColors;
  speech: { mouthColor: string; palette: HumanSpeechPalette };
  arms: ArmColors;
  bookColor: string;
}) {
  const hands = handPoses[pose.gesture];
  return (
    <StudyFrame
      viewBox="-6 -8 92 115"
      className={className}
      tilt={pose.tilt}
      lift={pose.lift}
      temperament={temperament}
      accents={
        <g transform="translate(-6 -8) scale(.92)">
          <Accents expression={expression} />
        </g>
      }
    >
      {body}
      <HeadRig>
        {head}
        <HumanFeatures
          pose={pose}
          expression={expression}
          glasses={false}
          {...features}
          mouth={<HumanSpeechMouth pose={pose} expression={expression}
            mouthColor={speech.mouthColor} palette={speech.palette} />}
        />
        {overFeatures}
      </HeadRig>
      <Arm side="left" hand={hands.left} gesture={pose.gesture} {...arms} />
      <Arm side="right" hand={hands.right} gesture={pose.gesture} {...arms} />
      {pose.gesture === "book" && (
        <g transform="translate(0 12) scale(.8)">
          <Book color={bookColor} />
        </g>
      )}
    </StudyFrame>
  );
}
