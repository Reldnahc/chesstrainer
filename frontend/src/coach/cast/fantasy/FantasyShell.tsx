import type { CSSProperties, ReactNode } from "react";
import { ArtworkSvg, BodyRig } from "../../ArtworkRig";
import type { CoachExpression } from "../../model";
import type { AnimalPose } from "../../studies/animalPoses";
import Accents from "../../studies/Accents";
import "../../studies/motion.css";
import "./fantasy.css";

export { HeadRig as FantasyHead } from "../../ArtworkRig";

export default function FantasyShell({
  expression,
  pose,
  character,
  temperament = 1,
  children,
}: {
  expression: CoachExpression;
  pose: AnimalPose;
  character: string;
  temperament?: number;
  children: ReactNode;
}) {
  const vars = {
    "--study-tilt": `${pose.tilt}deg`,
    "--study-lift": `${pose.lift}px`,
    "--study-temperament": temperament,
  } as CSSProperties;
  return (
    <ArtworkSvg
      viewBox="0 0 100 125"
      className={`coach-artwork study-artwork fantasy-artwork fantasy-${character}`}
      style={vars}
    >
      <Accents expression={expression} />
      <BodyRig>{children}</BodyRig>
    </ArtworkSvg>
  );
}
