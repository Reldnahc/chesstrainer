import type { CoachExpression } from "../model";

export default function Accents({
  expression,
}: {
  expression: CoachExpression;
}) {
  return (
    <g className="study-accents" fill="none" strokeLinecap="round">
      {(expression === "brilliant" || expression === "winning") && (
        <g className="study-stars" fill="#f4d98b">
          <path d="m12 18 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
          <path d="m86 10 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" />
          <path d="m89 52 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
        </g>
      )}
      {expression === "blunder" && (
        <g className="study-surprise" stroke="#dda99a" strokeWidth="2">
          <path d="m8 34-4-3m8-4-2-5m79 12 4-3m-7-4 2-5" />
        </g>
      )}
      {expression === "uncertain" && (
        <g stroke="#cad0ba" strokeWidth="2">
          <path d="M86 24q0-5 4-4t-1 7v2" />
          <circle cx="89" cy="33" r=".8" fill="#cad0ba" stroke="none" />
        </g>
      )}
    </g>
  );
}
