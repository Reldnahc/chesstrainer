import { useId, type ReactNode } from "react";
import { useEyeClosure } from "../CoachFaceContext";
import type { CoachExpression } from "../model";
import type { Pose } from "./poses";

/**
 * A human coach's own eyes, brows and nose. Every field is optional and the
 * defaults reproduce the original shared face, which Walter keeps. Eye centres,
 * blink, gaze and the closed-eye shapes stay shared, so the reaction and idle
 * rigs and the speech mouth are unaffected by a coach's choices.
 */
export type HumanFaceStyle = {
  /** Round keeps the original ellipse; the others tip the outer corner. */
  shape?: "round" | "almond" | "upturned" | "downturned";
  /** Eye half-width (default 4.2) and a multiplier on each expression's eye height. */
  width?: number;
  height?: number;
  /** Coloured iris behind a slightly smaller pupil; omitted keeps the plain dark pupil. */
  iris?: string;
  irisRadius?: number;
  /** How far a resting upper lid covers the eye (0–1). It lifts as an expression widens the eyes. */
  lid?: number;
  /** Skin tone for lids and smiling lower lids. */
  skin?: string;
  /** An upper lash line, optionally with an outer flick. */
  liner?: "line" | "flick";
  /** The original one-stroke outer lash. */
  lash?: boolean;
  /** Lower lids lifted by the cheeks in smiling expressions. */
  smileLids?: boolean;
  /** A thin upper-lid crease in this colour. */
  crease?: string;
  /** A second, smaller catchlight. */
  sparkle?: boolean;
  /** Fine lines at the outer corners in this colour. */
  creases?: string;
  brows?: {
    weight?: number;
    /** Vertical arch multiplier: below 1 flattens, above 1 arches. */
    arch?: number;
    width?: number;
    /** Degrees; positive raises the outer ends. */
    angle?: number;
    offset?: number;
    /** Lifts the screen-right brow only, for a habitual raised brow. */
    raise?: number;
  };
  nose?: keyof typeof noses;
};

const smiling: readonly CoachExpression[] = [
  "brilliant", "great", "best", "good", "winning", "recovered", "encouraging",
];
const noses = {
  hook: "M39 43q-2 7 1 7h2",
  button: "M38.4 48.4q1.6 1.9 3.2 0",
  long: "M40 41.5q-1.6 7.5-.4 8.7.9.6 2.6.1",
  broad: "M37.4 48.2q.4 2 2.6 1.8 2.2.2 2.6-1.8M40 43.5v2.4",
} as const;

function eyeOutline(cx: number, rx: number, ry: number, shape: HumanFaceStyle["shape"]) {
  const tip = shape === "upturned" ? -0.9 : shape === "downturned" ? 0.9 : 0;
  const outward = cx < 40 ? -1 : 1;
  const inner = cx - outward * rx;
  const outer = cx + outward * rx;
  const upper = `M${inner} 42.3Q${cx} ${42 - ry * 1.9} ${outer} ${42 + tip}`;
  return { path: `${upper}Q${cx} ${42 + ry * 1.55} ${inner} 42.3Z`, upper, inner, outer, outward };
}

