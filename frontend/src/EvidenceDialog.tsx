import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api, read, type Evidence, type Schema } from "./api";
import Board from "./Board";
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
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    read(
      api.GET("/api/evidence/{decision_id}", {
        params: { path: { decision_id: id } },
      }),
    )
      .then(setData)
      .catch(fail);
  }, [id, fail]);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      aria-label="Decision evidence"
      className="evidence-dialog panel"
    >
      <div className="row-between">
        <div>
          <div className="eyebrow">VERIFIED GAME EVIDENCE</div>
          <h2>Decision evidence</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close evidence"
        >
          <X />
        </button>
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
                <button
                  className="text-button small"
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
                </button>
                <button
                  className="text-button small"
                  onClick={() =>
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
                  }
                >
                  Reject unsupported classification
                </button>
              </div>
            ))}
            {audit && (
              <pre className="audit">{JSON.stringify(audit, null, 2)}</pre>
            )}
          </div>
        </div>
      ) : (
        <p>Loading evidence…</p>
      )}
    </dialog>
  );
}
