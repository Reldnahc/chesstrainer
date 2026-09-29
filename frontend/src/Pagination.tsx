import { ChevronLeft, ChevronRight } from "lucide-react";
import ActionLink from "./ActionLink";
import Button from "./Button";
import "./pagination.css";

export default function Pagination({ label, start, end, total, previousHref, nextHref }: {
  label: string;
  start: number;
  end: number;
  total: number;
  previousHref?: string;
  nextHref?: string;
}) {
  const previous = <><ChevronLeft size={16} aria-hidden="true" />Previous</>;
  const next = <>Next<ChevronRight size={16} aria-hidden="true" /></>;
  return <nav className="pagination" aria-label={label}>
    {previousHref ? <ActionLink href={previousHref}>{previous}</ActionLink> : <Button disabled>{previous}</Button>}
    <span>{start}–{end} of {total}</span>
    {nextHref ? <ActionLink href={nextHref}>{next}</ActionLink> : <Button disabled>{next}</Button>}
  </nav>;
}
