import { coachStudies } from "./studies/catalog";
import type { SelectableCoach } from "./model";

export const coachCollections = coachStudies;
export const selectableCoaches: readonly SelectableCoach[] =
  coachCollections.flatMap((collection) =>
    collection.families.map((family) => ({
      ...collection,
      id: family.coachId,
      collectionId: collection.id,
      name: family.name,
      description: family.description,
      defaultFamily: family.id,
      families: [family],
      animation: family.animation ?? collection.animation,
    })),
  );

export function getCoach(id: string | null | undefined): SelectableCoach {
  return (
    selectableCoaches.find((coach) => coach.id === id) ??
    selectableCoaches.find((coach) => coach.id === "classic")!
  );
}
