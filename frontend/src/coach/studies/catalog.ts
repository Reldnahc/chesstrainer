import {
  expressions,
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
import { tabby } from "../../dialogue/characters/tabby";
import { tuxedo } from "../../dialogue/characters/tuxedo";
import { calico } from "../../dialogue/characters/calico";
import { velvet } from "../../dialogue/characters/velvet";
import { sunny } from "../../dialogue/characters/sunny";
import { professor } from "../../dialogue/characters/professor";
import { corgi } from "../../dialogue/characters/corgi";
import { collie } from "../../dialogue/characters/collie";

const animalPerformance: CoachDefinition["animation"] = {
  defaultReactionMs: 1400,
  reactionMs: { brilliant: 1700, blunder: 1850, winning: 1700, losing: 1500 },
  idleRangeMs: [5500, 11500],
  defaultIdle: ["blink", "glance", "breathe", "ears"],
  idleGestures: {
    brilliant: ["blink", "tail", "twinkle"],
    blunder: ["blink", "sigh", "ears"],
    thinking: ["glance", "blink", "ears"],
    uncertain: ["glance", "ears"],
    losing: ["blink", "breathe"],
    mistake: ["blink", "sigh"],
    great: ["blink", "tail", "nod"],
    good: ["blink", "nod", "tail"],
    winning: ["blink", "tail", "twinkle"],
    book: ["glance", "blink"],
    encouraging: ["blink", "nod"],
    recovered: ["blink", "tail"],
  },
};
const animalIntents: CoachDefinition["expressionIntents"] = {
  neutral: "An attentive gaze and a relaxed, welcoming posture.",
  brilliant:
    "A delighted double take. Bright eyes, lifted paws and an eager tail.",
  great: "An approving nod, an offered paw and a little tail movement.",
  best: "Focused eyes and a confident paw: that is the move.",
  good: "Soft, closed eyes and an easy smile.",
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

export const manStudy: CoachCollection = {
  ...common,
  id: "classic",
  defaultFamily: "storyteller",
  name: "Men",
  description:
    "Storyteller and three new faces, each with a distinct silhouette and wardrobe.",
  animation: {
    ...classicPerformance,
    idleGestures: {
      ...classicPerformance.idleGestures,
      blunder: ["blink", "sigh"],
      thinking: ["glance", "blink"],
    },
  },
  families: [
    {
      id: "storyteller",
      coachId: "classic",
      personality: storyteller,
      name: "Storyteller",
      description:
        "Warm, generous acting. A face you can read across the board.",
      character: "Anticipation · open gestures · soft settling",
      animation: classicPerformance,
    },
    {
      id: "host",
      coachId: "man-host",
      personality: host,
      name: "Club host",
      description:
        "Close curls, a neat beard and a terracotta overshirt. An easy, welcoming presence.",
      character: "Open palms · warm grins · an expressive double take",
    },
    {
      id: "expert",
      coachId: "man-expert",
      personality: expert,
      name: "Endgame expert",
      description:
        "Silver at the temples, a clean-shaven face and a slate cardigan. A steady study companion.",
      character: "Measured tilts · attentive eyes · quiet delight",
    },
    {
      id: "partner",
      coachId: "man-partner",
      personality: partner,
      name: "Creative partner",
      description:
        "Dark waves, a shaped beard and a forest-green waistcoat. Ready to explore an idea together.",
      character: "Curious looks · bright smiles · generous encouragement",
    },
  ],
  Artwork: ManCoach,
};

export const womanStudy: CoachCollection = {
  ...common,
  id: "woman",
  name: "Women",
  defaultFamily: "captain",
  description:
    "Four women with distinct silhouettes, wardrobes and ways of encouraging a player.",
  expressionIntents: {
    brilliant: "A delighted double take, then a bright, open smile.",
    best: "Quiet conviction. Exactly the move she was hoping for.",
    thinking: "Eyes follow an idea, with one hand at her chin.",
  },
  animation: {
    ...animalPerformance,
    defaultIdle: ["blink", "glance", "breathe", "hair"],
    idleGestures: {
      brilliant: ["blink", "twinkle", "nod"],
      blunder: ["blink", "sigh", "hair"],
      thinking: ["glance", "blink", "hair"],
      good: ["blink", "nod"],
      winning: ["blink", "twinkle"],
      losing: ["blink", "breathe"],
      encouraging: ["blink", "nod"],
    },
  },
  families: [
    {
      id: "captain",
      coachId: "woman-captain",
      personality: captain,
      name: "Club captain",
      description:
        "Auburn waves, a teal blazer and warm, assured encouragement.",
      character: "Open hands · generous smiles · confident nods",
    },
    {
      id: "analyst",
      coachId: "woman-analyst",
      personality: analyst,
      name: "Quiet analyst",
      description:
        "A curled updo, warm cream knitwear and thoughtful eyes behind glasses.",
      character: "Small tilts · considered pauses · a reassuring smile",
    },
    {
      id: "spark",
      coachId: "woman-spark",
      personality: spark,
      name: "Bright spark",
      description:
        "A swinging ponytail and a plum jacket. Quick to spot—and celebrate—an idea.",
      character: "Anticipation · lively poses · hair follow-through",
    },
    {
      id: "blonde",
      coachId: "woman-blonde",
      personality: blonde,
      name: "Golden braid",
      description:
        "A swept blonde fringe, a loose side braid and a soft blue cardigan. Bright, easygoing company.",
      character: "Warm smiles · open gestures · a gently settling braid",
    },
  ],
  Artwork: WomanCoach,
};

export const catStudy: CoachCollection = {
  ...common,
  id: "cat",
  name: "Cats",
  defaultFamily: "tabby",
  description:
    "Four feline coaches, with expressive ears, whiskers and very deliberate paws.",
  expressionIntents: animalIntents,
  animation: animalPerformance,
  families: [
    {
      id: "tabby",
      coachId: "cat-tabby",
      personality: tabby,
      name: "Library tabby",
      description:
        "A warm ginger study companion. Curious eyes, soft stripes and a sage scarf.",
      character: "Ear flicks · thoughtful paws · a pleased little squint",
    },
    {
      id: "tuxedo",
      coachId: "cat-tuxedo",
      personality: tuxedo,
      name: "Midnight tactician",
      description:
        "A sharp tuxedo silhouette, white mittens and a quieter kind of confidence.",
      character: "Measured looks · precise nods · slow tail punctuation",
    },
    {
      id: "calico",
      coachId: "cat-calico",
      personality: calico,
      name: "Curious calico",
      description:
        "A patchwork face with a turquoise scarf. Always another angle to investigate.",
      character: "Uneven ears · playful head tilts · bright double takes",
    },
    {
      id: "black",
      coachId: "cat-black",
      personality: velvet,
      name: "Velvet night",
      description:
        "An all-black coat, amber eyes and a plum scarf. A watchful companion with a soft side.",
      character: "Tall ears · luminous eyes · quiet whisker movements",
    },
  ],
  Artwork: CatCoach,
};

export const dogStudy: CoachCollection = {
  ...common,
  id: "dog",
  name: "Dogs",
  defaultFamily: "sunny",
  description:
    "Two beloved goldens, a corgi and a border collie. Four different kinds of good company.",
  expressionIntents: animalIntents,
  animation: { ...animalPerformance, idleRangeMs: [6000, 12000] },
  families: [
    {
      id: "sunny",
      coachId: "dog-sunny",
      personality: sunny,
      name: "Sunny companion",
      description:
        "Honey-gold fur and a blue bandana. Every good idea earns a warm welcome.",
      character: "Bright eyes · soft ear bounce · a happy tail",
    },
    {
      id: "gentle",
      coachId: "dog-gentle",
      personality: professor,
      name: "Gentle professor",
      description:
        "A cream-colored older golden with reading glasses and endless patience.",
      character: "Soft brows · unhurried nods · gentle encouragement",
    },
    {
      id: "corgi",
      coachId: "dog-corgi",
      personality: corgi,
      name: "Pocket captain",
      description:
        "A red-and-white corgi with big upright ears, a broad grin and a little red bandana.",
      character: "Eager ears · buoyant double takes · a full-body smile",
    },
    {
      id: "collie",
      coachId: "dog-collie",
      personality: collie,
      name: "Border collie",
      description:
        "A black-and-white coat, a white blaze and one folded ear. Always watching the next move.",
      character: "Intent eyes · attentive ears · a feathery white-tipped tail",
    },
  ],
  Artwork: DogCoach,
};

// Settings, review and the studio share these assets and performance definitions.
export const coachStudies = [manStudy, womanStudy, catStudy, dogStudy];
export function getCoachStudy(id: string | null | undefined) {
  // Existing golden-retriever preview links now open the broader dog collection.
  const requested = id === "retriever" ? "dog" : id;
  return coachStudies.find((coach) => coach.id === requested) ?? manStudy;
}
