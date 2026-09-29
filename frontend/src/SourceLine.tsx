import "./source-line.css";

function externalSource(url?: string | null) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

export default function SourceLine({ text, license, revision, url, linkLabel = "View source", className = "" }: {
  text: string;
  license?: string | null;
  revision?: string | null;
  url?: string | null;
  linkLabel?: string;
  className?: string;
}) {
  const href = externalSource(url);
  return <p className={`source-line ${className}`.trim()}>
    {text}{license && <> · {license}</>}{revision && <> · Revision {revision}</>}
    {href && <> · <a href={href} target="_blank" rel="noopener noreferrer">{linkLabel}</a></>}
  </p>;
}
