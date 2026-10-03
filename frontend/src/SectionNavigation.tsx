import Link from "./Link";
import "./section-navigation.css";

type SectionDestination = {
  id: string;
  label: string;
  href: string;
};

export default function SectionNavigation({ label, items, current, density = "normal" }: {
  label: string;
  items: readonly SectionDestination[];
  current: string;
  /** Compact is for a second level inside a page section, such as weakness categories. */
  density?: "normal" | "compact";
}) {
  return <nav className={`section-navigation${density === "compact" ? " section-navigation--compact" : ""}`} aria-label={label}>
    {items.map(item => <Link key={item.id} href={item.href}
      aria-current={current === item.id ? "page" : undefined}>{item.label}</Link>)}
  </nav>;
}
