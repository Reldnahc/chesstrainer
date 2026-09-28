import { coachStudies } from "./studies/catalog";
import type { CoachGroup, SelectableCoach } from "./model";
import { neutralPersonality } from "../dialogue/personality";

export const coachCollections = coachStudies;
export const coachGroups: readonly { id: CoachGroup; label: string }[] = [
  { id: "humans", label: "Humans" },
  { id: "dogs", label: "Dogs" },
  { id: "cats", label: "Cats" },
  { id: "animals", label: "Other animals" },
  { id: "fantasy", label: "Fantasy" },
  { id: "scifi", label: "Sci-Fi" },
  { id: "conceptual", label: "Silly & conceptual" },
];
const groupOrder = (group: CoachGroup | undefined) =>
  coachGroups.findIndex((entry) => entry.id === group);

export const selectableCoaches: readonly SelectableCoach[] =
  coachCollections.flatMap((collection) =>
    collection.families.map((family) => ({
      ...collection,
      id: family.coachId,
      group: family.group ?? collection.group,
      collectionId: collection.id,
      name: family.name,
      description: family.description,
      personality: family.personality ?? neutralPersonality,
      defaultFamily: family.id,
      families: [family],
      animation: family.animation ?? collection.animation,
    })),
  ).sort((a, b) => groupOrder(a.group) - groupOrder(b.group));

// Keep stale in-memory preferences and bookmarks aligned with the API's read-only
// compatibility mappings. Stored selections change only when the user saves.
export const retiredCoachReplacements = {
  "dog-sunny": "dog-puppy",
  "cat-tabby": "cat-kitten",
  "cat-calico": "cat-kitten",
} as const;

export function getCoach(id: string | null | undefined): SelectableCoach {
  const requested = id && Object.hasOwn(retiredCoachReplacements, id)
    ? retiredCoachReplacements[id as keyof typeof retiredCoachReplacements]
    : id;
  return (
    selectableCoaches.find((coach) => coach.id === requested) ??
    selectableCoaches.find((coach) => coach.id === "classic")!
  );
}
