import MoveSymbol from "./MoveSymbol";

export default function MoveBadge({ label }: { label: string }) {
  return <span className={`move-badge label-${label.toLowerCase()}`}>
    <b aria-hidden="true"><MoveSymbol label={label}/></b>{label}
  </span>;
}
