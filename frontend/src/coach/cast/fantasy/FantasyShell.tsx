import type { CSSProperties, ReactNode } from "react";
import type { CoachExpression } from "../../model";
import type { AnimalPose } from "../../studies/animalPoses";
import Accents from "../../studies/Accents";
import "../../studies/motion.css";
import "./fantasy.css";

export function FantasyHead({ children }: { children: ReactNode }) {
  return (
    <g className="study-head">
      <g className="study-head-idle">
        <g className="study-head-pose">{children}</g>
      </g>
    </g>
  );
}

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
    <svg
      viewBox="0 0 100 125"
      className={`coach-artwork study-artwork fantasy-artwork fantasy-${character}`}
      style={vars}
      aria-hidden="true"
      focusable="false"
    >
      <Accents expression={expression} />
      <g className="study-body">
        <g className="study-body-idle">{children}</g>
      </g>
    </svg>
  );
}
