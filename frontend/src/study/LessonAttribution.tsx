import type { Schema } from "../api";
import SourceLine from "../SourceLine";

export default function LessonAttribution({ attributions }: { attributions: Schema["LessonCourseView"]["attributions"] }) {
  if (!attributions.length) return null;
  // Resolve this app-owned reference when rendering, preserving saved course fingerprints.
  return <div className="lesson-attributions"><h3>Sources</h3>{attributions.map((source, index) => <SourceLine
    key={index} text={source.text} license={source.license} url={source.url}
    licenseUrl={source.license === "Repository license" ? "https://github.com/Reldnahc/chesstrainer/blob/main/LICENSE" : undefined}
  />)}</div>;
}
