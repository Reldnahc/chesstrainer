import type { ReactNode } from "react";
import { relativeDue } from "./relativeDue";
import "./recall-receipt.css";

/** Callers own scheduling conditions and their domain-specific explanations. */
export default function RecallReceipt({ message, nextDue }: {
  message?: ReactNode;
  nextDue?: string | null;
}) {
  return <div className="review-schedule">
    {message && <p className="review-due" role="status">
      {message}
      {nextDue && <> Next review: <time dateTime={nextDue} title={new Date(nextDue).toLocaleString()}>
        {relativeDue(nextDue, Date.now())}
      </time>.</>}
    </p>}
  </div>;
}
