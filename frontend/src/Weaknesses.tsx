import EmptyState from "./EmptyState";
import { useEffect, useState } from "react";
import { ChevronRight, Flag } from "lucide-react";
import { api, read, type Schema } from "./api";
import PageTitle from "./PageTitle";
import Button from "./Button";
import ActionLink from "./ActionLink";
import { studyPaths } from "./navigation";

export default function WeaknessScreen({
  onEvidence,
  fail,
}: {
  onEvidence: (id: string) => void;
  fail: (e: unknown) => void;
}) {
  const [data, setData] = useState<Schema["Weaknesses"] | null>(null);
  useEffect(() => {
    let active = true;
    read(api.GET("/api/weaknesses"))
      .then((value) => {
        if (active) setData(value);
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [fail]);
  return (
    <>
      <PageTitle eyebrow="YOUR TRAINING FOCUS" title="Weaknesses" />
      {!data ? (
        <p role="status">Loading your evidence...</p>
      ) : (
        <>
          {!data.skills.length && (
            <EmptyState title="No supported weaknesses yet." icon={<Flag />}>
                Classify saved games in Settings. Positions remain available in
                Review even when their cause is unclear.
            </EmptyState>
          )}
          {(["mechanism", "outcome"] as const).map((kind) => {
            const skills = data.skills.filter((skill) => skill.kind === kind);
            return (
              skills.length > 0 && (
                <section
                  className="weakness-section"
                  key={kind}
                  aria-label={
                    kind === "mechanism"
                      ? "Tactical patterns"
                      : "Material and mate outcomes"
                  }
                >
                  <h2>
                    {kind === "mechanism"
                      ? "Tactical patterns"
                      : "Material & mate outcomes"}
                  </h2>
                  {kind === "outcome" && (
                    <p className="small muted">
                      These describe what happened. A specific tactical cause
                      may still be unknown.
                    </p>
                  )}
                  <div className="panel weakness-list">
                    {skills.map((skill) => (
                      <div className="weakness" key={skill.skill_id}>
                        <div>
                          <span className="eyebrow">
                            {skill.provisional
                              ? "EARLY EVIDENCE"
                              : "ACROSS SEVERAL GAMES"}
                          </span>
                          <h3>{skill.title}</h3>
                          <p>
                            {skill.unique_positions} positions /{" "}
                            {skill.independent_games} games / {skill.reviews}{" "}
                            scheduled reviews
                          </p>
                          <p className="practice-cue">{skill.cue}</p>
                          {skill.focused_attempts > 0 && (
                            <p className="small">
                              Recent focused practice:{" "}
                              {skill.focused_attempts - skill.focused_failures}{" "}
                              clean solves from {skill.focused_attempts}{" "}
                              attempts.
                            </p>
                          )}
                          <details className="disclosure">
                            <summary>
                              Browse supporting positions (
                              {skill.decision_ids.length})
                            </summary>
                            <div className="evidence-links">
                              {skill.decision_ids.map((id, index) => (
                                <Button size="compact" key={id} onClick={() => onEvidence(id)}>
                                  Example {index + 1}
                                  <ChevronRight size={15} />
                                </Button>
                              ))}
                            </div>
                          </details>
                        </div>
                        {skill.practice_positions ? <ActionLink
                          variant="secondary"
                          href={`${studyPaths.due}?focus=${encodeURIComponent(skill.skill_id)}`}
                        >
                          Practice {skill.practice_positions} positions
                        </ActionLink> : <Button variant="secondary" disabled>No active positions</Button>}
                      </div>
                    ))}
                  </div>
                </section>
              )
            );
          })}
          <p className="small muted">
            Focused practice uses up to 12 distinct positions from several games
            where available. It saves attempts separately and leaves FSRS
            schedules unchanged.
          </p>
        </>
      )}
    </>
  );
}
