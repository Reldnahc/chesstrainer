import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, read, type Evidence, type Schema } from "./api";
import Board from "./Board";
import Button, { IconButton } from "./Button";
import useModalDialog from "./useModalDialog";
import { LoadingState } from "./LoadState";
export default function EvidenceDialog({
  id,
  onClose,
  fail,
}: {
  id: string;
  onClose: () => void;
  fail: (e: unknown) => void;
}) {
  const [data, setData] = useState<Evidence | null>(null),
    [audit, setAudit] = useState<Schema["ClassificationAudit"] | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const dialog = useModalDialog(onClose);
  useEffect(() => {
    let active = true;
    read(
      api.GET("/api/evidence/{decision_id}", {
        params: { path: { decision_id: id } },
      }),
    )
      .then((value) => { if (active) setData(value); })
      .catch((e) => { if (active) fail(e); });
    return () => { active = false; };
  }, [id, fail]);
  return (
    <dialog
      {...dialog}
      aria-label="Decision evidence"
      className="evidence-dialog panel"
    >
      <div className="row-between">
        <div>
          <div className="eyebrow">VERIFIED GAME EVIDENCE</div>
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
      {data ? (
        <div className="evidence-grid">
          <Board
            fen={data.fen}
            orientation={data.fen.split(" ")[1] === "w" ? "white" : "black"}
            disabled
          />
          <div>
            <h3>You played {data.played_san}</h3>
            <p>
              {data.allows_mate
                ? "The engine found a forced mate for the opponent."
                : data.mate_lost
                  ? "The move gave up a verified forced mate."
                  : `Estimated loss: ${((data.loss_cp || 0) / 100).toFixed(2)} pawns.`}
            </p>
            <h3>Engine candidates</h3>
            {data.candidates.map((c) => (
              <div className="candidate" key={c.san}>
                <strong>{c.san}</strong>
                <span>
                  {c.score.kind === "mate"
                    ? `Mate ${c.score.value}`
                    : (c.score.value / 100).toFixed(2)}
                </span>
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
                      .then(setData)
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
      ) : (
        <LoadingState>Loading evidence…</LoadingState>
      )}
    </dialog>
  );
}
