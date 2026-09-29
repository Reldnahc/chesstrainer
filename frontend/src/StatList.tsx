import type { ReactNode } from "react";
import "./stat-list.css";

export default function StatList({ items }: { items: readonly { label: string; value: ReactNode }[] }) {
  return <dl className="stat-list">{items.map(({label, value}) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>,
  )}</dl>;
}
