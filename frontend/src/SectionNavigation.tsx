import Link from "./Link";
import "./section-navigation.css";

type SectionDestination = {
  id: string;
  label: string;
  href: string;
};

type SectionLevel = {
  label: string;
  items: readonly SectionDestination[];
  current: string;
};

function SectionLinks({ items, current }: Omit<SectionLevel, "label">) {
  return <>{items.map(item => <Link key={item.id} href={item.href}
    aria-current={current === item.id ? "page" : undefined}>{item.label}</Link>)}</>;
}

export default function SectionNavigation({ label, items, current, subsections }: SectionLevel & {
  /** A second level for the current section, shown in the same bar after a divider. */
  subsections?: SectionLevel;
}) {
  if (!subsections) return <nav className="section-navigation" aria-label={label}>
    <SectionLinks items={items} current={current} />
  </nav>;
  return <div className="section-navigation section-navigation--nested">
    <nav className="section-navigation-level" aria-label={label}><SectionLinks items={items} current={current} /></nav>
    <nav className="section-navigation-level section-navigation-level--sub" aria-label={subsections.label}>
      <SectionLinks items={subsections.items} current={subsections.current} />
    </nav>
  </div>;
}
