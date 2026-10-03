import type { DialogueIntent } from "../dialogue/model";
import type { Position, Report } from "./types";

export type MovesLineFacts = {
  opening?: string;
  reply?: { side: "White" | "Black"; san: string };
  qualifier?: string;
};

/** Concrete moves the spoken line leaves out, read from report and position
 * facts only, never from rendered prose. Null when there is nothing to show. */
export function movesLineFacts({report, frame, intent}: {
  report?: Report | null; frame?: Position | null; intent: DialogueIntent;
}): MovesLineFacts | null {
  if (!report || !frame || report.actual.san !== frame.san) return null;
  const facts: MovesLineFacts = {};
  const opening = report.opening?.name?.trim();
  if (opening) facts.opening = opening;
  const reply = report.immediate_reply;
  if (reply?.san && !frame.termination) {
    facts.reply = { side: frame.turn === "white" ? "White" : "Black", san: reply.san };
    // A qualifier needs a claim that proves it; the SAN alone stays unqualified.
    if (intent.claims.some(item => item.code === "allowed_mate")) facts.qualifier = "forced mate";
  }
  return facts.opening || facts.reply ? facts : null;
}

/** The game review bubble's moves line: it wraps rather than truncating. The
 * reply is the engine's strongest answer, not the game's next move, so it is
 * named as such. It is supplementary, not a second live region: each move is
 * announced once, by the bubble's text. */
export default function CoachMovesLine({facts}: {facts: MovesLineFacts}) {
  return <p className="coach-moves-line">
    {facts.opening && <span>{facts.opening}</span>}
    {facts.opening && facts.reply && " · "}
    {facts.reply && <span>{facts.reply.side}’s strongest reply: <strong>{facts.reply.san}</strong>{facts.qualifier && `, ${facts.qualifier}`}</span>}
  </p>;
}