export default function HumanFeatures({
  pose,
  expression,
  browColor = "#797469",
  noseColor = "#c79572",
  mouthColor = "#75473e",
  glasses = true,
  mouth,
  face = {},
}: {
  pose: Pose;
  expression: CoachExpression;
  browColor?: string;
  noseColor?: string;
  mouthColor?: string;
  glasses?: boolean;
  mouth?: ReactNode;
  face?: HumanFaceStyle;
}) {
  const eyeClip = useId();
  const closedEyes = useEyeClosure(pose.closedEyes);
  const rx = face.width ?? 4.2;
  const ry = pose.eye * (face.height ?? 1);
  const shaped = !!face.shape && face.shape !== "round";
  const outlines = [30, 50].map((cx) => eyeOutline(cx, rx, ry, face.shape));
  const whites = [30, 50].map((cx, i) => shaped
    ? <path key={cx} d={outlines[i].path} />
    : <ellipse key={cx} cx={cx} cy="42" rx={rx} ry={ry} />);
  // Lids rest at their authored depth and clear completely by the widest (shocked) eyes.
  const lid = (face.lid ?? 0) * Math.max(0, Math.min(1, (5.1 - pose.eye) / 1.3));
  const smileLids = !!face.smileLids && smiling.includes(expression);
  const irisRadius = face.irisRadius ?? 2.4;
  const pupil = face.iris ? irisRadius * 0.62 : 2;
  const brow = face.brows;
  const browTransform = (cx: number, side: -1 | 1) => brow && [
    `translate(${cx} 31)`,
    `rotate(${(brow.angle ?? 0) * -side})`,
    `scale(${brow.width ?? 1} ${brow.arch ?? 1})`,
    `translate(${-cx} ${-31 + (brow.offset ?? 0) - (side === 1 ? brow.raise ?? 0 : 0)})`,
  ].join(" ");
  return (
    <>
      {pose.blush && (
        <g fill="#df9783" opacity=".3">
          <ellipse cx="24" cy="51" rx="5" ry="2.5" />
          <ellipse cx="56" cy="51" rx="5" ry="2.5" />
        </g>
      )}
      <g
        className="coach-brows"
        fill="none"
        stroke={browColor}
        strokeWidth={brow?.weight ?? 2.3}
        strokeLinecap="round"
      >
        <g className="coach-idle-brows">
          <path className="coach-brow-left" d={pose.brows[0]} transform={browTransform(30, -1)} />
          <path className="coach-brow-right" d={pose.brows[1]} transform={browTransform(50, 1)} />
        </g>
      </g>
      {face.creases && !closedEyes && (
        <g className="coach-eye-creases" fill="none" stroke={face.creases} strokeWidth=".7" strokeLinecap="round" opacity=".7">
          <path d={`M${30 - rx - 1.2} 40.6q-1.4 1.6 0 3.4`} />
          <path d={`M${50 + rx + 1.2} 40.6q1.4 1.6 0 3.4`} />
        </g>
      )}
      <g className="coach-eyes" data-eye-state={closedEyes ? "closed" : "open"}>
        {closedEyes ? (
          <g
            fill="none"
            stroke="#393c42"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <path
              d={expression === "mistake" ? "M26 42q4 3 8-1" : "M26 43q4-5 8 0"}
            />
            <path
              d={expression === "mistake" ? "M46 41q4 4 8 1" : "M46 43q4-5 8 0"}
            />
          </g>
        ) : (
          <>
            <g fill="#fff7e8">{whites}</g>
            <defs>
              <clipPath id={eyeClip}>{whites}</clipPath>
            </defs>
            <g clipPath={`url(#${eyeClip})`}>
              <g className="coach-gaze">
                <g transform={`translate(${pose.gaze.join(" ")})`}>
                  {[30, 50].map((cx) => (
                    <g key={cx}>
                      {face.iris && <circle cx={cx} cy="42" r={irisRadius} fill={face.iris} />}
                      <ellipse
                        cx={cx}
                        cy="42"
                        rx={pupil}
                        ry={face.iris ? pupil : Math.min(2.5, pose.eye - 0.4)}
                        fill="#393c42"
                      />
                      <circle cx={cx - 0.6} cy="41.2" r=".65" fill="#fff" />
                      {face.sparkle && <circle cx={cx + 0.8} cy="42.9" r=".35" fill="#fff" />}
                    </g>
                  ))}
                </g>
              </g>
              {lid > 0 && (
                <g fill={face.skin}>
                  {[30, 50].map((cx) => (
                    <rect key={cx} x={cx - rx - 1} y={41 - ry * 2} width={rx * 2 + 2} height={ry + 1 + ry * 2 * lid} />
                  ))}
                </g>
              )}
              {smileLids && (
                <g fill={face.skin}>
                  {[30, 50].map((cx) => (
                    <path key={cx} d={`M${cx - rx - 1} ${42 + ry + 1}Q${cx} ${42 + ry * 0.5} ${cx + rx + 1} ${42 + ry + 1}Z`} />
                  ))}
                </g>
              )}
            </g>
            {lid > 0 && (
              <g stroke="#393c42" strokeWidth="1.1" strokeLinecap="round">
                {[30, 50].map((cx) => <path key={cx} d={`M${cx - rx + 0.3} ${42 - ry + ry * 2 * lid}h${rx * 2 - 0.6}`} />)}
              </g>
            )}
            {face.liner && (
              <g fill="none" stroke="#2c272a" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                {outlines.map((outline, i) => {
                  const upper = shaped ? outline.upper
                    : `M${outline.inner} 42A${rx} ${ry} 0 0 ${i} ${outline.outer} 42`;
                  const flick = face.liner === "flick" ? `l${outline.outward * 1.6} -1.4` : "";
                  return <path key={i} d={upper + flick} />;
                })}
              </g>
            )}
            {face.lash && (
              <path d="m25 41-1.3-1m30 1 1.3-1" stroke={browColor} strokeWidth="1.1" strokeLinecap="round" />
            )}
            {face.crease && (
              <g fill="none" stroke={face.crease} strokeWidth=".8" strokeLinecap="round">
                {[30, 50].map((cx) => <path key={cx} d={`M${cx - rx + 0.6} ${42 - ry - 1.3}q${rx - 0.6}-2 ${rx * 2 - 1.2} 0`} />)}
              </g>
            )}
            {smileLids && (
              <g fill="none" stroke="#393c42" strokeWidth=".7" opacity=".5">
                {[30, 50].map((cx) => <path key={cx} d={`M${cx - rx} ${42 + ry * 0.75}Q${cx} ${42 + ry * 0.4} ${cx + rx} ${42 + ry * 0.75}`} />)}
              </g>
            )}
          </>
        )}
      </g>
      <path
        className="coach-nose"
        d={noses[face.nose ?? "hook"]}
        fill="none"
        stroke={noseColor}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {mouth ?? <HumanMouth pose={pose} expression={expression} mouthColor={mouthColor} />}
      {glasses && (
        <g
          className="coach-glasses"
          fill="none"
          stroke="#393c42"
          strokeWidth="2.2"
        >
          <rect x="22" y="35" width="15" height="13" rx="4.5" />
          <rect x="43" y="35" width="15" height="13" rx="4.5" />
          <path d="M37 40q3-2 6 0M17 37l5 2m36 0 5-2" />
          <path
            className="coach-lens-glint"
            d="m25 39 3-1m19 1 3-1"
            stroke="#fff"
            strokeWidth="1.3"
            opacity=".55"
          />
        </g>
      )}
    </>
  );
}

// Shared authored expression, also used as the exact resting fallback by an
// articulated mouth. A speaking coach supplies its own geometry through the slot.
export function HumanMouth({ pose, expression, mouthColor = "#75473e" }: {
  pose: Pose;
  expression: CoachExpression;
  mouthColor?: string;
}) {
  return <g className="coach-mouth">
    <path
      d={pose.mouth}
      fill={mouthColor}
      stroke={mouthColor}
      strokeWidth=".65"
      strokeLinejoin="round"
    />
    {pose.open &&
      [
        "brilliant",
        "great",
        "winning",
        "recovered",
        "encouraging",
        "explaining",
      ].includes(expression) && (
        <path d="M34 56q6 2 12 0l-1 3H35Z" fill="#fff7e8" />
      )}
    {pose.open &&
      ["brilliant", "winning", "recovered"].includes(expression) && (
        <path d="M36 65q4-3 8 0-4 3-8 0" fill="#d58c7e" />
      )}
  </g>;
}
