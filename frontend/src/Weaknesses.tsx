import { useState } from "react";
import { ArrowRight, ChevronRight, Flag } from "lucide-react";
import { api, read, type Schema } from "./api";
import PageTitle from "./PageTitle";
import SectionNavigation from "./SectionNavigation";
import StatList from "./StatList";
import EmptyState from "./EmptyState";
import Button from "./Button";
import { QueryResult, useQuery } from "./useQuery";
import ActionLink from "./ActionLink";
import { focusedPracticePath, insightsPaths, settingsPath, type InsightsSection } from "./navigation";
import GameInsights from "./GameInsights";

function WeaknessCard({ skill, onEvidence }: {
  skill: Schema["SkillPriority"];
  onEvidence: (id: string) => void;
}) {
  return <article className="panel weakness" aria-labelledby={`weakness-${skill.skill_id}`}>
    <div className="weakness-heading">
      <h3 id={`weakness-${skill.skill_id}`}>{skill.title}</h3>
      <span className="badge">{skill.provisional ? "Early evidence" : `Across ${skill.independent_games} games`}</span>
    </div>
    <p className="weakness-cue">{skill.cue}</p>
    <StatList items={[
      { label: "Positions", value: skill.unique_positions },
      { label: "Games", value: skill.independent_games },
      // The priority reads at most the 30 latest recalls of these positions.
      { label: "Recent reviews", value: skill.reviews },
    ]} />
    <div className="weakness-practice">
      {skill.focused_attempts > 0 && <p className="small">
        <strong>{skill.focused_attempts - skill.focused_failures} / {skill.focused_attempts}</strong> clean solves in recent focused practice
      </p>}
      {skill.practice_positions ? <ActionLink variant="secondary"
        href={focusedPracticePath(skill.skill_id)}>
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

function WeaknessSection({ skills, title, countLabel, empty, onEvidence }: {
  skills: Schema["SkillPriority"][];
  title: string;
  countLabel: string;
  empty: string;
  onEvidence: (id: string) => void;
}) {
  return <section className="weakness-section" aria-labelledby="weakness-category-title">
    <div className="weakness-section-heading">
      <h2 id="weakness-category-title">{title}</h2>
      <span className="small muted">{skills.length} {countLabel}{skills.length === 1 ? "" : "s"}</span>
    </div>
    {skills.length ? <>
      <div className="weakness-list">
        {skills.map(skill => <WeaknessCard key={skill.skill_id} skill={skill} onEvidence={onEvidence} />)}
      </div>
      <p className="weakness-practice-note">Focused practice uses up to 12 positions and leaves your review schedule unchanged.</p>
    </> : <EmptyState title={empty} icon={<Flag />}>
      No supported evidence in this category yet. Try the other category to see your available practice.
    </EmptyState>}
  </section>;
}

export default function InsightsScreen({ onEvidence, category }: {
  onEvidence: (id: string) => void;
  category: InsightsSection;
}) {
  const overview = category === "overview";
  // Weakness evidence loads on first visit to a weakness section and is reused after.
  const [opened, setOpened] = useState(!overview);
  if (!overview && !opened) setOpened(true);
  const query = useQuery(signal => read(api.GET("/api/weaknesses", { signal })), [], { enabled: opened });
  const kind = category === "patterns" ? "mechanism" : "outcome";
  const title = category === "patterns" ? "Tactical patterns" : "Material & mate outcomes";
  const countLabel = category === "patterns" ? "pattern" : "outcome";

  return <>
    <PageTitle title="Insights" />
    <SectionNavigation label="Insight sections" current={overview ? "overview" : "weaknesses"} items={[
      { id: "overview", label: "Overview", href: insightsPaths.overview },
      { id: "weaknesses", label: "Weaknesses", href: insightsPaths.patterns },
    ]} subsections={overview ? undefined : { label: "Weakness categories", current: category, items: [
      { id: "patterns", label: "Tactical patterns", href: insightsPaths.patterns },
      { id: "outcomes", label: "Material & mate", href: insightsPaths.outcomes },
    ] }} />
    <div className="weakness-content">
      {overview ? <GameInsights /> : <QueryResult query={query} label="your weaknesses" presentation="panel">
        {data => !data.skills.length ? <EmptyState title="No supported weaknesses yet." icon={<Flag />} actions={
          <ActionLink variant="secondary" href={settingsPath("advanced")}>Training settings</ActionLink>
        }>
          Classify saved games in Settings. Your positions are still available in Due.
        </EmptyState> : <WeaknessSection skills={data.skills.filter(skill => skill.kind === kind)} title={title}
          countLabel={countLabel} empty={category === "patterns" ? "No tactical patterns yet." : "No material or mate outcomes yet."}
          onEvidence={onEvidence} />}
      </QueryResult>}
    </div>
  </>;
}
