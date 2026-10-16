import type { ReactNode } from "react";
import MoveSymbol from "./MoveSymbol";

/** size="small" is the badge in variation rows; size="inline" takes the size of
 *  the text around it (the review summary table). */
export default function MoveBadge({
  label,
  size = "ordinary",
  children,
}: {
  label: string;
  size?: "ordinary" | "small" | "inline";
  children?: ReactNode;
}) {
  return (
    <span
      className={[
        "move-badge",
        size !== "ordinary" && `move-badge--${size}`,
        `label-${label.toLowerCase()}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <b aria-hidden="true">
        <MoveSymbol label={label} />
      </b>
      {children ?? label}
    </span>
  );
}
