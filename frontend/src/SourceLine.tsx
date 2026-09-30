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

export default function SourceLine({ text, license, licenseUrl, revision, url, linkLabel = "View source", className = "" }: {
  text: string;
  license?: string | null;
  licenseUrl?: string | null;
  revision?: string | null;
  url?: string | null;
  linkLabel?: string;
  className?: string;
}) {
  const href = externalSource(url);
  const licenseHref = externalSource(licenseUrl);
  return <p className={`source-line ${className}`.trim()}>
    {text}{license && <> · {licenseHref ? <a href={licenseHref} target="_blank" rel="noopener noreferrer">{license}</a> : license}</>}{revision && <> · Revision {revision}</>}
    {href && <> · <a href={href} target="_blank" rel="noopener noreferrer">{linkLabel}</a></>}
  </p>;
}
