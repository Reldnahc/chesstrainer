import {
  expressions,
  type AuthoredCoachCollection,
  type CoachDefinition,
  type CoachCollection,
} from "../model";
import { classicPerformance } from "../classic/performance";
import ManCoach from "./ManCoach";
import WomanCoach from "./WomanCoach";
import CatCoach from "./CatCoach";
import DogCoach from "./DogCoach";
import { storyteller } from "../../dialogue/characters/storyteller";
import { analyst } from "../../dialogue/characters/analyst";
import { host } from "../../dialogue/characters/host";
import { expert } from "../../dialogue/characters/expert";
import { partner } from "../../dialogue/characters/partner";
import { captain } from "../../dialogue/characters/captain";
import { spark } from "../../dialogue/characters/spark";
import { blonde } from "../../dialogue/characters/blonde";
import { tuxedo } from "../../dialogue/characters/tuxedo";
import { velvet } from "../../dialogue/characters/velvet";
import { professor } from "../../dialogue/characters/professor";
import { corgi } from "../../dialogue/characters/corgi";
import { collie } from "../../dialogue/characters/collie";
import { newCoachCollections } from "../cast/catalog";
import { coachPerformance, reactionTiming } from "../motionVocabulary";

const animalIntents: CoachDefinition["expressionIntents"] = {
  neutral: "An attentive gaze and a relaxed, welcoming posture.",
  brilliant:
    "A delighted double take. Bright eyes, lifted paws and an eager tail.",
  great: "An approving nod, an offered paw and a little tail movement.",
  best: "Focused eyes and a confident paw: that is the move.",
  good: "A soft eye squeeze that settles into an easy smile.",
  book: "Eyes down, paws around the book. Familiar territory.",
  inaccuracy: "A questioning tilt and one ear listening a little harder.",
  mistake: "Ears soften and the eyes close briefly. A sympathetic wince.",
  blunder:
    "Wide eyes, startled paws and ears drawn back. Concern, never ridicule.",
  missed: "A glance back and an offered paw: the opportunity was there.",
  losing: "Lowered ears, a tucked tail and a gentle, concerned face.",
  thinking: "One paw at the muzzle; the eyes track an idea.",
  uncertain: "Uneven ears and a curious tilt. Still figuring it out.",
  encouraging: "A soft gaze and a welcoming paw. There is another chance.",
  recovered: "A happy squint, a lifted paw and a short tail celebration.",
  explaining: "An open paw offers the idea, with eyes following the board.",
  draw: "A small, balanced paw gesture and an accepting smile.",
};
const common = {
  defaultState: "neutral",
  expressions,
  fallbacks: {},
  capabilities: { reactions: true, idle: true },
} as const;

export const manStudy: AuthoredCoachCollection = {
  ...common,
  id: "classic",
  group: "humans",
  defaultFamily: "storyteller",
  name: "Men",
  description:
    "Walter and three new faces, each with a distinct silhouette and wardrobe.",
  animation: classicPerformance,
  families: [
    {
      id: "storyteller",
      coachId: "classic",
      speech: true,
      personality: storyteller,
      name: "Walter",
      description:
        "A warm veteran who connects this move to the game's turning points.",
      character: "Anticipation · open gestures · soft settling",
    },
    {
      id: "host",
      coachId: "man-host",
      speech: true,
      personality: host,
      name: "Femi",
      description:
        "Friendly, candid analysis as if you were sitting across the club table.",
      character: "Open palms · warm grins · an expressive double take",
    },
    {
      id: "expert",
      coachId: "man-expert",
      speech: true,
      personality: expert,
      name: "Jun",
      description:
        "Exact consequences, measured approval and no extra words.",
      character: "Measured tilts · attentive eyes · quiet delight",
    },
    {
      id: "partner",
      coachId: "man-partner",
      speech: true,
      personality: partner,
      name: "Arjun",
      description:
        "Curious questions and candidate ideas to explore together.",
      character: "Curious looks · bright smiles · generous encouragement",
    },
  ],
  Artwork: ManCoach,
};

