import { useId, type CSSProperties, type ReactNode } from "react";
import { ArtworkSvg, BodyRig } from "../../ArtworkRig";
import { useEyeClosure } from "../../CoachFaceContext";
import type { CoachExpression } from "../../model";
import type { AnimalPose } from "../../studies/animalPoses";
import Accents from "../../studies/Accents";
import "../../studies/motion.css";
import "./animals.css";

export function AnimalFrame({
  name,
  expression,
  pose,
  temperament,
  children,
}: {
  name: string;
  expression: CoachExpression;
  pose: AnimalPose;
  temperament: number;
  children: ReactNode;
}) {
  return (
    <ArtworkSvg
      viewBox="0 0 100 125"
      className={`coach-artwork study-artwork cast-${name}`}
      style={
        {
          "--study-tilt": `${pose.tilt}deg`,
          "--study-lift": `${pose.lift}px`,
          "--study-temperament": temperament,
        } as CSSProperties
      }
    >
      <Accents expression={expression} />
      <BodyRig>{children}</BodyRig>
    </ArtworkSvg>
  );
}

export { HeadRig as AnimalHead } from "../../ArtworkRig";

// Eye mechanics are shared; head silhouette, eye placement, muzzle, mouth and
// the expressive pose adjustments remain species-specific in each artwork.
export function AnimalEyes({
  pose,
  xs = [35, 65],
  y = 43,
  width = 5.5,
  height = pose.eye,
  iris = "#ab8b51",
  lid = "#38352f",
  pupilWidth = 2.5,
}: {
  pose: AnimalPose;
  xs?: readonly [number, number];
  y?: number;
  width?: number;
  height?: number;
  iris?: string;
  lid?: string;
  pupilWidth?: number;
}) {
  const mask = useId();
  const closedEyes = useEyeClosure(pose.closed);
  return (
    <g className="animal-eyes" data-eye-state={closedEyes ? "closed" : "open"}>
      {closedEyes ? (
        <g
          className="study-gaze"
          fill="none"
          stroke={lid}
          strokeWidth="2"
          strokeLinecap="round"
        >
          {xs.map((x) => (
            <path
              key={x}
              d={`M${x - width} ${y}q${width} ${pose.mouth === "concern" ? 4 : -4} ${width * 2} 0`}
            />
          ))}
        </g>
      ) : (
        <>
          <defs>
            <clipPath id={mask}>
              {xs.map((x) => (
                <ellipse key={x} cx={x} cy={y} rx={width} ry={height} />
              ))}
            </clipPath>
          </defs>
          {xs.map((x) => (
            <ellipse key={x} cx={x} cy={y} rx={width} ry={height} fill="#fff4dc" />
          ))}
          <g clipPath={`url(#${mask})`}>
            <g className="study-gaze">
              <g transform={`translate(${pose.gaze.join(" ")})`}>
                {xs.map((x) => (
                  <g key={x}>
                    <ellipse
                      cx={x}
                      cy={y}
                      rx={Math.min(width - 0.8, pupilWidth + 1.7)}
                      ry={height + 1}
                      fill={iris}
                    />
                    <ellipse
                      cx={x}
                      cy={y}
                      rx={pupilWidth}
                      ry={Math.max(2.5, height - 0.6)}
                      fill="#262d29"
                    />
                    <circle
                      className="study-eye-glint"
                      cx={x - 1}
                      cy={y - 1.1}
                      r="1.1"
                      fill="#fffdf3"
                    />
                  </g>
                ))}
              </g>
            </g>
          </g>
          {xs.map((x) => (
            <path
              key={x}
              d={`M${x - width} ${y}q${width} ${-height * 1.7} ${width * 2} 0`}
              stroke={lid}
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </>
      )}
    </g>
  );
}

export function AnimalBrows({ pose, color, weight = 2.4 }: {
  pose: AnimalPose;
  color: string;
  weight?: number;
}) {
  return (
    <g
      className="study-brows"
      fill="none"
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
    >
      <path d={pose.brows[0]} />
      <path d={pose.brows[1]} />
    </g>
  );
}
