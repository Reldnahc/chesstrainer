import EmptyState from "../EmptyState";
import { useEffect, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { api, read, type Schema } from "../api";
import Link from "../Link";
import Button from "../Button";
import Pagination from "../Pagination";
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
      <Button variant="primary" type="submit"><Search size={16} />Search</Button>
    </form>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!catalogue && !error && <p role="status">Loading opening lines…</p>}
    {catalogue && <>
      <p className="small muted">{catalogue.total} matching {catalogue.total === 1 ? "line" : "lines"}</p>
      {catalogue.items.length ? <div className="opening-results">{catalogue.items.map(line => <Link className="opening-result" key={line.source_key} href={openingCataloguePath(line.source_key)}><span className="opening-eco">{line.eco || "—"}</span><span><strong>{line.name}</strong><small>{line.white_positions} White decisions · {line.black_positions} Black decisions</small></span><ChevronRight size={18} /></Link>)}</div> : <EmptyState presentation="compact">No opening lines match this search.</EmptyState>}
      {(offset > 0 || offset + catalogue.items.length < catalogue.total) && <Pagination label="Opening catalogue pages"
        start={catalogue.items.length ? offset + 1 : 0} end={offset + catalogue.items.length} total={catalogue.total}
        previousHref={offset > 0 ? searchPath(Math.max(0, offset - 50)) : undefined}
        nextHref={offset + catalogue.items.length < catalogue.total ? searchPath(offset + 50) : undefined} />}
    </>}
  </section>;
}
