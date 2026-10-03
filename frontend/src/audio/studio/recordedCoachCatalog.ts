import metadata from "../speech/meanings.json" with {type: "json"};
import {coachMouthTrack, coachRecording, coachRecordings} from "../speech/voiceBank";
import {selectableCoaches} from "../../coach/registry";
import type {RecordedCoachCatalog, RecordingMeaning} from "./RecordedCoachComparison";

const groupLabels: Record<string, string> = {
  game_review: "Game review", srs_explanations: "Practice & explanations",
  openings: "Opening recall", puzzles: "Puzzles", operational: "Review guidance",
  lessons: "Lesson prompts",
};
function meaningLabel(id: string): string {
  return id.replace(/^book-opening-entry-/, "Opening entry ")
    .replace(/^book-opening-follow-/, "Opening continuation ")
    .replace(/^(?:explanation-|positional-|tactic-|srs-)/, "")
    .replaceAll("-", " ").replace(/^./, first => first.toUpperCase());
}
const coaches = selectableCoaches.filter(coach => coachRecordings(coach.id).length).map(coach => coach.id);
const meanings: RecordingMeaning[] = metadata.meanings.map((meaning: {id: string; group: string}) => ({
  ...meaning, group: groupLabels[meaning.group] ?? meaning.group, label: meaningLabel(meaning.id),
}));

/** Development comparison reads the same registry as production; it cannot register voices. */
export const recordedCoachCatalog: RecordedCoachCatalog = {
  coaches, meanings,
  recording: (coachId, id) => coachRecording(coachId, id) ?? undefined,
  loadTrack: coachMouthTrack,
};
