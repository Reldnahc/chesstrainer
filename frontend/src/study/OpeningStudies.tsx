import { useEffect, useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { api, read, type Schema } from "../api";
import ActionLink from "../ActionLink";
import Button from "../Button";
import StatList from "../StatList";
import { lessonSessionPath, navigate, openingCataloguePath, studyPaths } from "../navigation";
import { createPracticeStarter, setStudyActive } from "./openingApi";

export default function OpeningStudies() {
  const [library, setLibrary] = useState<Schema["OpeningStudyLibrary"] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [practiceStudy] = useState(createPracticeStarter);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    const pending = new AbortController();
    controller.current = pending;
    read(api.GET("/api/opening-studies", { signal: pending.signal }))
      .then(result => { if (!pending.signal.aborted) setLibrary(result); })
      .catch(e => { if (!pending.signal.aborted) setError(e.message); });
    return () => pending.abort();
  }, []);
  async function act(study: Schema["OpeningStudySummary"], practice = false) {
    if (locked.current) return;
    const signal = controller.current?.signal;
    locked.current = true;
    setBusy(study.id);
    setError("");
    try {
      if (practice) {
        const session = await practiceStudy(study.id, signal);
        if (!signal?.aborted && session) navigate(lessonSessionPath(session.id));
      } else {
        await setStudyActive(study.id, !study.active, signal);
        const result = await read(api.GET("/api/opening-studies", { signal }));
        if (!signal?.aborted) setLibrary(result);
      }
    } catch (e) { if (!signal?.aborted) setError((e as Error).message); }
    finally { if (!signal?.aborted) { setBusy(null); locked.current = false; } }
  }
  return <section className="panel opening-studies">
    <div className="opening-management-heading"><div><h2>Your selected lines</h2><p className="small muted">Rehearse one line here. Due accepts the combined moves from your active studies.</p></div><ActionLink variant="secondary" href={openingCataloguePath()}>Browse catalogue<ArrowRight size={16} /></ActionLink></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!library && !error && <p role="status">Loading your studies…</p>}
    {library && <>
      {!!library.items.length && <StatList items={[
        {label: "Active studies", value: library.active_studies},
        {label: "Learning positions", value: library.learning_positions},
        {label: "Due now", value: library.due_positions},
      ]} />}
      {library.items.length ? <div className="opening-study-list">{library.items.map(study => <article key={study.id} className="opening-study" aria-label={`${study.name} as ${study.color}`}><div><span className="opening-study-status">{study.active ? "Active" : "Paused"} · {study.color === "white" ? "White" : "Black"}{study.eco && ` · ${study.eco}`}</span><h3>{study.name}</h3><p className="small muted">{study.positions} recall positions · {study.due_positions} due{!study.active && " · History preserved"}</p></div><div className="button-row"><Button disabled={!!busy} onClick={() => act(study, true)}><Play size={15} />Practice line</Button><Button variant="secondary" disabled={!!busy} onClick={() => act(study)}>{busy === study.id ? "Saving…" : study.active ? "Pause recalls" : "Resume recalls"}</Button></div></article>)}</div> : <p>No lines selected yet. Preview a catalogue or course line to add it to your study.</p>}
      {!!library.due_positions && <ActionLink variant="primary" href={studyPaths.due}>Review due positions<ArrowRight size={16} /></ActionLink>}
    </>}
  </section>;
}
