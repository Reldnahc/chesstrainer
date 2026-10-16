import { ArrowRight, Play } from "lucide-react";
import { api, read, type Schema } from "../api";
import ActionLink from "../ActionLink";
import Button from "../Button";
import EmptyState from "../EmptyState";
import StatList from "../StatList";
import { lessonSessionPath, openingCataloguePath, studyPaths } from "../navigation";
import { CommandError, QueryResult, useCommand, useQuery } from "../useQuery";
import { useSessionStart } from "../useSessionStart";
import { createPracticeStarter, setStudyActive } from "./openingApi";
import { plural } from "../format";

type Study = Schema["OpeningStudySummary"];
// Which command a study row is running, so only that button says it is busy.
type Busy = { id: string; command: "practice" | "toggle" };

function StudyRow({ study, busy, onPractice, onToggle }: {
  study: Study;
  busy: Busy | null;
  onPractice: () => void;
  onToggle: () => void;
}) {
  const running = busy?.id === study.id ? busy.command : null;
  return <article className="opening-study" aria-label={`${study.name} as ${study.color}`}>
    <div>
      <span className="opening-study-status">{study.active ? "Active" : "Paused"} · {study.color === "white" ? "White" : "Black"}{study.eco && ` · ${study.eco}`}</span>
      <h3>{study.name}</h3>
      <p className="small muted">{plural(study.positions, "recall position")} · {study.due_positions} due{!study.active && " · History preserved"}</p>
    </div>
    <div className="button-row">
      <Button disabled={!!busy} onClick={onPractice}><Play size={15} />{running === "practice" ? "Opening…" : "Practice line"}</Button>
      <Button variant="secondary" disabled={!!busy} onClick={onToggle}>
        {running === "toggle" ? "Saving…" : study.active ? "Pause recalls" : "Resume recalls"}
      </Button>
    </div>
  </article>;
}

export default function OpeningStudies() {
  const library = useQuery((signal) => read(api.GET("/api/opening-studies", { signal })));
  const command = useCommand<Busy>();
  // Practice and pause share one guard, so only one command runs at a time.
  const starting = useSessionStart(createPracticeStarter, (session) => lessonSessionPath(session.id), command);
  const busy = command.busy;
  const practice = (study: Study) => void starting.start({ id: study.id, command: "practice" }, study.id);
  const toggle = (study: Study) => void command.run({ id: study.id, command: "toggle" }, async (signal) => {
    await setStudyActive(study.id, !study.active, signal);
    return read(api.GET("/api/opening-studies", { signal }));
  }, library.setData);
  return <section className="panel opening-studies">
    <div className="opening-management-heading"><div><h2>Your selected lines</h2><p className="small muted">Rehearse one line here. Due accepts the combined moves from your active studies.</p></div><ActionLink variant="secondary" href={openingCataloguePath()}>Browse catalogue<ArrowRight size={16} /></ActionLink></div>
    <CommandError command={command} />
    <QueryResult query={library} label="your studies">{(library) => <>
      {!!library.items.length && <StatList items={[
        { label: "Active studies", value: library.active_studies },
        { label: "Learning positions", value: library.learning_positions },
        { label: "Due now", value: library.due_positions },
      ]} />}
      {library.items.length
        ? <div className="opening-study-list">{library.items.map((study) =>
          <StudyRow key={study.id} study={study} busy={busy} onPractice={() => practice(study)} onToggle={() => toggle(study)} />)}</div>
        : <EmptyState presentation="compact">No lines selected yet. Preview a catalogue or course line to add it to your study.</EmptyState>}
      {!!library.due_positions && <ActionLink variant="primary" href={studyPaths.due}>Review due positions<ArrowRight size={16} /></ActionLink>}
    </>}</QueryResult>
  </section>;
}
