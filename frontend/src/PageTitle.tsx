import { useEffect } from "react";

const SITE = "Fieldwork";

/** The browser tab's title: the page's own name, then the site. Null leaves the
 * route's fallback (set by App) in place, for a page still loading its name. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · ${SITE}`;
  }, [title]);
}

/** The route's fallback title, written before a page names itself. */
export function setFallbackTitle(title: string) {
  document.title = `${title} · ${SITE}`;
}

// Pages show no visible header; the navigation already names the page.
// The heading stays for screen readers and in-page heading navigation, and the
// browser tab shows the same name unless the page gives it a shorter one.
export default function PageTitle({
  title,
  documentTitle = title,
}: {
  title: string;
  documentTitle?: string;
}) {
  usePageTitle(documentTitle);
  return <h1 className="sr-only">{title}</h1>;
}
