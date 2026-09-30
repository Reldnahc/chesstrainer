import type { ReactNode } from "react";
import "./stat-list.css";

export default function StatList({ items, prominence = "normal" }: {
  items: readonly { label: string; value: ReactNode }[];
  prominence?: "normal" | "featured";
}) {
  return <dl className={`stat-list${prominence === "featured" ? " stat-list--featured" : ""}`}>{items.map(({label, value}) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>,
  )}</dl>;
}
