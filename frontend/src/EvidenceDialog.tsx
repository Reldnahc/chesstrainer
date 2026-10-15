import { useState } from "react";
import { X } from "lucide-react";
import { api, errorMessage, read, type Schema } from "./api";
import Board from "./Board";
import Button, { IconButton } from "./Button";
import { scoreText } from "./evaluation";
import { sideToMove } from "./fen";
import useModalDialog from "./useModalDialog";
import Notice from "./Notice";
import Reveal from "./Reveal";
import { QueryResult, useQuery } from "./useQuery";
export default function EvidenceDialog({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [audit, setAudit] = useState<Schema["ClassificationAudit"] | null>(null);
  const [rejecting, setRejecting] = useState(false);
  // The dialog shows its own failures: a page banner would sit behind the modal.
  const [error, setError] = useState("");
  const fail = (e: unknown) => setError(errorMessage(e));
  const dialog = useModalDialog(onClose);
  const evidence = useQuery(signal => read(api.GET("/api/evidence/{decision_id}", {
    signal, params: { path: { decision_id: id } },
  })), [id]);
  return (
    <dialog
      {...dialog}
      aria-label="Decision evidence"
      className="evidence-dialog panel"
    >
      <div className="row-between">
        <div>
          <div className="eyebrow">GAME EVIDENCE</div>
          <h2>Decision evidence</h2>
        </div>
        <IconButton
          variant="quiet"
          onClick={onClose}
          aria-label="Close evidence"
        >
          <X />
        </IconButton>
      </div>
      <Reveal>{error && <Notice announcement="alert" tone="error" appearance="inline">{error}</Notice>}</Reveal>
      <QueryResult query={evidence} label="the evidence">{data => (
        <div className="evidence-grid">
          <Board
            fen={data.fen}
            orientation={sideToMove(data.fen)}
            disabled
          />
          <div>
            <h3>You played {data.played_san}</h3>
            <p>
              {data.allows_mate
                ? "The engine found a forced mate for the opponent."
                : data.mate_lost
                  ? "The move gave up a forced mate the engine found."
                  : `Estimated loss: ${((data.loss_cp || 0) / 100).toFixed(2)} pawns.`}
            </p>
            <h3>Engine candidates</h3>
            {data.candidates.map((c) => (
              <div className="candidate" key={c.san}>
                <strong>{c.san}</strong>
                {/* Side-to-move scores at the audit's two decimals, with the typographic minus. */}
                <span>{c.score.kind === "mate" ? `Mate ${c.score.value}` : scoreText(c.score)}</span>
                <code>{c.pv.join(" ")}</code>
              </div>
            ))}
            {data.classifications.map((c) => (
              <div className="interpretation" key={c.skill}>
                <span className="eyebrow">
                  {c.provider === "local_rules"
                    ? "LOCAL RULE FINDING"
                    : "HISTORICAL CLASSIFICATION"}
                </span>
                <p>{c.explanation}</p>
                <Button
                  variant="quiet" size="compact"
                  onClick={() =>
                    read(
                      api.GET("/api/classification-runs/{run_id}", {
                        params: { path: { run_id: c.run_id } },
                      }),
                    )
                      .then(setAudit)
                      .catch(fail)
                  }
                >
                  View classification audit
                </Button>
                <Button
                  variant="quiet" size="compact"
                  disabled={rejecting}
                  onClick={() => {
                    if (rejecting) return;
                    setRejecting(true);
                    setError("");
                    read(
                      api.POST("/api/classification-runs/{run_id}/reject", {
                        params: { path: { run_id: c.run_id } },
                      }),
                    )
                      .then(() =>
                        read(
                          api.GET("/api/evidence/{decision_id}", {
                            params: { path: { decision_id: id } },
                          }),
                        ),
                      )
                      .then(evidence.setData)
                      .catch(fail)
                      .finally(() => setRejecting(false));
                  }}
                >
                  Reject unsupported classification
                </Button>
              </div>
            ))}
            {audit && (
              <pre className="audit">{JSON.stringify(audit, null, 2)}</pre>
            )}
          </div>
        </div>
      )}</QueryResult>
    </dialog>
  );
}
