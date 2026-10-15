import { coachStudies } from "./studies/catalog";
import type { CoachGroup, SelectableCoach } from "./model";

export const coachCollections = coachStudies;
// The picker lists coaches in this group order.
const coachGroups: readonly CoachGroup[] = [
  "humans", "dogs", "cats", "animals", "fantasy", "scifi", "conceptual",
];
const groupOrder = (group: CoachGroup | undefined) => group ? coachGroups.indexOf(group) : -1;

export const selectableCoaches: readonly SelectableCoach[] =
  coachCollections.flatMap((collection) =>
    collection.families.map((family) => ({
      ...collection,
      id: family.coachId,
      group: family.group ?? collection.group,
      collectionId: collection.id,
      name: family.name,
      description: family.description,
      personality: family.personality,
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
