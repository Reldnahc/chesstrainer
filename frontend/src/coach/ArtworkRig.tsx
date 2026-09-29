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
    <svg
      viewBox={viewBox}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
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
