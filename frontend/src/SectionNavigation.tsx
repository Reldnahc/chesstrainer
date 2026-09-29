import Link from "./Link";
import "./section-navigation.css";

type SectionDestination = {
  id: string;
  label: string;
  href: string;
};

export default function SectionNavigation({ label, items, current }: {
  label: string;
  items: readonly SectionDestination[];
  current: string;
}) {
  return <nav className="section-navigation" aria-label={label}>
    {items.map(item => <Link key={item.id} href={item.href}
      aria-current={current === item.id ? "page" : undefined}>{item.label}</Link>)}
  </nav>;
}
