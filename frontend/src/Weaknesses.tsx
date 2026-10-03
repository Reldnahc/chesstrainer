import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, Flag } from "lucide-react";
import { api, read, type Schema } from "./api";
import PageTitle from "./PageTitle";
import SectionNavigation from "./SectionNavigation";
import StatList from "./StatList";
import EmptyState from "./EmptyState";
import { LoadingState, UnavailableState } from "./LoadState";
import Button from "./Button";
import ActionLink from "./ActionLink";
import { insightsPaths, studyPaths, type InsightsSection } from "./navigation";
import GameInsights from "./GameInsights";

function WeaknessCard({ skill, onEvidence }: {
  skill: Schema["SkillPriority"];
  onEvidence: (id: string) => void;
}) {
  return <article className="panel weakness" aria-labelledby={`weakness-${skill.skill_id}`}>
    <div className="weakness-heading">
      <h3 id={`weakness-${skill.skill_id}`}>{skill.title}</h3>
      <span className="badge">{skill.provisional ? "Early evidence" : "Across several games"}</span>
    </div>
    <p className="weakness-cue">{skill.cue}</p>
    <StatList items={[
      { label: "Positions", value: skill.unique_positions },
      { label: "Games", value: skill.independent_games },
      { label: "Scheduled reviews", value: skill.reviews },
    ]} />
    <div className="weakness-practice">
      {skill.focused_attempts > 0 && <p className="small">
        <strong>{skill.focused_attempts - skill.focused_failures} / {skill.focused_attempts}</strong> clean solves in recent focused practice
      </p>}
      {skill.practice_positions ? <ActionLink variant="secondary"
        href={`${studyPaths.due}?focus=${encodeURIComponent(skill.skill_id)}`}>
        Practice {skill.practice_positions} {skill.practice_positions === 1 ? "position" : "positions"}
        <ArrowRight size={16} aria-hidden="true" />
      </ActionLink> : <Button variant="secondary" disabled>No active positions</Button>}
    </div>
    {skill.decision_ids.length > 0 && <details className="disclosure weakness-evidence">
      <summary>Browse supporting positions ({skill.decision_ids.length})</summary>
      <div className="evidence-links">
        {skill.decision_ids.map((id, index) => <Button variant="secondary" size="compact" key={id} onClick={() => onEvidence(id)}>
          Example {index + 1}<ChevronRight size={15} aria-hidden="true" />
        </Button>)}
      </div>
    </details>}
  </article>;
}

export default function InsightsScreen({ onEvidence, category }: {
  onEvidence: (id: string) => void;
  category: InsightsSection;
}) {
  const [data, setData] = useState<Schema["Weaknesses"] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const overview = category === "overview";
  // Weakness evidence loads on first visit to a weakness section and is reused after.
  const wanted = !overview || data !== null || error;
  useEffect(() => {
    if (!wanted) return;
    const controller = new AbortController();
    setError(false);
    read(api.GET("/api/weaknesses", { signal: controller.signal }))
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt, wanted]);
  const kind = category === "patterns" ? "mechanism" : "outcome";
  const skills = data?.skills.filter(skill => skill.kind === kind) ?? [];
  const title = category === "patterns" ? "Tactical patterns" : "Material & mate outcomes";
  const countLabel = category === "patterns" ? "pattern" : "outcome";

  return <>
    <PageTitle eyebrow="WHAT YOUR GAMES SAY" title="Insights" />
    <SectionNavigation label="Insight sections" current={category} items={[
      { id: "overview", label: "Overview", href: insightsPaths.overview },
      { id: "patterns", label: "Tactical patterns", href: insightsPaths.patterns },
      { id: "outcomes", label: "Material & mate", href: insightsPaths.outcomes },
    ]} />
    <div className="weakness-content">
      {overview ? <GameInsights /> : error ? <UnavailableState presentation="panel" actions={<Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}>
        Couldn’t load your weaknesses. Please try again.
      </UnavailableState> : !data ? <LoadingState presentation="panel">Loading your evidence…</LoadingState>
        : !data.skills.length ? <EmptyState title="No supported weaknesses yet." icon={<Flag />} actions={
          <ActionLink variant="secondary" href="/settings?section=advanced">Training settings</ActionLink>
        }>
          Classify saved games in Settings. Your positions are still available in Due.
        </EmptyState> : <section className="weakness-section" aria-labelledby="weakness-category-title">
          <div className="weakness-section-heading">
            <h2 id="weakness-category-title">{title}</h2>
            <span className="small muted">{skills.length} {countLabel}{skills.length === 1 ? "" : "s"}</span>
          </div>
          {skills.length ? <>
            <div className="weakness-list">
              {skills.map(skill => <WeaknessCard key={skill.skill_id} skill={skill} onEvidence={onEvidence} />)}
            </div>
            <p className="weakness-practice-note">Focused practice uses up to 12 positions and leaves your review schedule unchanged.</p>
          </> : <EmptyState title={category === "patterns" ? "No tactical patterns yet." : "No material or mate outcomes yet."} icon={<Flag />}>
            No supported evidence in this category yet. Try the other category to see your available practice.
          </EmptyState>}
        </section>}
    </div>
  </>;
}
