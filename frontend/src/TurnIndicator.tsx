import type { ReactNode } from "react";
import "./turn-indicator.css";

export default function TurnIndicator({ color, children }: { color: "white" | "black"; children: ReactNode }) {
  return <span><span className={`turn-dot${color === "black" ? " black" : ""}`} aria-hidden="true" />{children}</span>;
}
