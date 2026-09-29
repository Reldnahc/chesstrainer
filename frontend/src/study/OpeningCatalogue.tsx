import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { api, read, type Schema } from "../api";
import Link from "../Link";
import { navigate, openingCataloguePath } from "../navigation";

export default function OpeningCatalogue({ query, eco, offset }: { query: string; eco: string; offset: number }) {
  const [search, setSearch] = useState(query);
  const [code, setCode] = useState(eco);
  const [catalogue, setCatalogue] = useState<Schema["OpeningCatalogue"] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    read(api.GET("/api/openings/catalog", { params: { query: { q: query, eco, offset, limit: 50 } }, signal: controller.signal }))
      .then(result => { if (!controller.signal.aborted) setCatalogue(result); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [query, eco, offset]);
  function searchPath(nextOffset = 0, nextQuery = query, nextEco = eco) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextEco.trim()) params.set("eco", nextEco.trim().toUpperCase());
    if (nextOffset) params.set("offset", String(nextOffset));
    return `${openingCataloguePath()}${params.size ? `?${params}` : ""}`;
  }
  return <section className="panel opening-catalogue">
    <h2>Choose a line to remember.</h2>
    <p className="small muted">Named lines are specific continuations, not complete opening courses. Preview before adding them to Due.</p>
    <form className="opening-search" onSubmit={event => { event.preventDefault(); navigate(searchPath(0, search, code)); }}>
      <label>Opening name<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Italian Game, Caro-Kann…" /></label>
      <label>ECO<input value={code} onChange={event => setCode(event.target.value)} placeholder="C50" maxLength={3} /></label>
      <button className="primary" type="submit"><Search size={16} />Search</button>
    </form>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!catalogue && !error && <p role="status">Loading opening lines…</p>}
    {catalogue && <>
      <p className="small muted">{catalogue.total} matching {catalogue.total === 1 ? "line" : "lines"}</p>
      {catalogue.items.length ? <div className="opening-results">{catalogue.items.map(line => <Link className="opening-result" key={line.source_key} href={openingCataloguePath(line.source_key)}><span className="opening-eco">{line.eco || "—"}</span><span><strong>{line.name}</strong><small>{line.white_positions} White decisions · {line.black_positions} Black decisions</small></span><ChevronRight size={18} /></Link>)}</div> : <p>No opening lines match this search.</p>}
      {(offset > 0 || offset + catalogue.items.length < catalogue.total) && <div className="opening-pagination"><button disabled={offset === 0} onClick={() => navigate(searchPath(Math.max(0, offset - 50)))}><ChevronLeft size={16} />Previous</button><span>{catalogue.items.length ? offset + 1 : 0}–{offset + catalogue.items.length} of {catalogue.total}</span><button disabled={offset + catalogue.items.length >= catalogue.total} onClick={() => navigate(searchPath(offset + 50))}>Next<ChevronRight size={16} /></button></div>}
    </>}
  </section>;
}
