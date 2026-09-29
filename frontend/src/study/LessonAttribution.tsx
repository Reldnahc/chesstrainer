import type { Schema } from "../api";
import SourceLine from "../SourceLine";

export default function LessonAttribution({ attributions }: { attributions: Schema["LessonCourseView"]["attributions"] }) {
  if (!attributions.length) return null;
  return <div className="lesson-attributions"><h3>Sources</h3>{attributions.map((source, index) => <SourceLine key={index} text={source.text} license={source.license} url={source.url} />)}</div>;
}
