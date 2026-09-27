import type { ReactNode } from "react";
import MoveSymbol from "./MoveSymbol";

export default function MoveBadge({ label, children }: { label: string; children?: ReactNode }) {
  return <span className={`move-badge label-${label.toLowerCase()}`}>
    <b aria-hidden="true"><MoveSymbol label={label}/></b>{children ?? label}
  </span>;
}
