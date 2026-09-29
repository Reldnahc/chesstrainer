import type { Schema } from "../api";

export default function LessonAttribution({ attributions }: { attributions: Schema["LessonCourseView"]["attributions"] }) {
  if (!attributions.length) return null;
  return <div className="lesson-attributions"><h3>Sources</h3>{attributions.map((source, index) => <p key={index}>{source.text}{source.license && <span className="muted"> · {source.license}</span>}{source.url && /^https?:\/\//i.test(source.url) && <> · <a href={source.url} target="_blank" rel="noreferrer">View source</a></>}</p>)}</div>;
}