export const womanStudy: AuthoredCoachCollection = {
  ...common,
  capabilities: { ...common.capabilities, speech: true },
  id: "woman",
  group: "humans",
  name: "Women",
  defaultFamily: "captain",
  description:
    "Four women with distinct silhouettes, wardrobes and ways of encouraging a player.",
  expressionIntents: {
    brilliant: "A delighted double take, then a bright, open smile.",
    best: "Quiet conviction. Exactly the move she was hoping for.",
    thinking: "Eyes follow an idea, with one hand at her chin.",
  },
  animation: reactionTiming,
  families: [
    {
      id: "captain",
      coachId: "woman-captain",
      personality: captain,
      name: "Tamar",
      description:
        "A confident mentor: a clear verdict, a concrete reason and a habit to build.",
      character: "Open hands · generous smiles · confident nods",
    },
    {
      id: "analyst",
      coachId: "woman-analyst",
      personality: analyst,
      name: "Marisol",
      description:
        "A restrained observer who identifies exactly what changed.",
      character: "Small tilts · considered pauses · a reassuring smile",
    },
    {
      id: "spark",
      coachId: "woman-spark",
      personality: spark,
      name: "Réka",
      description:
        "Quick, lively explanations and real excitement for clever tactics.",
      character: "Anticipation · lively poses · hair follow-through",
    },
    {
      id: "blonde",
      coachId: "woman-blonde",
      personality: blonde,
      name: "Ingrid",
      description:
        "Relaxed encouragement that keeps the chess honest and the next step clear.",
      character: "Warm smiles · open gestures · a gently settling braid",
    },
  ],
  Artwork: WomanCoach,
};

export const catStudy: AuthoredCoachCollection = {
  ...common,
  capabilities: { ...common.capabilities, speech: true },
  id: "cat",
  group: "cats",
  name: "Cats",
  defaultFamily: "tuxedo",
  description:
    "Two watchful feline coaches, with expressive ears and very deliberate paws.",
  expressionIntents: animalIntents,
  animation: reactionTiming,
  families: [
    {
      id: "tuxedo",
      coachId: "cat-tuxedo",
      personality: tuxedo,
      name: "Felix",
      description:
        "Consequences first. Terse, dry and tactically unforgiving, without cruelty.",
      character: "Measured looks · precise nods · slow tail punctuation",
    },
    {
      id: "black",
      coachId: "cat-black",
      personality: velvet,
      name: "Juniper",
      description:
        "Quiet, watchful explanations with a soft edge and very little drama.",
      character: "Tall ears · luminous eyes · quiet whisker movements",
    },
  ],
  Artwork: CatCoach,
};

export const dogStudy: AuthoredCoachCollection = {
  ...common,
  capabilities: { ...common.capabilities, speech: true },
  id: "dog",
  group: "dogs",
  name: "Dogs",
  defaultFamily: "gentle",
  description:
    "A patient golden retriever, a decisive corgi and an intensely focused collie.",
  expressionIntents: animalIntents,
  animation: reactionTiming,
  families: [
    {
      id: "gentle",
      coachId: "dog-gentle",
      personality: professor,
      name: "Alfie",
      description:
        "Patient, connected explanations: the principle, this position and the lesson.",
      character: "Soft brows · unhurried nods · gentle encouragement",
    },
    {
      id: "corgi",
      coachId: "dog-corgi",
      personality: corgi,
      name: "Waffles",
      description:
        "A tiny commander with enormous confidence. Short orders, clear consequences.",
      character: "Eager ears · buoyant double takes · a full-body smile",
    },
    {
      id: "collie",
      coachId: "dog-collie",
      personality: collie,
      name: "Scout",
      description:
        "Intense pattern recognition and precise, task-focused feedback.",
      character: "Intent eyes · attentive ears · a feathery white-tipped tail",
    },
  ],
  Artwork: DogCoach,
};

// Settings, review and the studio share these assets and performance definitions.
// Each family resolves its own performance; the collection keeps its default family's.
export const coachStudies: readonly CoachCollection[] = [
  manStudy, womanStudy, catStudy, dogStudy, ...newCoachCollections,
].map((collection) => {
  const families = collection.families.map((family) => ({
    ...family,
    animation: coachPerformance(family.coachId, family.animation ?? collection.animation),
  }));
  const fallback = families.find((family) => family.id === collection.defaultFamily) ?? families[0];
  return { ...collection, families, animation: fallback.animation };
});
export function getCoachStudy(id: string | null | undefined) {
  // Existing golden-retriever preview links now open the broader dog collection.
  const requested = id === "retriever" ? "dog" : id;
  return coachStudies.find((coach) => coach.id === requested) ?? coachStudies[0];
}
