import { useEffect, useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { api, read, type Schema } from "../api";
import Link from "../Link";
import { lessonSessionPath, navigate, openingCataloguePath, studyPaths } from "../navigation";
import { practiceStudy, setStudyActive } from "./openingApi";

export default function OpeningStudies() {
  const [library, setLibrary] = useState<Schema["OpeningStudyLibrary"] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
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
        if (!signal?.aborted) navigate(lessonSessionPath(session.id));
      } else {
        await setStudyActive(study.id, !study.active, signal);
        const result = await read(api.GET("/api/opening-studies", { signal }));
        if (!signal?.aborted) setLibrary(result);
      }
    } catch (e) { if (!signal?.aborted) setError((e as Error).message); }
    finally { if (!signal?.aborted) { setBusy(null); locked.current = false; } }
  }
  return <section className="panel opening-studies">
    <div className="opening-management-heading"><div><h2>Your selected lines</h2><p className="small muted">Rehearse one line here. Due accepts the combined moves from your active studies.</p></div><Link className="button-link secondary" href={openingCataloguePath()}>Browse catalogue<ArrowRight size={16} /></Link></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!library && !error && <p role="status">Loading your studies…</p>}
    {library && <>
      {!!library.items.length && <dl className="study-stats"><div><dt>Active studies</dt><dd>{library.active_studies}</dd></div><div><dt>Learning positions</dt><dd>{library.learning_positions}</dd></div><div><dt>Due now</dt><dd>{library.due_positions}</dd></div></dl>}
      {library.items.length ? <div className="opening-study-list">{library.items.map(study => <article key={study.id} className="opening-study" aria-label={`${study.name} as ${study.color}`}><div><span className="opening-study-status">{study.active ? "Active" : "Paused"} · {study.color === "white" ? "White" : "Black"}{study.eco && ` · ${study.eco}`}</span><h3>{study.name}</h3><p className="small muted">{study.positions} recall positions · {study.due_positions} due{!study.active && " · History preserved"}</p></div><div className="button-row"><button disabled={!!busy} onClick={() => act(study, true)}><Play size={15} />Practice line</button><button className="secondary" disabled={!!busy} onClick={() => act(study)}>{busy === study.id ? "Saving…" : study.active ? "Pause recalls" : "Resume recalls"}</button></div></article>)}</div> : <p>No lines selected yet. Preview a catalogue or course line to add it to your study.</p>}
      {!!library.due_positions && <Link className="button-link primary" href={studyPaths.due}>Review due positions<ArrowRight size={16} /></Link>}
    </>}
  </section>;
}
