import type { CSSProperties, ReactNode } from "react";

export function ArtworkSvg({
  viewBox,
  className,
  style,
  children,
}: {
  viewBox: string;
  className: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <svg viewBox={viewBox} className={className} style={style} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** The pose variables every study artwork's motion stylesheet reads. Each
 * artwork passes the tilt and lift it means; some scale them by temperament. */
export function studyStyle(tilt: number, lift: number, temperament: number): CSSProperties {
  return {
    "--study-tilt": `${tilt}deg`,
    "--study-lift": `${lift}px`,
    "--study-temperament": temperament,
  } as CSSProperties;
}

/** The shared study frame: the artwork svg with its pose variables, whatever
 * sits behind the body (accents), the body rig, and anything drawn over it. */
export function StudyFrame({
  className,
  viewBox = "0 0 100 125",
  tilt,
  lift,
  temperament,
  accents,
  overlay,
  children,
}: {
  className: string;
  viewBox?: string;
  tilt: number;
  lift: number;
  temperament: number;
  accents?: ReactNode;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ArtworkSvg viewBox={viewBox} className={className} style={studyStyle(tilt, lift, temperament)}>
      {accents}
      <BodyRig>{children}</BodyRig>
      {overlay}
    </ArtworkSvg>
  );
}

// Reaction, idle and authored pose transforms need separate layers so one
// animation never replaces another's transform or changes the artwork origin.
export function BodyRig({ children }: { children: ReactNode }) {
  return (
    <g className="study-body">
      <g className="study-body-idle">{children}</g>
    </g>
  );
}

export function HeadRig({ children }: { children: ReactNode }) {
  return (
    <g className="study-head">
      <g className="study-head-idle">
        <g className="study-head-pose">{children}</g>
      </g>
    </g>
  );
}
