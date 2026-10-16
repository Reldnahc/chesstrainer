import PageTitle from "../PageTitle";
import SectionNavigation from "../SectionNavigation";
import {
  openingCataloguePath,
  openingStudiesPath,
  studyPaths,
  type OpeningSection,
} from "../navigation";
import LessonLibrary from "./LessonLibrary";
import OpeningCatalogue from "./OpeningCatalogue";
import OpeningStudies from "./OpeningStudies";

const sections: { id: OpeningSection; label: string; href: string; title: string }[] = [
  { id: "fundamentals", label: "Fundamentals", href: studyPaths.skills, title: "Fundamentals" },
  { id: "lessons", label: "Openings", href: studyPaths.openings, title: "Lessons" },
  { id: "catalogue", label: "Catalogue", href: openingCataloguePath(), title: "Opening catalogue" },
  { id: "studies", label: "My studies", href: openingStudiesPath, title: "My opening studies" },
];

/** Study's Lessons section: opening and fundamentals courses beside the opening
 * catalogue and the learner's own studies. A course page drops the section tray. */
export default function LessonsScreen({
  section,
  courseId,
  revision,
  query,
  eco,
  offset,
}: {
  section: OpeningSection;
  courseId: string | null;
  revision: string | null;
  query: string;
  eco: string;
  offset: number;
}) {
  return (
    <>
      <PageTitle
        title="Lessons"
        documentTitle={sections.find(item => item.id === section)!.title}
      />
      <div className="study-page">
        {!courseId && (
          <SectionNavigation label="Lesson sections" current={section} items={sections} />
        )}
        {section === "catalogue" ? (
          <OpeningCatalogue query={query} eco={eco} offset={offset} />
        ) : section === "studies" ? (
          <OpeningStudies />
        ) : (
          <LessonLibrary
            topic={section === "fundamentals" ? "skills" : "opening"}
            courseId={courseId}
            revision={revision}
          />
        )}
      </div>
    </>
  );
}
