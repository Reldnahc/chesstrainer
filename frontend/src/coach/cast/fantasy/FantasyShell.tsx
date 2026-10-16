import type { ReactNode } from "react";
import { StudyFrame } from "../../ArtworkRig";
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
  return (
    <StudyFrame
      className={`coach-artwork study-artwork fantasy-artwork fantasy-${character}`}
      tilt={pose.tilt}
      lift={pose.lift}
      temperament={temperament}
      accents={<Accents expression={expression} />}
    >
      {children}
    </StudyFrame>
  );
}
